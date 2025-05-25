const mongoose = require('mongoose');
const semver = require('semver');
const config = require('../config/config');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

/**
 * Migration service for handling data migrations and schema versioning
 */
class MigrationService {
  constructor() {
    this.migrations = new Map();
    this.currentVersion = '1.0.0';
  }

  /**
   * Register a migration
   * @param {string} version - Migration version
   * @param {Function} up - Migration up function
   * @param {Function} down - Migration down function
   */
  registerMigration(version, up, down) {
    if (!semver.valid(version)) {
      throw new Error('Invalid version number');
    }

    this.migrations.set(version, { up, down });
  }

  /**
   * Get current database version
   * @returns {Promise<string>} Current version
   */
  async getCurrentVersion() {
    try {
      const versionDoc = await mongoose.connection.db
        .collection('migrations')
        .findOne({ _id: 'version' });

      return versionDoc ? versionDoc.version : '0.0.0';
    } catch (error) {
      logger.error(`Failed to get current version: ${error.message}`);
      throw new AppError('Failed to get database version', 500);
    }
  }

  /**
   * Set current database version
   * @param {string} version - Version to set
   * @returns {Promise<void>}
   */
  async setCurrentVersion(version) {
    try {
      await mongoose.connection.db
        .collection('migrations')
        .updateOne(
          { _id: 'version' },
          { $set: { version, updatedAt: new Date() } },
          { upsert: true }
        );
    } catch (error) {
      logger.error(`Failed to set current version: ${error.message}`);
      throw new AppError('Failed to update database version', 500);
    }
  }

  /**
   * Run migrations up to target version
   * @param {string} targetVersion - Target version
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Migration results
   */
  async migrate(targetVersion, userId, userEmail) {
    try {
      const currentVersion = await this.getCurrentVersion();
      const results = {
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrations: [],
        errors: []
      };

      // Get sorted versions between current and target
      const versions = Array.from(this.migrations.keys())
        .filter(version => {
          return semver.gt(version, currentVersion) && 
                 semver.lte(version, targetVersion);
        })
        .sort(semver.compare);

      // Start session for atomic migrations
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        for (const version of versions) {
          const migration = this.migrations.get(version);
          
          try {
            // Run migration
            await migration.up(session);
            
            // Update version
            await this.setCurrentVersion(version);

            // Log success
            results.migrations.push({
              version,
              status: 'success'
            });

            // Log audit
            await auditService.log({
              action: 'migration_applied',
              metadata: { version, direction: 'up' },
              userId,
              userEmail
            });
          } catch (error) {
            results.errors.push({
              version,
              error: error.message
            });
            throw error; // Trigger rollback
          }
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      // Send notification
      if (results.migrations.length > 0) {
        await notificationService.sendMigrationComplete(userEmail, results);
      }

      return results;
    } catch (error) {
      logger.error(`Migration failed: ${error.message}`);
      throw new AppError('Failed to run migrations', 500);
    }
  }

  /**
   * Rollback migrations down to target version
   * @param {string} targetVersion - Target version
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Rollback results
   */
  async rollback(targetVersion, userId, userEmail) {
    try {
      const currentVersion = await this.getCurrentVersion();
      const results = {
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrations: [],
        errors: []
      };

      // Get sorted versions between current and target
      const versions = Array.from(this.migrations.keys())
        .filter(version => {
          return semver.lt(version, currentVersion) && 
                 semver.gte(version, targetVersion);
        })
        .sort((a, b) => semver.compare(b, a)); // Reverse order for rollback

      // Start session for atomic rollbacks
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        for (const version of versions) {
          const migration = this.migrations.get(version);
          
          try {
            // Run rollback
            await migration.down(session);
            
            // Update version
            await this.setCurrentVersion(version);

            // Log success
            results.migrations.push({
              version,
              status: 'success'
            });

            // Log audit
            await auditService.log({
              action: 'migration_rolled_back',
              metadata: { version, direction: 'down' },
              userId,
              userEmail
            });
          } catch (error) {
            results.errors.push({
              version,
              error: error.message
            });
            throw error; // Trigger rollback
          }
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      // Send notification
      if (results.migrations.length > 0) {
        await notificationService.sendRollbackComplete(userEmail, results);
      }

      return results;
    } catch (error) {
      logger.error(`Rollback failed: ${error.message}`);
      throw new AppError('Failed to rollback migrations', 500);
    }
  }

  /**
   * Get migration history
   * @returns {Promise<Array>} Migration history
   */
  async getMigrationHistory() {
    try {
      return await mongoose.connection.db
        .collection('migrations')
        .find({ _id: { $ne: 'version' } })
        .sort({ appliedAt: -1 })
        .toArray();
    } catch (error) {
      logger.error(`Failed to get migration history: ${error.message}`);
      throw new AppError('Failed to get migration history', 500);
    }
  }

  /**
   * Check if database needs migration
   * @returns {Promise<boolean>} Needs migration
   */
  async needsMigration() {
    try {
      const currentVersion = await this.getCurrentVersion();
      return semver.lt(currentVersion, this.currentVersion);
    } catch (error) {
      logger.error(`Failed to check migration status: ${error.message}`);
      throw new AppError('Failed to check migration status', 500);
    }
  }

  /**
   * Create a backup before migration
   * @returns {Promise<string>} Backup file path
   */
  async createMigrationBackup() {
    try {
      const backupService = require('./backupService');
      return await backupService.createBackup('system', 'system@migration');
    } catch (error) {
      logger.error(`Failed to create migration backup: ${error.message}`);
      throw new AppError('Failed to create migration backup', 500);
    }
  }
}

// Export singleton instance
module.exports = new MigrationService();