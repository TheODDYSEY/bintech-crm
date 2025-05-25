const AppError = require('../utils/appError');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return next(new AppError('Please log in to access this resource', 401, 'UNAUTHORIZED'));
  }
  next();
};

// Middleware to check user role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.session.userRole)) {
      return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }
    next();
  };
};

// Middleware to validate CSRF token
const validateCsrf = (req, res, next) => {
  if (!req.headers['csrf-token']) {
    return next(new AppError('CSRF token missing', 403, 'CSRF_MISSING'));
  }
  next();
};

// Middleware to check rate limiting
const checkRateLimit = (store) => {
  return (req, res, next) => {
    const key = `rate_limit:${req.ip}`;
    const limit = 100; // requests
    const window = 15 * 60; // 15 minutes in seconds

    store.get(key, (err, current) => {
      if (err) return next(err);

      if (current && current >= limit) {
        return next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
      }

      store.incr(key, (err) => {
        if (err) return next(err);
        store.expire(key, window);
        next();
      });
    });
  };
};

// Middleware to sanitize user input
const sanitizeInput = (req, res, next) => {
  // Sanitize req.body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  // Sanitize req.query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }

  next();
};

// Middleware to validate request schema
const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
    next();
  };
};

// Middleware to log requests
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  });
  next();
};

module.exports = {
  isAuthenticated,
  restrictTo,
  validateCsrf,
  checkRateLimit,
  sanitizeInput,
  validateSchema,
  requestLogger
};