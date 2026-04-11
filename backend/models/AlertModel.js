const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    required: true,
    enum: ['revenue', 'inventory', 'ads', 'asin', 'market', 'pricing', 'rating', 'bsr', 'system']
  },
  category: {
    type: String,
    enum: ['Performance', 'Ads', 'Inventory', 'Pricing', 'Reviews', 'Competitor', 'System']
  },
  condition: {
    metric: { type: String, required: true },
    operator: { type: String, required: true },
    value: { type: Number, required: true },
    period: { type: String, default: '1d' },
    thresholdType: { type: String, enum: ['absolute', 'percentage'], default: 'absolute' }
  },
  actions: {
    notify: { type: Boolean, default: true },
    createTask: { type: Boolean, default: false },
    notificationChannels: [{ type: String, enum: ['in_app', 'email', 'sms'] }]
  },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'info', 'success']
  },
  active: { type: Boolean, default: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  asinFilter: {
    categories: [String],
    brands: [String],
    minPrice: Number,
    maxPrice: Number,
    statuses: [String]
  },
  schedule: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['hourly', 'daily', 'weekly', 'custom'] },
    cronExpression: { type: String },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  execution: {
    lastRun: { type: Date },
    lastStatus: { type: String },
    lastTriggered: { type: Date },
    triggerCount: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const alertSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule' },
  ruleName: { type: String },
  type: {
    type: String,
    required: true,
    enum: ['revenue', 'inventory', 'ads', 'asin', 'market', 'pricing', 'rating', 'bsr', 'system']
  },
  message: { type: String, required: true },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'info', 'success']
  },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  asinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asin' },
  createdAt: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String },
  acknowledgedAt: { type: Date },
  data: { type: mongoose.Schema.Types.Mixed },
  actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Action' }
});

alertRuleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

alertRuleSchema.pre('updateOne', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

alertRuleSchema.index({ sellerId: 1, active: 1 });
alertSchema.index({ sellerId: 1, createdAt: -1 });
alertSchema.index({ acknowledged: 1 });

const AlertRule = mongoose.models.AlertRule || mongoose.model('AlertRule', alertRuleSchema);
const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);

module.exports = { Alert, AlertRule };
