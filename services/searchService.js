const Contact = require('../models/contacts');
const Lead = require('../models/leads');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');

/**
 * Search service for handling advanced search operations
 */
class SearchService {
  /**
   * Search contacts with advanced filtering and sorting
   * @param {Object} query - Search query parameters
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Object>} Search results with pagination info
   */
  async searchContacts(query, options = {}) {
    try {
      const {
        search,
        type,
        status,
        tags,
        assignedTo,
        createdAfter,
        createdBefore,
        lastContactAfter,
        lastContactBefore
      } = query;

      // Build search filter
      const filter = {};

      // Full-text search across multiple fields
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ];
      }

      // Add other filters
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      if (assignedTo) filter.assignedTo = assignedTo;

      // Date range filters
      if (createdAfter || createdBefore) {
        filter.createdAt = {};
        if (createdAfter) filter.createdAt.$gte = new Date(createdAfter);
        if (createdBefore) filter.createdAt.$lte = new Date(createdBefore);
      }

      if (lastContactAfter || lastContactBefore) {
        filter.lastContactDate = {};
        if (lastContactAfter) filter.lastContactDate.$gte = new Date(lastContactAfter);
        if (lastContactBefore) filter.lastContactDate.$lte = new Date(lastContactBefore);
      }

      // Set up pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;

      // Set up sorting
      const sort = {};
      if (options.sortBy) {
        const [field, order] = options.sortBy.split(':');
        sort[field] = order === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Default sort by creation date
      }

      // Generate cache key
      const cacheKey = `contacts:search:${JSON.stringify({ filter, sort, page, limit })}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Execute search query
      const [contacts, total] = await Promise.all([
        Contact.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        Contact.countDocuments(filter)
      ]);

      const results = {
        data: contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Contact search error: ${error.message}`);
      throw new AppError('Failed to search contacts', 500);
    }
  }

  /**
   * Search leads with advanced filtering and sorting
   * @param {Object} query - Search query parameters
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Object>} Search results with pagination info
   */
  async searchLeads(query, options = {}) {
    try {
      const {
        search,
        stage,
        source,
        minAmount,
        maxAmount,
        minProbability,
        maxProbability,
        tags,
        assignedTo,
        createdAfter,
        createdBefore
      } = query;

      // Build search filter
      const filter = {};

      // Full-text search across multiple fields
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { product: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ];
      }

      // Add other filters
      if (stage) filter.stage = stage;
      if (source) filter.source = source;
      if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      if (assignedTo) filter.assignedTo = assignedTo;

      // Amount range filter
      if (minAmount || maxAmount) {
        filter.amount = {};
        if (minAmount) filter.amount.$gte = parseFloat(minAmount);
        if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
      }

      // Probability range filter
      if (minProbability || maxProbability) {
        filter.probability = {};
        if (minProbability) filter.probability.$gte = parseInt(minProbability);
        if (maxProbability) filter.probability.$lte = parseInt(maxProbability);
      }

      // Date range filters
      if (createdAfter || createdBefore) {
        filter.createdAt = {};
        if (createdAfter) filter.createdAt.$gte = new Date(createdAfter);
        if (createdBefore) filter.createdAt.$lte = new Date(createdBefore);
      }

      // Set up pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;

      // Set up sorting
      const sort = {};
      if (options.sortBy) {
        const [field, order] = options.sortBy.split(':');
        sort[field] = order === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Default sort by creation date
      }

      // Generate cache key
      const cacheKey = `leads:search:${JSON.stringify({ filter, sort, page, limit })}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Execute search query
      const [leads, total] = await Promise.all([
        Lead.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        Lead.countDocuments(filter)
      ]);

      const results = {
        data: leads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Lead search error: ${error.message}`);
      throw new AppError('Failed to search leads', 500);
    }
  }

  /**
   * Get contact suggestions based on partial input
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array>} Contact suggestions
   */
  async getContactSuggestions(query, limit = 5) {
    try {
      const cacheKey = `contacts:suggestions:${query}:${limit}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const suggestions = await Contact.find({
        $or: [
          { name: { $regex: `^${query}`, $options: 'i' } },
          { email: { $regex: `^${query}`, $options: 'i' } },
          { company: { $regex: `^${query}`, $options: 'i' } }
        ]
      })
        .select('name email company')
        .limit(limit)
        .lean();

      // Cache results
      await cache.set(cacheKey, JSON.stringify(suggestions), 300); // Cache for 5 minutes

      return suggestions;
    } catch (error) {
      logger.error(`Contact suggestions error: ${error.message}`);
      throw new AppError('Failed to get contact suggestions', 500);
    }
  }

  /**
   * Get lead suggestions based on partial input
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array>} Lead suggestions
   */
  async getLeadSuggestions(query, limit = 5) {
    try {
      const cacheKey = `leads:suggestions:${query}:${limit}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const suggestions = await Lead.find({
        $or: [
          { name: { $regex: `^${query}`, $options: 'i' } },
          { company: { $regex: `^${query}`, $options: 'i' } },
          { product: { $regex: `^${query}`, $options: 'i' } }
        ]
      })
        .select('name company product amount stage')
        .limit(limit)
        .lean();

      // Cache results
      await cache.set(cacheKey, JSON.stringify(suggestions), 300); // Cache for 5 minutes

      return suggestions;
    } catch (error) {
      logger.error(`Lead suggestions error: ${error.message}`);
      throw new AppError('Failed to get lead suggestions', 500);
    }
  }
}

// Export singleton instance
module.exports = new SearchService();