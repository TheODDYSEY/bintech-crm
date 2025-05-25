const cron = require('node-cron');
const config = require('../config/config');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const backupService = require('./backupService');
const queueService = require('./queueService');

/**
 * Task service for handling scheduled tasks and automation
 */
class TaskService {
  constructor() {
    this.tasks = new Map();
    this.initializeDefaultTasks();
  }

  /**
   * Initialize default system tasks
   */
  initializeDefaultTasks() {
    // Daily backup at 2 AM
    this.scheduleTask('daily-backup', '0 2 * * *', async () => {
      try {
        await backupService.createBackup('system', 'system@backup');
        await backupService.cleanupOldBackups(30); // Keep 30 days of backups
      } catch (error) {
        logger.error(`Daily backup failed: ${error.message}`);
      }
    });

    // Cleanup old export files every 6 hours
    this.scheduleTask('cleanup-exports', '0 */6 * * *', async () => {
      try {
        await queueService.cleanupQueue.add({
          type: 'cleanup',
          target: 'exports',
          maxAge: 24 // hours
        });
      } catch (error) {
        logger.error(`Export cleanup failed: ${error.message}`);
      }
    });

    // Send follow-up reminders at 9 AM
    this.scheduleTask('followup-reminders', '0 9 * * *', async () => {
      try {
        await this.sendFollowUpReminders();
      } catch (error) {
        logger.error(`Follow-up reminders failed: ${error.message}`);
      }
    });

    // Update lead probabilities at midnight
    this.scheduleTask('update-probabilities', '0 0 * * *', async () => {
      try {
        await this.updateLeadProbabilities();
      } catch (error) {
        logger.error(`Probability update failed: ${error.message}`);
      }
    });

    // Generate daily reports at 6 AM
    this.scheduleTask('daily-reports', '0 6 * * *', async () => {
      try {
        await this.generateDailyReports();
      } catch (error) {
        logger.error(`Daily reports failed: ${error.message}`);
      }
    });
  }

  /**
   * Schedule a new task
   * @param {string} taskId - Task identifier
   * @param {string} schedule - Cron schedule expression
   * @param {Function} handler - Task handler function
   * @returns {boolean} Success status
   */
  scheduleTask(taskId, schedule, handler) {
    try {
      if (!cron.validate(schedule)) {
        throw new Error('Invalid cron schedule');
      }

      if (this.tasks.has(taskId)) {
        this.tasks.get(taskId).stop();
      }

      const task = cron.schedule(schedule, async () => {
        try {
          await handler();

          // Log successful execution
          await auditService.log({
            action: 'task_executed',
            metadata: { taskId, schedule },
            userId: 'system',
            userEmail: 'system@task'
          });
        } catch (error) {
          logger.error(`Task ${taskId} execution failed: ${error.message}`);
        }
      });

      this.tasks.set(taskId, task);
      logger.info(`Task ${taskId} scheduled with cron: ${schedule}`);
      return true;
    } catch (error) {
      logger.error(`Failed to schedule task ${taskId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop a scheduled task
   * @param {string} taskId - Task identifier
   * @returns {boolean} Success status
   */
  stopTask(taskId) {
    try {
      const task = this.tasks.get(taskId);
      if (task) {
        task.stop();
        this.tasks.delete(taskId);
        logger.info(`Task ${taskId} stopped`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to stop task ${taskId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all scheduled tasks
   * @returns {Array} List of scheduled tasks
   */
  getScheduledTasks() {
    return Array.from(this.tasks.keys()).map(taskId => ({
      taskId,
      schedule: this.tasks.get(taskId).options.scheduled
    }));
  }

  /**
   * Send follow-up reminders
   * @returns {Promise<void>}
   */
  async sendFollowUpReminders() {
    const Lead = require('../models/leads');
    const Contact = require('../models/contacts');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find leads requiring follow-up
    const leads = await Lead.find({
      'followUp.date': {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      },
      'followUp.completed': false
    }).populate('assignedTo');

    // Send reminders for each lead
    for (const lead of leads) {
      if (lead.assignedTo) {
        await notificationService.sendFollowUpReminder(
          lead.assignedTo.email,
          lead
        );
      }
    }

    // Find contacts requiring follow-up
    const contacts = await Contact.find({
      'followUp.date': {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      },
      'followUp.completed': false
    }).populate('assignedTo');

    // Send reminders for each contact
    for (const contact of contacts) {
      if (contact.assignedTo) {
        await notificationService.sendFollowUpReminder(
          contact.assignedTo.email,
          contact
        );
      }
    }
  }

  /**
   * Update lead probabilities
   * @returns {Promise<void>}
   */
  async updateLeadProbabilities() {
    const Lead = require('../models/leads');

    const leads = await Lead.find({
      stage: { $ne: 'closed' }
    });

    for (const lead of leads) {
      // Calculate new probability based on various factors
      const newProbability = await this.calculateLeadProbability(lead);

      if (newProbability !== lead.probability) {
        lead.probability = newProbability;
        await lead.save();

        // Log probability update
        await auditService.log({
          entityId: lead._id,
          entityType: 'lead',
          action: 'probability_updated',
          metadata: {
            oldProbability: lead.probability,
            newProbability
          },
          userId: 'system',
          userEmail: 'system@task'
        });
      }
    }
  }

  /**
   * Calculate lead probability
   * @param {Object} lead - Lead object
   * @returns {Promise<number>} Calculated probability
   */
  async calculateLeadProbability(lead) {
    let probability = 0;

    // Base probability by stage
    const stageProbabilities = {
      'new': 20,
      'contacted': 30,
      'qualified': 50,
      'proposal': 70,
      'negotiation': 85,
      'won': 100,
      'lost': 0
    };

    probability = stageProbabilities[lead.stage] || 0;

    // Adjust based on engagement level
    if (lead.notes && lead.notes.length > 0) {
      probability += Math.min(10, lead.notes.length * 2);
    }

    // Adjust based on last contact
    if (lead.lastContactDate) {
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(lead.lastContactDate)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceContact > 30) {
        probability -= 10;
      } else if (daysSinceContact > 14) {
        probability -= 5;
      }
    }

    // Ensure probability stays within bounds
    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Generate daily reports
   * @returns {Promise<void>}
   */
  async generateDailyReports() {
    const analyticsService = require('./analyticsService');

    try {
      // Generate various reports
      const [pipeline, sales, engagement] = await Promise.all([
        analyticsService.getLeadPipelineAnalytics(),
        analyticsService.getSalesPerformanceAnalytics(),
        analyticsService.getContactEngagementAnalytics()
      ]);

      // Send reports to administrators
      const User = require('../models/users');
      const admins = await User.find({ role: 'admin' });

      for (const admin of admins) {
        await notificationService.sendDailyReport(
          admin.email,
          {
            pipeline,
            sales,
            engagement
          }
        );
      }
    } catch (error) {
      logger.error(`Failed to generate daily reports: ${error.message}`);
      throw new AppError('Failed to generate daily reports', 500);
    }
  }

  /**
   * Shutdown task service
   */
  shutdown() {
    for (const [taskId, task] of this.tasks) {
      task.stop();
      logger.info(`Task ${taskId} stopped during shutdown`);
    }
    this.tasks.clear();
  }
}

// Export singleton instance
module.exports = new TaskService();