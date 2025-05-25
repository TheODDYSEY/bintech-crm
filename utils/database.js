const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Database connection manager
 */
class Database {
  constructor() {
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryInterval = 5000; // 5 seconds
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      if (this.connection) {
        return this.connection;
      }

      // Set mongoose options
      mongoose.set('strictQuery', true);
      
      // Connect to MongoDB
      this.connection = await mongoose.connect(config.db.uri, config.db.options);
      
      // Reset retry count on successful connection
      this.retryCount = 0;
      
      logger.info('Successfully connected to MongoDB');
      
      // Handle connection events
      mongoose.connection.on('error', this.handleError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));
      
      return this.connection;
    } catch (error) {
      return this.handleConnectionError(error);
    }
  }

  /**
   * Handle connection errors
   * @param {Error} error - Connection error
   */
  async handleConnectionError(error) {
    logger.error(`MongoDB connection error: ${error.message}`);

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      logger.info(`Retrying connection... Attempt ${this.retryCount} of ${this.maxRetries}`);
      
      await new Promise(resolve => setTimeout(resolve, this.retryInterval));
      return this.connect();
    }

    throw new Error('Failed to connect to MongoDB after maximum retry attempts');
  }

  /**
   * Handle connection errors after initial connection
   * @param {Error} error - Connection error
   */
  handleError(error) {
    logger.error(`MongoDB error: ${error.message}`);
  }

  /**
   * Handle disconnection events
   */
  handleDisconnect() {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
    this.connect();
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.connection) {
      await mongoose.connection.close();
      this.connection = null;
      logger.info('MongoDB connection closed');
    }
  }

  /**
   * Get current connection status
   * @returns {number} Mongoose connection state
   */
  getConnectionState() {
    return mongoose.connection.readyState;
  }

  /**
   * Check if connected to database
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.getConnectionState() === 1;
  }

  /**
   * Create indexes for a collection
   * @param {string} modelName - Mongoose model name
   * @param {Object[]} indexes - Array of index specifications
   */
  async createIndexes(modelName, indexes) {
    try {
      const model = mongoose.model(modelName);
      await model.collection.createIndexes(indexes);
      logger.info(`Created indexes for ${modelName}`);
    } catch (error) {
      logger.error(`Error creating indexes for ${modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute in transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise} Transaction result
   */
  async executeTransaction(callback) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check database health
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        connectionState: this.getConnectionState(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connectionState: this.getConnectionState(),
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
module.exports = new Database();