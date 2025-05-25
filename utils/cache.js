const Redis = require('redis');
const config = require('../config/config');
const logger = require('./logger');
const { CACHE_KEYS } = require('./constants');

/**
 * Redis cache manager
 */
class Cache {
  constructor() {
    this.client = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryInterval = 5000; // 5 seconds
    this.defaultTTL = config.redis.ttl;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      if (this.client) {
        return this.client;
      }

      this.client = Redis.createClient({
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              return new Error('Redis max retries reached');
            }
            return this.retryInterval;
          }
        }
      });

      // Handle Redis events
      this.client.on('error', (error) => {
        logger.error(`Redis Error: ${error.message}`);
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error(`Redis connection error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value
   */
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis get error: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Time to live in seconds
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: ttl
      });
    } catch (error) {
      logger.error(`Redis set error: ${error.message}`);
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Redis delete error: ${error.message}`);
    }
  }

  /**
   * Clear cache by pattern
   * @param {string} pattern - Key pattern to match
   */
  async clearPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Redis clear pattern error: ${error.message}`);
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Exists status
   */
  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis exists error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get time to live for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds
   */
  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error: ${error.message}`);
      return -1;
    }
  }

  /**
   * Cache middleware for Express routes
   * @param {string} key - Cache key or key pattern
   * @param {number} [ttl] - Time to live in seconds
   */
  cacheMiddleware(key, ttl = this.defaultTTL) {
    return async (req, res, next) => {
      try {
        // Generate dynamic key if function provided
        const cacheKey = typeof key === 'function' ? key(req) : key;
        
        // Check cache
        const cachedData = await this.get(cacheKey);
        
        if (cachedData) {
          return res.json(cachedData);
        }

        // Store original send
        const originalSend = res.json;

        // Override send
        res.json = async (body) => {
          // Restore original send
          res.json = originalSend;

          // Cache response
          await this.set(cacheKey, body, ttl);

          // Send response
          return res.json(body);
        };

        next();
      } catch (error) {
        logger.error(`Cache middleware error: ${error.message}`);
        next();
      }
    };
  }

  /**
   * Clear cache middleware
   * @param {string|string[]} patterns - Key pattern(s) to clear
   */
  clearCacheMiddleware(patterns) {
    return async (req, res, next) => {
      try {
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];
        
        // Store original send
        const originalSend = res.json;

        // Override send
        res.json = async (body) => {
          // Restore original send
          res.json = originalSend;

          // Clear cache patterns after successful response
          await Promise.all(patternArray.map(pattern => this.clearPattern(pattern)));

          // Send response
          return res.json(body);
        };

        next();
      } catch (error) {
        logger.error(`Clear cache middleware error: ${error.message}`);
        next();
      }
    };
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }

  /**
   * Check Redis health
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      await this.client.ping();
      return {
        status: 'healthy',
        connected: this.client?.isReady || false,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false,
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
module.exports = new Cache();