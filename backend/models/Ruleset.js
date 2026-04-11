const mongoose = require('mongoose');

const ruleConditionSchema = new mongoose.Schema({
  attribute: { type: String, required: true },
  operator: { type: String, required: true },
  valueType: { type: String, default: 'Absolute Value' },
  value: { type: mongoose.Schema.Types.Mixed },
  value2: { type: mongoose.Schema.Types.Mixed },
  logicalOp: { type: String, enum: ['AND', 'OR'], default: 'AND' }
}, { _id: true });

const ruleActionSchema = new mongoose.Schema({
  actionType: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  value2: { type: mongoose.Schema.Types.Mixed },
  unit: { type: String, enum: ['percent', 'absolute', '₹'], default: 'percent' },
  target: { type: String }
}, { _id: true });

const ruleSchema = new mongoose.Schema({
  order: { type: Number, default: 0 },
  name: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  conditions: [ruleConditionSchema],
  action: ruleActionSchema
}, { _id: true });

const rulesetScopeSchema = new mongoose.Schema({
  applyTo: { type: String, enum: ['all', 'selected', 'tagged'], default: 'all' },
  asins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asin' }],
  tags: [String],
  brands: [String],
  categories: [String],
  campaigns: [String],
  adGroups: [String]
}, { _id: false });

const RulesetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['Bid', 'Campaign', 'Target', 'ASIN', 'Product', 'Inventory', 'Pricing', 'SOV'],
    required: true
  },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isAutomated: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },

  usingDataFrom: { type: String, default: 'Last 14 days' },
  excludeDays: { type: String, default: 'Latest day' },
  runFrequency: { type: String, default: 'Daily' },
  runTime: { type: String, default: '08 AM' },

  rules: [ruleSchema],

  scope: rulesetScopeSchema,

  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },

  associationsInAccount: {
    count: { type: Number, default: 0 },
    unit: { type: String, default: 'ASINs' }
  },
  associationsInOtherAccounts: {
    count: { type: Number, default: 0 },
    unit: { type: String, default: 'ASINs' }
  },

  fromTemplate: { type: String, default: null },
  lastRunAt: { type: Date, default: null },
  nextRunAt: { type: Date, default: null },
  totalRunCount: { type: Number, default: 0 },
  lastRunSummary: { type: Object, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Advanced settings
  conflictResolution: { type: String, enum: ['first', 'restrictive', 'aggressive'], default: 'first' },
  emailOnRun: { type: Boolean, default: false },
  emailOnAction: { type: Boolean, default: false },
  inAppNotification: { type: Boolean, default: false },
  emailAddress: { type: String },
  priority: { type: Number, default: 0 },
  pauseConditions: {
    maxActionPercent: { type: Number },
    maxSpendChange: { type: Number }
  }
}, { timestamps: true });

RulesetSchema.index({ seller: 1, type: 1 });
RulesetSchema.index({ isActive: 1, type: 1 });
RulesetSchema.index({ createdAt: -1 });

const Ruleset = mongoose.models.Ruleset || mongoose.model('Ruleset', RulesetSchema);

module.exports = Ruleset;