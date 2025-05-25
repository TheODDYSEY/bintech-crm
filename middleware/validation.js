const Joi = require('joi');

// User validation schemas
const userSchemas = {
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, underscores and hyphens'
      }),
    email: Joi.string()
      .email()
      .required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
      })
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
      })
  })
};

// Lead validation schemas
const leadSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    company: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    source: Joi.string().valid('Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other').required(),
    product: Joi.string().required(),
    category: Joi.string().required(),
    stage: Joi.string().valid('New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost').default('New'),
    amount: Joi.number().min(0),
    inquiryDate: Joi.date().default(Date.now),
    quotationDate: Joi.date(),
    tags: Joi.array().items(Joi.string()),
    notes: Joi.array().items(
      Joi.object({
        content: Joi.string().required(),
        createdBy: Joi.string().required()
      })
    )
  })
};

// Contact validation schemas
const contactSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    company: Joi.string().required(),
    position: Joi.string(),
    department: Joi.string(),
    source: Joi.string().valid('Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other').required(),
    type: Joi.string().valid('Customer', 'Prospect', 'Partner', 'Vendor', 'Other').default('Prospect'),
    status: Joi.string().valid('Active', 'Inactive').default('Active'),
    socialProfiles: Joi.object({
      linkedin: Joi.string().uri(),
      twitter: Joi.string(),
      facebook: Joi.string()
    }),
    tags: Joi.array().items(Joi.string()),
    notes: Joi.array().items(
      Joi.object({
        content: Joi.string().required(),
        createdBy: Joi.string().required()
      })
    )
  })
};

// File upload validation schemas
const fileSchemas = {
  upload: Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('text/csv', 'application/vnd.ms-excel', 'application/json').required(),
    size: Joi.number().max(5242880).required() // 5MB max
  })
};

// Export all schemas
module.exports = {
  userSchemas,
  leadSchemas,
  contactSchemas,
  fileSchemas
};