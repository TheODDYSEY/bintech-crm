const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const multer = require('multer');
const config = require('../config/config');
const logger = require('./logger');
const Security = require('./security');
const { UPLOAD_TYPES } = require('./constants');

/**
 * File handling utility
 */
class FileHandler {
  constructor() {
    this.uploadDir = config.upload.directory;
    this.maxFileSize = config.upload.maxSize;
    this.allowedTypes = config.upload.allowedTypes;

    // Ensure upload directory exists
    this.initializeUploadDirectory();
  }

  /**
   * Initialize upload directory
   */
  async initializeUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Configure multer storage
   */
  configureStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });
  }

  /**
   * Configure multer upload
   * @param {string} type - Upload type
   * @returns {Object} Multer upload configuration
   */
  getUploadConfig(type) {
    const config = {
      storage: this.configureStorage(),
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        if (!Security.isValidFileType(file.mimetype, this.allowedTypes)) {
          return cb(new Error('File type not allowed'), false);
        }
        cb(null, true);
      }
    };

    switch (type) {
      case UPLOAD_TYPES.CONTACT_IMPORT:
      case UPLOAD_TYPES.LEAD_IMPORT:
        config.limits.files = 1;
        break;
      case UPLOAD_TYPES.DEAL_ATTACHMENT:
        config.limits.files = 5;
        break;
      default:
        config.limits.files = 1;
    }

    return multer(config);
  }

  /**
   * Read CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Array>} Parsed CSV data
   */
  async readCSV(filePath) {
    const results = [];
    const cleanPath = Security.cleanFilePath(filePath);
    const fullPath = path.join(this.uploadDir, cleanPath);

    try {
      await fs.access(fullPath);

      return new Promise((resolve, reject) => {
        fs.createReadStream(fullPath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            // Delete file after processing
            this.deleteFile(fullPath);
            resolve(results);
          })
          .on('error', reject);
      });
    } catch (error) {
      logger.error(`CSV read error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write to CSV file
   * @param {Array} data - Data to write
   * @param {string} filename - Output filename
   * @returns {Promise<string>} Path to created file
   */
  async writeCSV(data, filename) {
    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      const cleanFilename = Security.cleanFilePath(filename);
      const filePath = path.join(this.uploadDir, cleanFilename);

      await fs.writeFile(filePath, csv);
      return filePath;
    } catch (error) {
      logger.error(`CSV write error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete file
   * @param {string} filePath - Path to file
   */
  async deleteFile(filePath) {
    try {
      const cleanPath = Security.cleanFilePath(filePath);
      await fs.unlink(cleanPath);
      logger.info(`Deleted file: ${cleanPath}`);
    } catch (error) {
      logger.error(`File deletion error: ${error.message}`);
      // Don't throw error for deletion failures
    }
  }

  /**
   * Clean up old files
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) { // Default 24 hours
    try {
      const files = await fs.readdir(this.uploadDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await this.deleteFile(filePath);
        }
      }
    } catch (error) {
      logger.error(`Cleanup error: ${error.message}`);
    }
  }

  /**
   * Move file
   * @param {string} oldPath - Current file path
   * @param {string} newPath - New file path
   */
  async moveFile(oldPath, newPath) {
    try {
      const cleanOldPath = Security.cleanFilePath(oldPath);
      const cleanNewPath = Security.cleanFilePath(newPath);

      await fs.rename(cleanOldPath, cleanNewPath);
      logger.info(`Moved file from ${cleanOldPath} to ${cleanNewPath}`);
    } catch (error) {
      logger.error(`File move error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get file stats
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File stats
   */
  async getFileStats(filePath) {
    try {
      const cleanPath = Security.cleanFilePath(filePath);
      const stats = await fs.stat(cleanPath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch (error) {
      logger.error(`File stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} Exists status
   */
  async fileExists(filePath) {
    try {
      const cleanPath = Security.cleanFilePath(filePath);
      await fs.access(cleanPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new FileHandler();