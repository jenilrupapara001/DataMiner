const mongoose = require('mongoose');

const executionEntrySchema = new mongoose.Schema({
  entityId: { type: String },
  entityType: { type: String },
  entityName: { type: String },
  ruleName: { type: String },
  ruleOrder: { type: Number },
  conditionsMet: [Object],
  actionApplied: Object,
  previousValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['applied', 'failed', 'skipped'], default: 'skipped' }
}, { _id: true });

const rulesetExecutionLogSchema = new mongoose.Schema({
  ruleset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ruleset', required: true },
  executedAt: { type: Date, default: Date.now },
  triggeredBy: { type: String },

  summary: {
    totalEvaluated: { type: Number, default: 0 },
    totalMatched: { type: Number, default: 0 },
    totalActioned: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    executionTimeMs: { type: Number, default: 0 }
  },

  entries: [executionEntrySchema],

  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

rulesetExecutionLogSchema.index({ ruleset: 1, executedAt: -1 });
rulesetExecutionLogSchema.index({ seller: 1, executedAt: -1 });

const RulesetExecutionLog = mongoose.models.RulesetExecutionLog || mongoose.model('RulesetExecutionLog', rulesetExecutionLogSchema);

module.exports = RulesetExecutionLog;