const WebSocket = require('ws');
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const cache = require('../utils/cache');

/**
 * Sync service for handling real-time data synchronization
 */
class SyncService {
  constructor() {
    this.wss = null;
    this.pubClient = new Redis(config.redis);
    this.subClient = new Redis(config.redis);
    this.channels = new Set();
    this.clients = new Map(); // Map<clientId, { ws, userId, subscriptions }>

    // Subscribe to Redis events
    this.setupRedisSubscriptions();
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      
      // Store client information
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        lastPing: Date.now()
      });

      // Set up client event handlers
      this.setupClientHandlers(ws, clientId);

      // Send initial connection success
      this.sendToClient(ws, {
        type: 'connected',
        clientId
      });
    });

    // Start heartbeat interval
    this.startHeartbeat();
  }

  /**
   * Set up Redis subscriptions
   */
  setupRedisSubscriptions() {
    this.subClient.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.broadcast(channel, data);
      } catch (error) {
        logger.error(`Redis message parsing error: ${error.message}`);
      }
    });

    this.subClient.on('error', (error) => {
      logger.error(`Redis subscription error: ${error.message}`);
    });
  }

  /**
   * Set up client event handlers
   * @param {Object} ws - WebSocket connection
   * @param {string} clientId - Client ID
   */
  setupClientHandlers(ws, clientId) {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await this.handleClientMessage(clientId, data);
      } catch (error) {
        logger.error(`Client message handling error: ${error.message}`);
        this.sendToClient(ws, {
          type: 'error',
          error: 'Invalid message format'
        });
      }
    });

    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
      this.handleClientDisconnect(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }
    });
  }

  /**
   * Handle client messages
   * @param {string} clientId - Client ID
   * @param {Object} data - Message data
   */
  async handleClientMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'subscribe':
        await this.handleSubscribe(clientId, data.channels);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(clientId, data.channels);
        break;

      case 'sync':
        await this.handleSync(clientId, data.entity, data.id);
        break;

      default:
        this.sendToClient(client.ws, {
          type: 'error',
          error: 'Unknown message type'
        });
    }
  }

  /**
   * Handle client subscription request
   * @param {string} clientId - Client ID
   * @param {Array} channels - Channels to subscribe to
   */
  async handleSubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const channel of channels) {
      // Subscribe to Redis channel if not already subscribed
      if (!this.channels.has(channel)) {
        await this.subClient.subscribe(channel);
        this.channels.add(channel);
      }

      // Add to client subscriptions
      client.subscriptions.add(channel);
    }

    this.sendToClient(client.ws, {
      type: 'subscribed',
      channels: Array.from(client.subscriptions)
    });
  }

  /**
   * Handle client unsubscribe request
   * @param {string} clientId - Client ID
   * @param {Array} channels - Channels to unsubscribe from
   */
  async handleUnsubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const channel of channels) {
      // Remove from client subscriptions
      client.subscriptions.delete(channel);

      // Check if channel can be unsubscribed from Redis
      let hasOtherSubscribers = false;
      for (const [, otherClient] of this.clients) {
        if (otherClient.subscriptions.has(channel)) {
          hasOtherSubscribers = true;
          break;
        }
      }

      if (!hasOtherSubscribers) {
        await this.subClient.unsubscribe(channel);
        this.channels.delete(channel);
      }
    }

    this.sendToClient(client.ws, {
      type: 'unsubscribed',
      channels: Array.from(client.subscriptions)
    });
  }

  /**
   * Handle client sync request
   * @param {string} clientId - Client ID
   * @param {string} entity - Entity type
   * @param {string} id - Entity ID
   */
  async handleSync(clientId, entity, id) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Get latest data from cache or database
      const cacheKey = `${entity}:${id}`;
      let data = await cache.get(cacheKey);

      if (!data) {
        // Fetch from database if not in cache
        const model = require(`../models/${entity}`);
        data = await model.findById(id).lean();

        if (data) {
          // Cache for future requests
          await cache.set(cacheKey, JSON.stringify(data), 300); // 5 minutes
        }
      } else {
        data = JSON.parse(data);
      }

      if (data) {
        this.sendToClient(client.ws, {
          type: 'sync',
          entity,
          id,
          data
        });
      } else {
        this.sendToClient(client.ws, {
          type: 'error',
          error: 'Entity not found'
        });
      }
    } catch (error) {
      logger.error(`Sync error: ${error.message}`);
      this.sendToClient(client.ws, {
        type: 'error',
        error: 'Failed to sync entity'
      });
    }
  }

  /**
   * Handle client disconnect
   * @param {string} clientId - Client ID
   */
  handleClientDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clean up subscriptions
    for (const channel of client.subscriptions) {
      let hasOtherSubscribers = false;
      for (const [otherId, otherClient] of this.clients) {
        if (otherId !== clientId && otherClient.subscriptions.has(channel)) {
          hasOtherSubscribers = true;
          break;
        }
      }

      if (!hasOtherSubscribers) {
        this.subClient.unsubscribe(channel);
        this.channels.delete(channel);
      }
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Broadcast message to subscribed clients
   * @param {string} channel - Channel name
   * @param {Object} data - Message data
   */
  broadcast(channel, data) {
    for (const [, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(client.ws, {
          type: 'message',
          channel,
          data
        });
      }
    }
  }

  /**
   * Send message to specific client
   * @param {Object} ws - WebSocket connection
   * @param {Object} data - Message data
   */
  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > 30000) { // 30 seconds timeout
          // Client is unresponsive, close connection
          client.ws.terminate();
          this.handleClientDisconnect(clientId);
        } else {
          // Send ping
          client.ws.ping();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Generate unique client ID
   * @returns {string} Client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Publish update to channel
   * @param {string} channel - Channel name
   * @param {Object} data - Update data
   */
  async publish(channel, data) {
    try {
      await this.pubClient.publish(channel, JSON.stringify(data));
    } catch (error) {
      logger.error(`Failed to publish update: ${error.message}`);
      throw new AppError('Failed to publish update', 500);
    }
  }

  /**
   * Shutdown sync service
   */
  async shutdown() {
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.ws.close();
      this.handleClientDisconnect(clientId);
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close Redis connections
    await Promise.all([
      this.pubClient.quit(),
      this.subClient.quit()
    ]);
  }
}

// Export singleton instance
module.exports = new SyncService();