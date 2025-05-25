const Queue = require('bull');
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../utils/logger');
const fileHandler = require('../utils/fileHandler');
const importExportService = require('./importExportService');
const notificationService = require('./notificationService');

/**
 * Queue service for handling background tasks
 */
class QueueService {
  constructor() {
    this.redisClient = new Redis(config.redis);
    
    // Initialize queues
    this.importQueue = new Queue('import-tasks', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    this.exportQueue = new Queue('export-tasks', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 2,
        timeout: 300000, // 5 minutes
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    this.cleanupQueue = new Queue('cleanup-tasks', {
      redis: config.redis,
      defaultJobOptions: {
        removeOnComplete: true
      }
    });

    // Set up queue event handlers
    this.setupQueueHandlers();

    // Schedule cleanup job
    this.scheduleCleanup();
  }

  /**
   * Set up queue event handlers
   */
  setupQueueHandlers() {
    // Import queue handlers
    this.importQueue.process(async (job) => {
      const { filePath, type, userId, userEmail } = job.data;
      
      try {
        let results;
        if (type === 'contacts') {
          results = await importExportService.importContacts(filePath, userId, userEmail);
        } else if (type === 'leads') {
          results = await importExportService.importLeads(filePath, userId, userEmail);
        }

        // Clean up temporary file
        await fileHandler.deleteFile(filePath);

        return results;
      } catch (error) {
        logger.error(`Import job failed: ${error.message}`);
        throw error;
      }
    });

    // Export queue handlers
    this.exportQueue.process(async (job) => {
      const { type, query, userId, userEmail } = job.data;
      
      try {
        let filePath;
        if (type === 'contacts') {
          filePath = await importExportService.exportContacts(query, userId, userEmail);
        } else if (type === 'leads') {
          filePath = await importExportService.exportLeads(query, userId, userEmail);
        }

        // Send notification with download link
        await notificationService.sendExportComplete(userEmail, filePath);

        return { filePath };
      } catch (error) {
        logger.error(`Export job failed: ${error.message}`);
        throw error;
      }
    });

    // Cleanup queue handlers
    this.cleanupQueue.process(async () => {
      try {
        // Clean up old export files
        const expiryHours = 24;
        await fileHandler.cleanupOldFiles('exports', expiryHours);

        // Clean up failed imports
        await fileHandler.cleanupOldFiles('imports', 1); // 1 hour for failed imports

        logger.info('Cleanup job completed successfully');
      } catch (error) {
        logger.error(`Cleanup job failed: ${error.message}`);
        throw error;
      }
    });

    // Global error handlers
    [this.importQueue, this.exportQueue, this.cleanupQueue].forEach(queue => {
      queue.on('error', error => {
        logger.error(`Queue error: ${error.message}`);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed: ${error.message}`);
        notificationService.sendJobFailureAlert(job, error).catch(err => {
          logger.error(`Failed to send job failure alert: ${err.message}`);
        });
      });
    });
  }

  /**
   * Schedule cleanup job
   */
  scheduleCleanup() {
    // Run cleanup job every 6 hours
    this.cleanupQueue.add(
      {},
      {
        repeat: {
          cron: '0 */6 * * *' // Every 6 hours
        }
      }
    );
  }

  /**
   * Add import job to queue
   * @param {string} filePath - Path to import file
   * @param {string} type - Import type (contacts/leads)
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Job object
   */
  async addImportJob(filePath, type, userId, userEmail) {
    return this.importQueue.add({
      filePath,
      type,
      userId,
      userEmail
    });
  }

  /**
   * Add export job to queue
   * @param {string} type - Export type (contacts/leads)
   * @param {Object} query - Export query parameters
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Job object
   */
  async addExportJob(type, query, userId, userEmail) {
    return this.exportQueue.add({
      type,
      query,
      userId,
      userEmail
    });
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @param {string} type - Job type (import/export)
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId, type) {
    const queue = type === 'import' ? this.importQueue : this.exportQueue;
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;
    const error = job.failedReason;

    return {
      id: job.id,
      status: state,
      progress,
      result,
      error
    };
  }

  /**
   * Gracefully shut down queues
   */
  async shutdown() {
    await Promise.all([
      this.importQueue.close(),
      this.exportQueue.close(),
      this.cleanupQueue.close(),
      this.redisClient.quit()
    ]);
  }
}

// Export singleton instance
module.exports = new QueueService();