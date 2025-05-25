const Contact = require('../models/contacts');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const { CACHE_KEYS, PAGINATION } = require('../utils/constants');
const AppError = require('../utils/appError');

/**
 * Contact service class
 */
class ContactService {
  /**
   * Create new contact
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} Created contact
   */
  async createContact(contactData) {
    try {
      // Check for existing contact
      const existingContact = await Contact.findOne({
        $or: [
          { email: contactData.email },
          { phone: contactData.phone }
        ]
      });

      if (existingContact) {
        throw new AppError('Contact with this email or phone already exists', 409);
      }

      const contact = new Contact(contactData);
      await contact.save();

      // Clear contacts list cache
      await cache.clearPattern(CACHE_KEYS.CONTACTS_LIST + '*');

      logger.info(`Created new contact: ${contact._id}`);
      return contact;
    } catch (error) {
      logger.error(`Contact creation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get contact by ID
   * @param {string} id - Contact ID
   * @returns {Promise<Object>} Contact
   */
  async getContactById(id) {
    try {
      const cacheKey = `${CACHE_KEYS.CONTACT_DETAILS}${id}`;
      
      // Check cache
      const cachedContact = await cache.get(cacheKey);
      if (cachedContact) {
        return cachedContact;
      }

      const contact = await Contact.findById(id);
      if (!contact) {
        throw new AppError('Contact not found', 404);
      }

      // Cache contact
      await cache.set(cacheKey, contact);

      return contact;
    } catch (error) {
      logger.error(`Contact retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get contacts with pagination
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated contacts
   */
  async getContacts(query) {
    try {
      const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
      const limit = parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const cacheKey = `${CACHE_KEYS.CONTACTS_LIST}:${page}:${limit}`;

      // Check cache
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build query
      const queryBuilder = Contact.find();

      // Apply filters
      if (query.status) {
        queryBuilder.where('status').equals(query.status);
      }
      if (query.type) {
        queryBuilder.where('type').equals(query.type);
      }
      if (query.assignedTo) {
        queryBuilder.where('assignedTo').equals(query.assignedTo);
      }

      // Apply search
      if (query.search) {
        queryBuilder.or([
          { name: new RegExp(query.search, 'i') },
          { email: new RegExp(query.search, 'i') },
          { company: new RegExp(query.search, 'i') }
        ]);
      }

      // Apply sort
      const sortField = query.sort || 'createdAt';
      const sortOrder = query.order === 'asc' ? 1 : -1;
      queryBuilder.sort({ [sortField]: sortOrder });

      // Execute query with pagination
      const [contacts, total] = await Promise.all([
        queryBuilder.skip(skip).limit(limit),
        Contact.countDocuments(queryBuilder.getQuery())
      ]);

      const result = {
        contacts,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      };

      // Cache result
      await cache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error(`Contacts retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update contact
   * @param {string} id - Contact ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated contact
   */
  async updateContact(id, updateData) {
    try {
      // Check for duplicate email/phone
      if (updateData.email || updateData.phone) {
        const existingContact = await Contact.findOne({
          _id: { $ne: id },
          $or: [
            { email: updateData.email },
            { phone: updateData.phone }
          ]
        });

        if (existingContact) {
          throw new AppError('Contact with this email or phone already exists', 409);
        }
      }

      const contact = await Contact.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!contact) {
        throw new AppError('Contact not found', 404);
      }

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.CONTACT_DETAILS}${id}`),
        cache.clearPattern(CACHE_KEYS.CONTACTS_LIST + '*')
      ]);

      logger.info(`Updated contact: ${id}`);
      return contact;
    } catch (error) {
      logger.error(`Contact update error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete contact
   * @param {string} id - Contact ID
   */
  async deleteContact(id) {
    try {
      const contact = await Contact.findByIdAndDelete(id);
      
      if (!contact) {
        throw new AppError('Contact not found', 404);
      }

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.CONTACT_DETAILS}${id}`),
        cache.clearPattern(CACHE_KEYS.CONTACTS_LIST + '*')
      ]);

      logger.info(`Deleted contact: ${id}`);
    } catch (error) {
      logger.error(`Contact deletion error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find duplicate contacts
   * @returns {Promise<Array>} Duplicate contacts
   */
  async findDuplicates() {
    try {
      return await Contact.findDuplicates();
    } catch (error) {
      logger.error(`Find duplicates error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge duplicate contacts
   * @param {string} primaryId - Primary contact ID
   * @param {string[]} duplicateIds - Duplicate contact IDs
   * @returns {Promise<Object>} Merged contact
   */
  async mergeDuplicates(primaryId, duplicateIds) {
    try {
      const [primary, ...duplicates] = await Promise.all([
        Contact.findById(primaryId),
        ...duplicateIds.map(id => Contact.findById(id))
      ]);

      if (!primary) {
        throw new AppError('Primary contact not found', 404);
      }

      // Merge fields
      duplicates.forEach(duplicate => {
        if (!duplicate) return;

        // Merge arrays
        primary.tags = [...new Set([...primary.tags, ...duplicate.tags])];
        
        // Merge objects
        primary.customFields = {
          ...duplicate.customFields,
          ...primary.customFields
        };

        // Keep most recent notes
        if (duplicate.notes) {
          primary.notes = primary.notes
            ? `${primary.notes}\n---\n${duplicate.notes}`
            : duplicate.notes;
        }
      });

      await primary.save();

      // Delete duplicates
      await Contact.deleteMany({ _id: { $in: duplicateIds } });

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.CONTACT_DETAILS}${primaryId}`),
        ...duplicateIds.map(id => cache.del(`${CACHE_KEYS.CONTACT_DETAILS}${id}`)),
        cache.clearPattern(CACHE_KEYS.CONTACTS_LIST + '*')
      ]);

      logger.info(`Merged contacts into ${primaryId}`);
      return primary;
    } catch (error) {
      logger.error(`Contact merge error: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ContactService();