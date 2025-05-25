const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

/**
 * Notification service class
 */
class NotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport(config.email.smtp);
    this.defaultFrom = config.email.from;
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html
      };

      if (options.attachments) {
        mailOptions.attachments = options.attachments;
      }

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}: ${options.subject}`);
      return result;
    } catch (error) {
      logger.error(`Email send error: ${error.message}`);
      throw new AppError('Failed to send email', 500);
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} resetToken - Reset token
   */
  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html
    });
  }

  /**
   * Send welcome email
   * @param {string} email - User email
   * @param {string} username - Username
   */
  async sendWelcomeEmail(email, username) {
    const html = `
      <h1>Welcome to Bintech CRM!</h1>
      <p>Hello ${username},</p>
      <p>Welcome to Bintech CRM. We're excited to have you on board!</p>
      <p>Get started by logging in to your account:</p>
      <a href="${config.frontendUrl}/login">Login to Your Account</a>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Bintech CRM',
      html
    });
  }

  /**
   * Send lead assignment notification
   * @param {Object} lead - Lead object
   * @param {Object} assignee - User object
   */
  async sendLeadAssignmentNotification(lead, assignee) {
    const html = `
      <h2>New Lead Assigned</h2>
      <p>A new lead has been assigned to you:</p>
      <ul>
        <li><strong>Name:</strong> ${lead.name}</li>
        <li><strong>Company:</strong> ${lead.company}</li>
        <li><strong>Email:</strong> ${lead.email}</li>
        <li><strong>Phone:</strong> ${lead.phone}</li>
        <li><strong>Amount:</strong> $${lead.amount}</li>
        <li><strong>Stage:</strong> ${lead.stage}</li>
      </ul>
      <p>Please review and follow up as soon as possible.</p>
      <a href="${config.frontendUrl}/leads/${lead._id}">View Lead Details</a>
    `;

    await this.sendEmail({
      to: assignee.email,
      subject: 'New Lead Assignment',
      html
    });
  }

  /**
   * Send lead stage update notification
   * @param {Object} lead - Lead object
   * @param {string} oldStage - Previous stage
   * @param {Object} assignee - User object
   */
  async sendLeadStageUpdateNotification(lead, oldStage, assignee) {
    const html = `
      <h2>Lead Stage Updated</h2>
      <p>A lead has been moved to a new stage:</p>
      <ul>
        <li><strong>Name:</strong> ${lead.name}</li>
        <li><strong>Company:</strong> ${lead.company}</li>
        <li><strong>Previous Stage:</strong> ${oldStage}</li>
        <li><strong>New Stage:</strong> ${lead.stage}</li>
        <li><strong>Amount:</strong> $${lead.amount}</li>
      </ul>
      <a href="${config.frontendUrl}/leads/${lead._id}">View Lead Details</a>
    `;

    await this.sendEmail({
      to: assignee.email,
      subject: 'Lead Stage Updated',
      html
    });
  }

  /**
   * Send task reminder
   * @param {Object} task - Task object
   * @param {Object} assignee - User object
   */
  async sendTaskReminder(task, assignee) {
    const html = `
      <h2>Task Reminder</h2>
      <p>This is a reminder for your upcoming task:</p>
      <ul>
        <li><strong>Title:</strong> ${task.title}</li>
        <li><strong>Due Date:</strong> ${task.dueDate.toLocaleDateString()}</li>
        <li><strong>Priority:</strong> ${task.priority}</li>
        <li><strong>Description:</strong> ${task.description}</li>
      </ul>
      <a href="${config.frontendUrl}/tasks/${task._id}">View Task Details</a>
    `;

    await this.sendEmail({
      to: assignee.email,
      subject: 'Task Reminder',
      html
    });
  }

  /**
   * Send contact import results
   * @param {string} email - User email
   * @param {Object} results - Import results
   */
  async sendImportResults(email, results) {
    const html = `
      <h2>Import Results</h2>
      <p>Your import has been completed:</p>
      <ul>
        <li><strong>Total Processed:</strong> ${results.total}</li>
        <li><strong>Successfully Imported:</strong> ${results.success}</li>
        <li><strong>Failed:</strong> ${results.failed}</li>
        <li><strong>Duplicates Found:</strong> ${results.duplicates}</li>
      </ul>
      ${results.failed > 0 ? `
        <p>Failed entries:</p>
        <ul>
          ${results.errors.map(error => `
            <li>Row ${error.row}: ${error.message}</li>
          `).join('')}
        </ul>
      ` : ''}
      <a href="${config.frontendUrl}/contacts">View Contacts</a>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Import Results',
      html
    });
  }

  /**
   * Send security alert
   * @param {string} email - User email
   * @param {Object} alert - Alert details
   */
  async sendSecurityAlert(email, alert) {
    const html = `
      <h2>Security Alert</h2>
      <p>We detected the following security event on your account:</p>
      <ul>
        <li><strong>Event:</strong> ${alert.event}</li>
        <li><strong>Time:</strong> ${alert.timestamp}</li>
        <li><strong>IP Address:</strong> ${alert.ipAddress}</li>
        <li><strong>Location:</strong> ${alert.location}</li>
      </ul>
      <p>If this wasn't you, please secure your account immediately:</p>
      <a href="${config.frontendUrl}/security">Review Account Security</a>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Security Alert',
      html,
      priority: 'high'
    });
  }
}

// Export singleton instance
module.exports = new NotificationService();