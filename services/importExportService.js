const csv = require('csv-parser');
const { Parser } = require('json2csv');
const Contact = require('../models/contacts');
const Lead = require('../models/leads');
const fileHandler = require('../utils/fileHandler');
const logger = require('../utils/logger');
const { validate } = require('../utils/validation');
const AppError = require('../utils/appError');
const notificationService = require('./notificationService');
const auditService = require('./auditService');

/**
 * Import/Export service class
 */
class ImportExportService {
  /**
   * Import contacts from CSV
   * @param {string} filePath - CSV file path
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Import results
   */
  async importContacts(filePath, userId, userEmail) {
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const rows = await fileHandler.readCSV(filePath);
      results.total = rows.length;

      for (let [index, row] of rows.entries()) {
        try {
          // Validate row data
          const { isValid, errors, value } = validate(row, 'contact.create');
          if (!isValid) {
            throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
          }

          // Check for existing contact
          const existing = await Contact.findOne({
            $or: [
              { email: value.email },
              { phone: value.phone }
            ]
          });

          if (existing) {
            results.duplicates++;
            results.errors.push({
              row: index + 2, // Account for header row and 0-based index
              message: `Duplicate contact found with email ${value.email} or phone ${value.phone}`
            });
            continue;
          }

          // Create contact
          const contact = new Contact(value);
          await contact.save();

          // Log audit
          await auditService.log({
            entityId: contact._id,
            entityType: 'contact',
            action: 'import',
            userId,
            userEmail
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: index + 2,
            message: error.message
          });
        }
      }

      // Send import results notification
      await notificationService.sendImportResults(userEmail, results);

      return results;
    } catch (error) {
      logger.error(`Contact import error: ${error.message}`);
      throw new AppError('Failed to import contacts', 500);
    }
  }

  /**
   * Import leads from CSV
   * @param {string} filePath - CSV file path
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<Object>} Import results
   */
  async importLeads(filePath, userId, userEmail) {
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: []
    };

    try {
      const rows = await fileHandler.readCSV(filePath);
      results.total = rows.length;

      for (let [index, row] of rows.entries()) {
        try {
          // Validate row data
          const { isValid, errors, value } = validate(row, 'lead.create');
          if (!isValid) {
            throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
          }

          // Check for existing lead
          const existing = await Lead.findOne({
            $or: [
              { email: value.email },
              { phone: value.phone }
            ]
          });

          if (existing) {
            results.duplicates++;
            results.errors.push({
              row: index + 2,
              message: `Duplicate lead found with email ${value.email} or phone ${value.phone}`
            });
            continue;
          }

          // Create lead
          const lead = new Lead(value);
          await lead.save();

          // Log audit
          await auditService.log({
            entityId: lead._id,
            entityType: 'lead',
            action: 'import',
            userId,
            userEmail
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: index + 2,
            message: error.message
          });
        }
      }

      // Send import results notification
      await notificationService.sendImportResults(userEmail, results);

      return results;
    } catch (error) {
      logger.error(`Lead import error: ${error.message}`);
      throw new AppError('Failed to import leads', 500);
    }
  }

  /**
   * Export contacts to CSV
   * @param {Object} query - Query parameters
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<string>} CSV file path
   */
  async exportContacts(query, userId, userEmail) {
    try {
      // Build query
      const filter = {};
      if (query.status) filter.status = query.status;
      if (query.type) filter.type = query.type;

      // Get contacts
      const contacts = await Contact.find(filter)
        .select('-__v -customFields._id')
        .lean();

      if (contacts.length === 0) {
        throw new AppError('No contacts found to export', 404);
      }

      // Transform data for CSV
      const transformedContacts = contacts.map(contact => ({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        position: contact.position,
        type: contact.type,
        status: contact.status,
        source: contact.source,
        notes: contact.notes,
        tags: contact.tags.join(', '),
        createdAt: contact.createdAt.toISOString()
      }));

      // Generate CSV
      const parser = new Parser();
      const csv = parser.parse(transformedContacts);

      // Save to file
      const filename = `contacts_export_${Date.now()}.csv`;
      const filePath = await fileHandler.writeCSV(csv, filename);

      // Log audit
      await auditService.log({
        entityType: 'contact',
        action: 'export',
        metadata: { count: contacts.length },
        userId,
        userEmail
      });

      return filePath;
    } catch (error) {
      logger.error(`Contact export error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export leads to CSV
   * @param {Object} query - Query parameters
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @returns {Promise<string>} CSV file path
   */
  async exportLeads(query, userId, userEmail) {
    try {
      // Build query
      const filter = {};
      if (query.stage) filter.stage = query.stage;
      if (query.minAmount) filter.amount = { $gte: parseFloat(query.minAmount) };
      if (query.maxAmount) {
        filter.amount = { ...filter.amount, $lte: parseFloat(query.maxAmount) };
      }

      // Get leads
      const leads = await Lead.find(filter)
        .select('-__v -customFields._id')
        .lean();

      if (leads.length === 0) {
        throw new AppError('No leads found to export', 404);
      }

      // Transform data for CSV
      const transformedLeads = leads.map(lead => ({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        amount: lead.amount,
        stage: lead.stage,
        source: lead.source,
        product: lead.product,
        probability: lead.probability,
        expectedCloseDate: lead.expectedCloseDate?.toISOString(),
        notes: lead.notes,
        tags: lead.tags.join(', '),
        createdAt: lead.createdAt.toISOString()
      }));

      // Generate CSV
      const parser = new Parser();
      const csv = parser.parse(transformedLeads);

      // Save to file
      const filename = `leads_export_${Date.now()}.csv`;
      const filePath = await fileHandler.writeCSV(csv, filename);

      // Log audit
      await auditService.log({
        entityType: 'lead',
        action: 'export',
        metadata: { count: leads.length },
        userId,
        userEmail
      });

      return filePath;
    } catch (error) {
      logger.error(`Lead export error: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ImportExportService();