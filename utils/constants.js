/**
 * Application-wide constants and enumerations
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// User Roles
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  VIEWER: 'viewer'
};

// Lead Stages
const LEAD_STAGES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  WON: 'won',
  LOST: 'lost'
};

// Contact Types
const CONTACT_TYPES = {
  CUSTOMER: 'customer',
  PROSPECT: 'prospect',
  PARTNER: 'partner',
  VENDOR: 'vendor'
};

// Contact Status
const CONTACT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked'
};

// File Upload Types
const UPLOAD_TYPES = {
  CONTACT_IMPORT: 'contact_import',
  LEAD_IMPORT: 'lead_import',
  DEAL_ATTACHMENT: 'deal_attachment',
  PROFILE_PICTURE: 'profile_picture'
};

// Cache Keys
const CACHE_KEYS = {
  CONTACTS_LIST: 'contacts:list',
  LEADS_LIST: 'leads:list',
  DEALS_LIST: 'deals:list',
  USER_PROFILE: 'user:profile:',
  CONTACT_DETAILS: 'contact:details:',
  LEAD_DETAILS: 'lead:details:'
};

// Error Codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR'
};

// Validation Constants
const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/, // International phone number format
  EMAIL_REGEX: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// Time Constants (in milliseconds)
const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
};

// Export all constants
module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  LEAD_STAGES,
  CONTACT_TYPES,
  CONTACT_STATUS,
  UPLOAD_TYPES,
  CACHE_KEYS,
  ERROR_CODES,
  VALIDATION,
  PAGINATION,
  TIME
};