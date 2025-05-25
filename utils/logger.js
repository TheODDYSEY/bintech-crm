const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'warn';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(colors);

// Custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define file locations
const logDir = 'logs';
const errorLog = path.join(logDir, 'error.log');
const combinedLog = path.join(logDir, 'combined.log');

// Define transports
const transports = [
  // Write all errors to error.log
  new winston.transports.File({
    filename: errorLog,
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  // Write all logs to combined.log
  new winston.transports.File({
    filename: combinedLog,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  // Write to console in development
  new winston.transports.Console({
    format: format
  })
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports
});

// Create a stream object for Morgan
const stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Utility function to log errors with stack traces
const logError = (err, additionalInfo = {}) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
};

// Utility function to log API requests
const logAPIRequest = (req, additionalInfo = {}) => {
  logger.info({
    type: 'API_REQUEST',
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
};

// Utility function to log database operations
const logDBOperation = (operation, collection, query, additionalInfo = {}) => {
  logger.debug({
    type: 'DB_OPERATION',
    operation,
    collection,
    query,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
};

// Utility function to log security events
const logSecurityEvent = (event, user, additionalInfo = {}) => {
  logger.warn({
    type: 'SECURITY_EVENT',
    event,
    user,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  stream,
  logError,
  logAPIRequest,
  logDBOperation,
  logSecurityEvent
};