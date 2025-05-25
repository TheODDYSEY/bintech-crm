const Lead = require('../models/leads');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const { CACHE_KEYS, PAGINATION, LEAD_STAGES } = require('../utils/constants');
const AppError = require('../utils/appError');

/**
 * Lead service class
 */
class LeadService {
  /**
   * Create new lead
   * @param {Object} leadData - Lead data
   * @returns {Promise<Object>} Created lead
   */
  async createLead(leadData) {
    try {
      // Check for existing lead
      const existingLead = await Lead.findOne({
        $or: [
          { email: leadData.email },
          { phone: leadData.phone }
        ]
      });

      if (existingLead) {
        throw new AppError('Lead with this email or phone already exists', 409);
      }

      // Set initial probability based on stage
      if (!leadData.probability) {
        leadData.probability = this.calculateProbability(leadData.stage);
      }

      const lead = new Lead(leadData);
      await lead.save();

      // Clear leads list cache
      await cache.clearPattern(CACHE_KEYS.LEADS_LIST + '*');

      logger.info(`Created new lead: ${lead._id}`);
      return lead;
    } catch (error) {
      logger.error(`Lead creation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get lead by ID
   * @param {string} id - Lead ID
   * @returns {Promise<Object>} Lead
   */
  async getLeadById(id) {
    try {
      const cacheKey = `${CACHE_KEYS.LEAD_DETAILS}${id}`;
      
      // Check cache
      const cachedLead = await cache.get(cacheKey);
      if (cachedLead) {
        return cachedLead;
      }

      const lead = await Lead.findById(id);
      if (!lead) {
        throw new AppError('Lead not found', 404);
      }

      // Cache lead
      await cache.set(cacheKey, lead);

      return lead;
    } catch (error) {
      logger.error(`Lead retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get leads with pagination and filtering
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated leads
   */
  async getLeads(query) {
    try {
      const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
      const limit = parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const cacheKey = `${CACHE_KEYS.LEADS_LIST}:${page}:${limit}`;

      // Check cache
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build query
      const queryBuilder = Lead.find();

      // Apply filters
      if (query.stage) {
        queryBuilder.where('stage').equals(query.stage);
      }
      if (query.assignedTo) {
        queryBuilder.where('assignedTo').equals(query.assignedTo);
      }
      if (query.minAmount) {
        queryBuilder.where('amount').gte(parseFloat(query.minAmount));
      }
      if (query.maxAmount) {
        queryBuilder.where('amount').lte(parseFloat(query.maxAmount));
      }
      if (query.probability) {
        queryBuilder.where('probability').gte(parseFloat(query.probability));
      }

      // Date range filter
      if (query.startDate && query.endDate) {
        queryBuilder.where('createdAt').gte(new Date(query.startDate))
          .lte(new Date(query.endDate));
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
      const [leads, total] = await Promise.all([
        queryBuilder.skip(skip).limit(limit),
        Lead.countDocuments(queryBuilder.getQuery())
      ]);

      const result = {
        leads,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      };

      // Cache result
      await cache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error(`Leads retrieval error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update lead
   * @param {string} id - Lead ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated lead
   */
  async updateLead(id, updateData) {
    try {
      // Check for duplicate email/phone
      if (updateData.email || updateData.phone) {
        const existingLead = await Lead.findOne({
          _id: { $ne: id },
          $or: [
            { email: updateData.email },
            { phone: updateData.phone }
          ]
        });

        if (existingLead) {
          throw new AppError('Lead with this email or phone already exists', 409);
        }
      }

      // Update probability if stage changes
      if (updateData.stage && !updateData.probability) {
        updateData.probability = this.calculateProbability(updateData.stage);
      }

      const lead = await Lead.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!lead) {
        throw new AppError('Lead not found', 404);
      }

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.LEAD_DETAILS}${id}`),
        cache.clearPattern(CACHE_KEYS.LEADS_LIST + '*')
      ]);

      logger.info(`Updated lead: ${id}`);
      return lead;
    } catch (error) {
      logger.error(`Lead update error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete lead
   * @param {string} id - Lead ID
   */
  async deleteLead(id) {
    try {
      const lead = await Lead.findByIdAndDelete(id);
      
      if (!lead) {
        throw new AppError('Lead not found', 404);
      }

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.LEAD_DETAILS}${id}`),
        cache.clearPattern(CACHE_KEYS.LEADS_LIST + '*')
      ]);

      logger.info(`Deleted lead: ${id}`);
    } catch (error) {
      logger.error(`Lead deletion error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate win probability based on stage
   * @param {string} stage - Lead stage
   * @returns {number} Probability percentage
   */
  calculateProbability(stage) {
    const probabilities = {
      [LEAD_STAGES.NEW]: 20,
      [LEAD_STAGES.CONTACTED]: 40,
      [LEAD_STAGES.QUALIFIED]: 60,
      [LEAD_STAGES.PROPOSAL]: 80,
      [LEAD_STAGES.NEGOTIATION]: 90,
      [LEAD_STAGES.WON]: 100,
      [LEAD_STAGES.LOST]: 0
    };

    return probabilities[stage] || 20;
  }

  /**
   * Get lead statistics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Lead statistics
   */
  async getStatistics(query) {
    try {
      const pipeline = [
        // Match stage for date range
        {
          $match: {
            createdAt: {
              $gte: new Date(query.startDate || new Date(0)),
              $lte: new Date(query.endDate || new Date())
            }
          }
        },
        // Group by stage
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgProbability: { $avg: '$probability' }
          }
        }
      ];

      const results = await Lead.aggregate(pipeline);

      // Format results
      const statistics = {
        totalLeads: 0,
        totalAmount: 0,
        byStage: {}
      };

      results.forEach(result => {
        statistics.totalLeads += result.count;
        statistics.totalAmount += result.totalAmount;
        statistics.byStage[result._id] = {
          count: result.count,
          amount: result.totalAmount,
          probability: Math.round(result.avgProbability)
        };
      });

      return statistics;
    } catch (error) {
      logger.error(`Lead statistics error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find duplicate leads
   * @returns {Promise<Array>} Duplicate leads
   */
  async findDuplicates() {
    try {
      return await Lead.findDuplicates();
    } catch (error) {
      logger.error(`Find duplicates error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge duplicate leads
   * @param {string} primaryId - Primary lead ID
   * @param {string[]} duplicateIds - Duplicate lead IDs
   * @returns {Promise<Object>} Merged lead
   */
  async mergeDuplicates(primaryId, duplicateIds) {
    try {
      const [primary, ...duplicates] = await Promise.all([
        Lead.findById(primaryId),
        ...duplicateIds.map(id => Lead.findById(id))
      ]);

      if (!primary) {
        throw new AppError('Primary lead not found', 404);
      }

      // Merge fields
      duplicates.forEach(duplicate => {
        if (!duplicate) return;

        // Keep highest amount and probability
        if (duplicate.amount > primary.amount) {
          primary.amount = duplicate.amount;
        }
        if (duplicate.probability > primary.probability) {
          primary.probability = duplicate.probability;
        }

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
      await Lead.deleteMany({ _id: { $in: duplicateIds } });

      // Clear caches
      await Promise.all([
        cache.del(`${CACHE_KEYS.LEAD_DETAILS}${primaryId}`),
        ...duplicateIds.map(id => cache.del(`${CACHE_KEYS.LEAD_DETAILS}${id}`)),
        cache.clearPattern(CACHE_KEYS.LEADS_LIST + '*')
      ]);

      logger.info(`Merged leads into ${primaryId}`);
      return primary;
    } catch (error) {
      logger.error(`Lead merge error: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new LeadService();