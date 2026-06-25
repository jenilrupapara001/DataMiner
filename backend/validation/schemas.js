const Joi = require('joi');

const schemas = {
  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required().max(255),
    password: Joi.string().required().max(128),
  }),
  register: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
    role: Joi.string().required(),
  }),
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
  }),
  createUser: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).max(128).optional(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
    role: Joi.string().required(),
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
