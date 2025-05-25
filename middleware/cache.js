const redis = require('redis');
const { promisify } = require('util');

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Promisify Redis commands
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);

// Handle Redis client errors
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Cache middleware factory
const cache = (duration = 3600) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;

    try {
      const cachedResponse = await getAsync(key);

      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        return res.json(data);
      }

      // Store original res.json method
      const originalJson = res.json;

      // Override res.json method to cache the response
      res.json = function(body) {
        // Restore original res.json method
        res.json = originalJson;

        // Cache the response
        setAsync(key, JSON.stringify(body), 'EX', duration)
          .catch(err => console.error('Cache Set Error:', err));

        // Send the response
        return res.json(body);
      };

      next();
    } catch (err) {
      console.error('Cache Middleware Error:', err);
      next();
    }
  };
};

// Cache invalidation middleware
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    try {
      const keys = await new Promise((resolve, reject) => {
        client.keys(pattern, (err, keys) => {
          if (err) reject(err);
          resolve(keys);
        });
      });

      if (keys.length > 0) {
        await delAsync(keys);
      }

      next();
    } catch (err) {
      console.error('Cache Invalidation Error:', err);
      next();
    }
  };
};

// Cache clear utility
const clearCache = async (pattern = 'cache:*') => {
  try {
    const keys = await new Promise((resolve, reject) => {
      client.keys(pattern, (err, keys) => {
        if (err) reject(err);
        resolve(keys);
      });
    });

    if (keys.length > 0) {
      await delAsync(keys);
      console.log(`Cleared ${keys.length} cache entries`);
    }
  } catch (err) {
    console.error('Cache Clear Error:', err);
    throw err;
  }
};

module.exports = {
  cache,
  invalidateCache,
  clearCache,
  client
};