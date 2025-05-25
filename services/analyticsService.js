const Contact = require('../models/contacts');
const Lead = require('../models/leads');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');

/**
 * Analytics service for generating reports and insights
 */
class AnalyticsService {
  /**
   * Get lead pipeline analytics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Pipeline analytics
   */
  async getLeadPipelineAnalytics(query = {}) {
    try {
      const cacheKey = `analytics:pipeline:${JSON.stringify(query)}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build date range filter
      const dateFilter = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);

      // Aggregate pipeline data
      const pipeline = await Lead.aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
            ...(query.assignedTo && { assignedTo: query.assignedTo })
          }
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgProbability: { $avg: '$probability' }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      const results = {
        stages: pipeline,
        summary: {
          totalLeads: pipeline.reduce((sum, stage) => sum + stage.count, 0),
          totalValue: pipeline.reduce((sum, stage) => sum + stage.totalAmount, 0),
          avgProbability: pipeline.reduce((sum, stage) => sum + stage.avgProbability, 0) / pipeline.length
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Pipeline analytics error: ${error.message}`);
      throw new AppError('Failed to generate pipeline analytics', 500);
    }
  }

  /**
   * Get sales performance analytics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Sales performance analytics
   */
  async getSalesPerformanceAnalytics(query = {}) {
    try {
      const cacheKey = `analytics:sales:${JSON.stringify(query)}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build date range filter
      const dateFilter = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);

      // Aggregate sales data
      const salesData = await Lead.aggregate([
        {
          $match: {
            stage: 'won',
            ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
            ...(query.assignedTo && { assignedTo: query.assignedTo })
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalSales: { $sum: '$amount' },
            dealCount: { $sum: 1 },
            avgDealSize: { $avg: '$amount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Calculate performance metrics
      const results = {
        monthly: salesData,
        summary: {
          totalSales: salesData.reduce((sum, month) => sum + month.totalSales, 0),
          totalDeals: salesData.reduce((sum, month) => sum + month.dealCount, 0),
          avgDealSize: salesData.reduce((sum, month) => sum + month.avgDealSize, 0) / salesData.length
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Sales analytics error: ${error.message}`);
      throw new AppError('Failed to generate sales analytics', 500);
    }
  }

  /**
   * Get contact engagement analytics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Contact engagement analytics
   */
  async getContactEngagementAnalytics(query = {}) {
    try {
      const cacheKey = `analytics:engagement:${JSON.stringify(query)}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build date range filter
      const dateFilter = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);

      // Aggregate engagement data
      const engagement = await Contact.aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length && { lastContactDate: dateFilter }),
            ...(query.type && { type: query.type })
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgEngagement: { $avg: { $size: '$notes' } }
          }
        },
        {
          $sort: { 'count': -1 }
        }
      ]);

      // Get contact source distribution
      const sources = await Contact.aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
          }
        },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { 'count': -1 }
        }
      ]);

      const results = {
        engagement,
        sources,
        summary: {
          totalContacts: engagement.reduce((sum, status) => sum + status.count, 0),
          avgEngagement: engagement.reduce((sum, status) => sum + status.avgEngagement, 0) / engagement.length
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Engagement analytics error: ${error.message}`);
      throw new AppError('Failed to generate engagement analytics', 500);
    }
  }

  /**
   * Get conversion funnel analytics
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Conversion funnel analytics
   */
  async getConversionFunnelAnalytics(query = {}) {
    try {
      const cacheKey = `analytics:funnel:${JSON.stringify(query)}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build date range filter
      const dateFilter = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);

      // Get total leads
      const totalLeads = await Lead.countDocuments({
        ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
      });

      // Get stage conversion rates
      const stageConversion = await Lead.aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
          }
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            stage: '$_id',
            count: 1,
            conversionRate: {
              $multiply: [{ $divide: ['$count', totalLeads] }, 100]
            }
          }
        },
        {
          $sort: { 'conversionRate': -1 }
        }
      ]);

      const results = {
        funnel: stageConversion,
        summary: {
          totalLeads,
          conversionRate: (stageConversion.find(stage => stage.stage === 'won')?.count || 0) / totalLeads * 100,
          averageStageDuration: await this.calculateAverageStageDuration(dateFilter)
        }
      };

      // Cache results
      await cache.set(cacheKey, JSON.stringify(results), 300); // Cache for 5 minutes

      return results;
    } catch (error) {
      logger.error(`Funnel analytics error: ${error.message}`);
      throw new AppError('Failed to generate funnel analytics', 500);
    }
  }

  /**
   * Calculate average duration in each stage
   * @param {Object} dateFilter - Date range filter
   * @returns {Promise<Object>} Average stage durations
   */
  async calculateAverageStageDuration(dateFilter) {
    const leads = await Lead.find({
      ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
    })
    .select('stage createdAt updatedAt')
    .lean();

    const stageDurations = {};
    const stageLeadCounts = {};

    leads.forEach(lead => {
      const duration = new Date(lead.updatedAt) - new Date(lead.createdAt);
      const durationInDays = duration / (1000 * 60 * 60 * 24);

      if (!stageDurations[lead.stage]) {
        stageDurations[lead.stage] = 0;
        stageLeadCounts[lead.stage] = 0;
      }

      stageDurations[lead.stage] += durationInDays;
      stageLeadCounts[lead.stage]++;
    });

    // Calculate averages
    const averageDurations = {};
    Object.keys(stageDurations).forEach(stage => {
      averageDurations[stage] = stageDurations[stage] / stageLeadCounts[stage];
    });

    return averageDurations;
  }
}

// Export singleton instance
module.exports = new AnalyticsService();