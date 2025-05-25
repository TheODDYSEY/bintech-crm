const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../config/config');
const logger = require('../utils/logger');
const fileHandler = require('../utils/fileHandler');
const notificationService = require('./notificationService');
const auditService = require('./auditService');

/**
 * Backup service for handling data backup and restore operations
 */
class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.initializeBackupDirectory();
  }

  /**
   * Initialize backup directory
   */
  async initializeBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to initialize backup directory: ${error.message}`);
      throw new Error('Failed to initialize backup directory');
    }
  }

  /**
   * Create database backup
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<string>} Backup file path
   */
  async createBackup(userId, userEmail) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.gz`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Build mongodump command
      const { uri, database } = config.mongodb;
      const command = `mongodump --uri="${uri}" --db=${database} --archive="${backupPath}" --gzip`;

      // Execute backup
      await execPromise(command);

      // Log audit
      await auditService.log({
        action: 'backup_created',
        metadata: { fileName: backupFileName },
        userId,
        userEmail
      });

      // Send notification
      await notificationService.sendBackupComplete(userEmail, backupFileName);

      return backupPath;
    } catch (error) {
      logger.error(`Backup creation failed: ${error.message}`);
      throw new Error('Failed to create backup');
    }
  }

  /**
   * Restore database from backup
   * @param {string} backupPath - Path to backup file
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<void>}
   */
  async restoreBackup(backupPath, userId, userEmail) {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      // Build mongorestore command
      const { uri, database } = config.mongodb;
      const command = `mongorestore --uri="${uri}" --db=${database} --archive="${backupPath}" --gzip --drop`;

      // Execute restore
      await execPromise(command);

      // Log audit
      await auditService.log({
        action: 'backup_restored',
        metadata: { fileName: path.basename(backupPath) },
        userId,
        userEmail
      });

      // Send notification
      await notificationService.sendRestoreComplete(userEmail);
    } catch (error) {
      logger.error(`Backup restore failed: ${error.message}`);
      throw new Error('Failed to restore backup');
    }
  }

  /**
   * List available backups
   * @returns {Promise<Array>} List of backup files with metadata
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.gz')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);

          backups.push({
            fileName: file,
            size: stats.size,
            createdAt: stats.birthtime,
            path: filePath
          });
        }
      }

      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      logger.error(`Failed to list backups: ${error.message}`);
      throw new Error('Failed to list backups');
    }
  }

  /**
   * Delete backup file
   * @param {string} backupPath - Path to backup file
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<void>}
   */
  async deleteBackup(backupPath, userId, userEmail) {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      // Delete file
      await fs.unlink(backupPath);

      // Log audit
      await auditService.log({
        action: 'backup_deleted',
        metadata: { fileName: path.basename(backupPath) },
        userId,
        userEmail
      });
    } catch (error) {
      logger.error(`Failed to delete backup: ${error.message}`);
      throw new Error('Failed to delete backup');
    }
  }

  /**
   * Clean up old backups
   * @param {number} retentionDays - Number of days to retain backups
   * @returns {Promise<number>} Number of deleted backups
   */
  async cleanupOldBackups(retentionDays = 30) {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          await fs.unlink(backup.path);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backups`);
      }

      return deletedCount;
    } catch (error) {
      logger.error(`Backup cleanup failed: ${error.message}`);
      throw new Error('Failed to clean up old backups');
    }
  }

  /**
   * Schedule automatic backup
   * @param {string} cronSchedule - Cron schedule expression
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<void>}
   */
  async scheduleBackup(cronSchedule, userId, userEmail) {
    try {
      // Validate cron schedule
      if (!this.isValidCronExpression(cronSchedule)) {
        throw new Error('Invalid cron schedule expression');
      }

      // Create backup
      await this.createBackup(userId, userEmail);

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info(`Scheduled backup completed: ${new Date().toISOString()}`);
    } catch (error) {
      logger.error(`Scheduled backup failed: ${error.message}`);
      throw new Error('Failed to execute scheduled backup');
    }
  }

  /**
   * Validate cron expression
   * @param {string} cronExpression - Cron schedule expression
   * @returns {boolean} Is valid
   */
  isValidCronExpression(cronExpression) {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(cronExpression);
  }
}

// Export singleton instance
module.exports = new BackupService();