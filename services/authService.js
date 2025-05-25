const User = require('../models/users');
const Security = require('../utils/security');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const config = require('../config/config');

/**
 * Authentication service class
 */
class AuthService {
  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user
   */
  async register(userData) {
    try {
      // Check if user exists
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });

      if (existingUser) {
        throw new AppError('User with this email or username already exists', 409);
      }

      // Validate password strength
      const passwordValidation = Security.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        throw new AppError(passwordValidation.errors.join(', '), 400);
      }

      // Hash password
      const passwordHash = await Security.hashPassword(userData.password);

      // Create user
      const user = new User({
        ...userData,
        passwordHash,
        lastLogin: null,
        loginAttempts: 0,
        isActive: true
      });

      await user.save();

      logger.info(`Created new user: ${user._id}`);
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error(`User registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Authenticate user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Authenticated user
   */
  async login(email, password) {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      // Check if account is locked
      if (user.isLocked()) {
        const lockTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
        throw new AppError(`Account is locked. Try again in ${lockTime} minutes`, 423);
      }

      // Verify password
      const isValid = await Security.comparePassword(password, user.passwordHash);

      if (!isValid) {
        // Increment login attempts
        user.loginAttempts += 1;

        // Lock account if max attempts reached
        if (user.loginAttempts >= 5) {
          user.lockUntil = Date.now() + (60 * 60 * 1000); // 1 hour lock
        }

        await user.save();

        if (user.isLocked()) {
          throw new AppError('Account is locked due to too many failed attempts', 423);
        }

        throw new AppError('Invalid email or password', 401);
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lockUntil = null;
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in: ${user._id}`);
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Reset token info
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        // Don't reveal user existence
        return { message: 'If an account exists, a reset email will be sent' };
      }

      // Generate reset token
      const { resetToken, resetTokenExpiry, plainToken } = Security.generateResetToken();

      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

      logger.info(`Password reset requested for user: ${user._id}`);
      return { token: plainToken, email: user.email };
    } catch (error) {
      logger.error(`Password reset request error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset password
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Reset result
   */
  async resetPassword(token, newPassword) {
    try {
      // Hash token
      const hashedToken = Security.hashResetToken(token);

      const user = await User.findOne({
        resetToken: hashedToken,
        resetTokenExpiry: { $gt: Date.now() }
      });

      if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      // Validate password strength
      const passwordValidation = Security.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(passwordValidation.errors.join(', '), 400);
      }

      // Update password
      user.passwordHash = await Security.hashPassword(newPassword);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      logger.info(`Password reset completed for user: ${user._id}`);
      return { message: 'Password has been reset successfully' };
    } catch (error) {
      logger.error(`Password reset error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Change result
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isValid = await Security.comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new AppError('Current password is incorrect', 401);
      }

      // Validate new password strength
      const passwordValidation = Security.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(passwordValidation.errors.join(', '), 400);
      }

      // Update password
      user.passwordHash = await Security.hashPassword(newPassword);
      await user.save();

      logger.info(`Password changed for user: ${user._id}`);
      return { message: 'Password has been changed successfully' };
    } catch (error) {
      logger.error(`Password change error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(userId, updateData) {
    try {
      // Check for duplicate email/username
      if (updateData.email || updateData.username) {
        const existingUser = await User.findOne({
          _id: { $ne: userId },
          $or: [
            { email: updateData.email },
            { username: updateData.username }
          ]
        });

        if (existingUser) {
          throw new AppError('Email or username already taken', 409);
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new AppError('User not found', 404);
      }

      logger.info(`Updated profile for user: ${user._id}`);
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error(`Profile update error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deactivation result
   */
  async deactivateAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { isActive: false } },
        { new: true }
      );

      if (!user) {
        throw new AppError('User not found', 404);
      }

      logger.info(`Deactivated account for user: ${user._id}`);
      return { message: 'Account has been deactivated' };
    } catch (error) {
      logger.error(`Account deactivation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    const sanitized = user.toObject();
    delete sanitized.passwordHash;
    delete sanitized.resetToken;
    delete sanitized.resetTokenExpiry;
    delete sanitized.loginAttempts;
    delete sanitized.lockUntil;
    return sanitized;
  }
}

// Export singleton instance
module.exports = new AuthService();