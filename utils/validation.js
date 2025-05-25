const Joi = require('joi');
const { VALIDATION, USER_ROLES, LEAD_STAGES, CONTACT_TYPES, CONTACT_STATUS } = require('./constants');

/**
 * Validation schemas for the application
 */
const schemas = {
  // User Validation Schemas
  user: {
    register: Joi.object({
      username: Joi.string()
        .min(VALIDATION.USERNAME_MIN_LENGTH)
        .max(VALIDATION.USERNAME_MAX_LENGTH)
        .required()
        .trim(),
      email: Joi.string()
        .email()
        .required()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      password: Joi.string()
        .min(VALIDATION.PASSWORD_MIN_LENGTH)
        .max(VALIDATION.PASSWORD_MAX_LENGTH)
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)  // At least one uppercase, lowercase, number and special character
        .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
        }),
      role: Joi.string()
        .valid(...Object.values(USER_ROLES))
        .default(USER_ROLES.AGENT)
    }),

    login: Joi.object({
      email: Joi.string()
        .email()
        .required()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      password: Joi.string().required()
    }),

    resetPassword: Joi.object({
      token: Joi.string().required(),
      password: Joi.string()
        .min(VALIDATION.PASSWORD_MIN_LENGTH)
        .max(VALIDATION.PASSWORD_MAX_LENGTH)
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
        })
    }),

    resetRequest: Joi.object({
      email: Joi.string()
        .email()
        .required()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim()
    })
  },

  // Contact Validation Schemas
  contact: {
    create: Joi.object({
      name: Joi.string().required().trim(),
      email: Joi.string()
        .email()
        .required()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      phone: Joi.string()
        .pattern(VALIDATION.PHONE_REGEX)
        .required()
        .messages({
          'string.pattern.base': 'Phone number must be in international format'
        }),
      company: Joi.string().trim(),
      position: Joi.string().trim(),
      type: Joi.string()
        .valid(...Object.values(CONTACT_TYPES))
        .default(CONTACT_TYPES.PROSPECT),
      status: Joi.string()
        .valid(...Object.values(CONTACT_STATUS))
        .default(CONTACT_STATUS.ACTIVE),
      source: Joi.string().trim(),
      assignedTo: Joi.string().trim(),  // User ID
      notes: Joi.string().trim(),
      tags: Joi.array().items(Joi.string()),
      customFields: Joi.object().pattern(
        Joi.string(),  // Key pattern
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())  // Value pattern
      )
    }),

    update: Joi.object({
      name: Joi.string().trim(),
      email: Joi.string()
        .email()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      phone: Joi.string()
        .pattern(VALIDATION.PHONE_REGEX)
        .messages({
          'string.pattern.base': 'Phone number must be in international format'
        }),
      company: Joi.string().trim(),
      position: Joi.string().trim(),
      type: Joi.string().valid(...Object.values(CONTACT_TYPES)),
      status: Joi.string().valid(...Object.values(CONTACT_STATUS)),
      source: Joi.string().trim(),
      assignedTo: Joi.string().trim(),
      notes: Joi.string().trim(),
      tags: Joi.array().items(Joi.string()),
      customFields: Joi.object().pattern(
        Joi.string(),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
      )
    })
  },

  // Lead Validation Schemas
  lead: {
    create: Joi.object({
      name: Joi.string().required().trim(),
      company: Joi.string().trim(),
      email: Joi.string()
        .email()
        .required()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      phone: Joi.string()
        .pattern(VALIDATION.PHONE_REGEX)
        .required()
        .messages({
          'string.pattern.base': 'Phone number must be in international format'
        }),
      amount: Joi.number().min(0),
      stage: Joi.string()
        .valid(...Object.values(LEAD_STAGES))
        .default(LEAD_STAGES.NEW),
      source: Joi.string().trim(),
      product: Joi.string().trim(),
      category: Joi.string().trim(),
      probability: Joi.number().min(0).max(100),
      expectedCloseDate: Joi.date(),
      assignedTo: Joi.string().trim(),  // User ID
      notes: Joi.string().trim(),
      tags: Joi.array().items(Joi.string()),
      customFields: Joi.object().pattern(
        Joi.string(),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
      )
    }),

    update: Joi.object({
      name: Joi.string().trim(),
      company: Joi.string().trim(),
      email: Joi.string()
        .email()
        .pattern(VALIDATION.EMAIL_REGEX)
        .trim(),
      phone: Joi.string()
        .pattern(VALIDATION.PHONE_REGEX)
        .messages({
          'string.pattern.base': 'Phone number must be in international format'
        }),
      amount: Joi.number().min(0),
      stage: Joi.string().valid(...Object.values(LEAD_STAGES)),
      source: Joi.string().trim(),
      product: Joi.string().trim(),
      category: Joi.string().trim(),
      probability: Joi.number().min(0).max(100),
      expectedCloseDate: Joi.date(),
      assignedTo: Joi.string().trim(),
      notes: Joi.string().trim(),
      tags: Joi.array().items(Joi.string()),
      customFields: Joi.object().pattern(
        Joi.string(),
        Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
      )
    })
  },

  // File Upload Validation Schemas
  upload: {
    csv: Joi.object({
      file: Joi.object({
        fieldname: Joi.string().required(),
        originalname: Joi.string().required(),
        encoding: Joi.string().required(),
        mimetype: Joi.string().valid('text/csv', 'application/vnd.ms-excel').required(),
        size: Joi.number().max(5 * 1024 * 1024).required()  // 5MB max
      }).required()
    }),

    attachment: Joi.object({
      file: Joi.object({
        fieldname: Joi.string().required(),
        originalname: Joi.string().required(),
        encoding: Joi.string().required(),
        mimetype: Joi.string().valid(
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png'
        ).required(),
        size: Joi.number().max(10 * 1024 * 1024).required()  // 10MB max
      }).required()
    })
  },

  // Query Parameters Validation
  query: {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sort: Joi.string(),
      order: Joi.string().valid('asc', 'desc').default('desc')
    }),

    dateRange: Joi.object({
      startDate: Joi.date(),
      endDate: Joi.date().min(Joi.ref('startDate'))
    })
  }
};

/**
 * Validate data against schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} Validation result
 */
const validate = (data, schema) => {
  const options = {
    abortEarly: false,  // Return all errors
    stripUnknown: true,  // Remove unknown fields
    convert: true  // Convert values when possible
  };

  const { error, value } = schema.validate(data, options);

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return { isValid: false, errors, value: null };
  }

  return { isValid: true, errors: null, value };
};

module.exports = {
  schemas,
  validate
};