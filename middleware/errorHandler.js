const AppError = require('../utils/appError');

// Error response formatter
const formatError = (err) => {
  return {
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  };
};

// Handle Mongoose validation errors
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => error.message);
  return new AppError('Validation Error', 400, 'VALIDATION_ERROR', errors);
};

// Handle Mongoose duplicate key errors
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(
    `Duplicate ${field}. Please use another value.`,
    400,
    'DUPLICATE_ERROR'
  );
};

// Handle JWT errors
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

// Handle JWT expired error
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401, 'EXPIRED_TOKEN');
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      name: err.name,
      code: err.code,
      message: err.message,
      stack: err.stack
    });
  }

  // Handle specific error types
  let error = err;

  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Send error response
  res.status(error.statusCode).json(formatError(error));
};

// Catch async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  errorHandler,
  catchAsync
};