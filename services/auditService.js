const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Audit schema definition
 */
const auditSchema = new mongoose.Schema({
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['user', 'contact', 'lead', 'deal'],
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'view', 'export', 'import', 'login', 'logout', 'reset_password']
  },
  changes: {
    type: Map,
    of: {
      old: mongoose.Schema.Types.Mixed,
      new: mongoose.Schema.Types.Mixed
    }
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create indexes
auditSchema.index({ entityId: 1, timestamp: -1 });
auditSchema.index({ userId: 1, timestamp: -1 });
auditSchema.index({ entityType: 1, action: 1, timestamp: -1 });

const Audit = mongoose.model('Audit', auditSchema);

/**
 * Audit service class
 */
class AuditService {
  /**
   * Log audit event
   * @param {Object} data - Audit data
   * @returns {Promise<Object>} Created audit entry
   */
  async log(data) {
    try {
      const audit = new Audit(data);
      await audit.save();
      logger.info(`Audit log created: ${audit._id}`);
      return audit;
    } catch (error) {
      logger.error(`Audit log error: ${error.message}`);
      // Don't throw error to prevent disrupting main operations
    }
  }

  /**
   * Get audit trail for entity
   * @param {string} entityId - Entity ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Array>} Audit trail
   */
  async getEntityAuditTrail(entityId, query = {}) {
    try {
      const { page = 1, limit = 50, startDate, endDate } = query;
      const skip = (page - 1) * limit;

      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate);
      }

      const filter = {
        entityId: mongoose.Types.ObjectId(entityId)
      };

      if (Object.keys(dateFilter).length > 0) {
        filter.timestamp = dateFilter;
      }

      return await Audit.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`Audit trail retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user activity history
   * @param {string} userId - User ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Array>} Activity history
   */
  async getUserActivityHistory(userId, query = {}) {
    try {
      const { page = 1, limit = 50, startDate, endDate, actions } = query;
      const skip = (page - 1) * limit;

      const filter = {
        userId: mongoose.Types.ObjectId(userId)
      };

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      if (actions && actions.length > 0) {
        filter.action = { $in: actions };
      }

      return await Audit.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`User activity retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get activity statistics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Activity statistics
   */
  async getActivityStatistics(query = {}) {
    try {
      const { startDate, endDate } = query;

      const matchStage = {};
      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = new Date(startDate);
        if (endDate) matchStage.timestamp.$lte = new Date(endDate);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              entityType: '$entityType',
              action: '$action'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.entityType',
            actions: {
              $push: {
                action: '$_id.action',
                count: '$count'
              }
            },
            totalActions: { $sum: '$count' }
          }
        }
      ];

      return await Audit.aggregate(pipeline);
    } catch (error) {
      logger.error(`Activity statistics error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get security audit logs
   * @param {Object} query - Query parameters
   * @returns {Promise<Array>} Security logs
   */
  async getSecurityAuditLogs(query = {}) {
    try {
      const { page = 1, limit = 50, startDate, endDate } = query;
      const skip = (page - 1) * limit;

      const filter = {
        action: { 
          $in: ['login', 'logout', 'reset_password']
        }
      };

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      return await Audit.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      logger.error(`Security audit logs error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   * @param {number} days - Days to keep
   */
  async cleanupOldLogs(days = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await Audit.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
    } catch (error) {
      logger.error(`Audit cleanup error: ${error.message}`);
      // Don't throw error to prevent disrupting cleanup job
    }
  }
}

// Export singleton instance
module.exports = new AuditService();