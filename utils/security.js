const bcrypt = require('bcrypt');
const crypto = require('crypto');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Security utility functions
 */
class Security {
  /**
   * Hash password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    try {
      return await bcrypt.hash(password, config.security.bcrypt.saltRounds);
    } catch (error) {
      logger.error(`Password hashing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Comparison result
   */
  static async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error(`Password comparison error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate random token
   * @param {number} [bytes=32] - Number of bytes
   * @returns {string} Random token
   */
  static generateToken(bytes = 32) {
    try {
      return crypto.randomBytes(bytes).toString('hex');
    } catch (error) {
      logger.error(`Token generation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate password reset token
   * @returns {Object} Reset token and expiry
   */
  static generateResetToken() {
    const resetToken = this.generateToken();
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    return {
      resetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
      resetTokenExpiry,
      plainToken: resetToken // This will be sent to user's email
    };
  }

  /**
   * Hash reset token
   * @param {string} token - Plain reset token
   * @returns {string} Hashed token
   */
  static hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Sanitize data against XSS
   * @param {Object|string} data - Data to sanitize
   * @returns {Object|string} Sanitized data
   */
  static sanitizeXSS(data) {
    if (typeof data === 'string') {
      return xss(data);
    }

    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).reduce((acc, key) => {
        acc[key] = this.sanitizeXSS(data[key]);
        return acc;
      }, Array.isArray(data) ? [] : {});
    }

    return data;
  }

  /**
   * Sanitize data against MongoDB injection
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  static sanitizeMongo(data) {
    return mongoSanitize.sanitize(data);
  }

  /**
   * Generate session ID
   * @returns {string} Session ID
   */
  static generateSessionId() {
    return this.generateToken(24);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password) {
    const result = {
      isValid: true,
      errors: []
    };

    // Length check
    if (password.length < 8) {
      result.errors.push('Password must be at least 8 characters long');
    }

    // Uppercase letter check
    if (!/[A-Z]/.test(password)) {
      result.errors.push('Password must contain at least one uppercase letter');
    }

    // Lowercase letter check
    if (!/[a-z]/.test(password)) {
      result.errors.push('Password must contain at least one lowercase letter');
    }

    // Number check
    if (!/\d/.test(password)) {
      result.errors.push('Password must contain at least one number');
    }

    // Special character check
    if (!/[!@#$%^&*]/.test(password)) {
      result.errors.push('Password must contain at least one special character');
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Mask sensitive data
   * @param {Object} data - Data to mask
   * @param {string[]} fields - Fields to mask
   * @returns {Object} Masked data
   */
  static maskSensitiveData(data, fields = ['password', 'token', 'secret']) {
    const masked = { ...data };

    fields.forEach(field => {
      if (masked[field]) {
        masked[field] = '********';
      }
    });

    return masked;
  }

  /**
   * Generate API key
   * @param {string} prefix - Key prefix
   * @returns {string} API key
   */
  static generateApiKey(prefix = 'bcrm') {
    const timestamp = Date.now().toString(36);
    const random = this.generateToken(8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Rate limit key generator
   * @param {Object} req - Express request object
   * @returns {string} Rate limit key
   */
  static getRateLimitKey(req) {
    return `${req.ip}_${req.path}`;
  }

  /**
   * Clean file path
   * @param {string} filePath - File path to clean
   * @returns {string} Cleaned file path
   */
  static cleanFilePath(filePath) {
    // Remove any parent directory references
    return filePath.replace(/\.\.\/|\.\./g, '');
  }

  /**
   * Validate file type
   * @param {string} mimetype - File mimetype
   * @param {string[]} allowedTypes - Allowed mimetypes
   * @returns {boolean} Validation result
   */
  static isValidFileType(mimetype, allowedTypes) {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Generate CSRF token
   * @returns {string} CSRF token
   */
  static generateCSRFToken() {
    return this.generateToken(16);
  }
}

module.exports = Security;