const Joi = require('joi');

/**
 * Reusable auth field validators
 * Email: valid format, max 255, trimmed, lowercased
 * Password: 8-128 chars, no HTML/script injection
 * Name: 2-50 chars, letters/spaces/hyphens only, no HTML
 */

const emailField = Joi.string()
  .email({ tlds: { allow: true } })
  .lowercase()
  .trim()
  .max(255)
  .required();

const passwordField = Joi.string()
  .min(8)
  .max(128)
  .regex(/^(?!.*<)/, 'no HTML tags')
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must be at most 128 characters',
  });

const nameField = Joi.string()
  .min(2)
  .max(50)
  .regex(/^[a-zA-ZÀ-ÿ\s'\-\.]+$/, 'letters only')
  .required()
  .messages({
    'string.pattern.base': 'Name must contain only letters',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must be at most 50 characters',
  });

const schemas = {
  login: Joi.object({
    email: emailField,
    password: Joi.string().max(128).required(),
  }),

  register: Joi.object({
    email: emailField,
    password: passwordField,
    firstName: nameField,
    lastName: nameField,
    phone: Joi.string().pattern(/^\+?[0-9\s\-]{7,15}$/).optional().allow('', null),
    role: Joi.string().max(50).required(),
  }),

  verifyOtp: Joi.object({
    email: emailField,
    otp: Joi.string().pattern(/^\d{6}$/).required().messages({
      'string.pattern.base': 'OTP must be a 6-digit code',
    }),
    deviceFingerprint: Joi.string().max(500).optional().allow('', null),
    trustedDeviceName: Joi.string().max(100).optional().allow('', null),
  }),

  resendOtp: Joi.object({
    email: emailField,
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().max(128).required(),
    newPassword: passwordField,
  }),

  createUser: Joi.object({
    email: emailField,
    password: Joi.string().min(8).max(128).optional(),
    firstName: nameField,
    lastName: nameField,
    phone: Joi.string().pattern(/^\+?[0-9\s\-]{7,15}$/).optional().allow('', null),
    role: Joi.string().max(50).required(),
    isActive: Joi.boolean().optional(),
  }),

  createSeller: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    marketplace: Joi.string().required(),
    sellerId: Joi.string().max(30).optional().allow('', null),
    isActive: Joi.boolean().optional(),
    status: Joi.string().optional(),
    isPriority: Joi.boolean().optional(),
    assignedUserIds: Joi.array().items(Joi.string()).optional().default([]),
    octoparseId: Joi.string().optional().allow('', null),
    plan: Joi.string().optional(),
    scrapeLimit: Joi.number().integer().optional(),
    liveSyncClientId: Joi.string().optional().allow('', null),
    liveSyncClientSecret: Joi.string().optional().allow('', null),
    partnerTag: Joi.string().optional().allow('', null),
    liveSyncEnabled: Joi.boolean().optional(),
  }),

  createObjective: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).optional().allow('', null),
    type: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY').required(),
  }),

  createAction: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).optional().allow('', null),
    priority: Joi.string().valid('URGENT', 'HIGH', 'MEDIUM', 'LOW').required(),
    type: Joi.string().required(),
    status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED').optional(),
  }),

  createRuleset: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).optional().allow('', null),
    type: Joi.string().valid('ASIN', 'Product', 'Inventory', 'Pricing').required(),
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = schemas;
