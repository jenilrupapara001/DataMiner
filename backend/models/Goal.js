const mongoose = require('mongoose');

/**
 * Goal Model - The strategic north star for growth execution.
 * 
 * DESIGN: Supports both Brand-level and ASIN-level objectives with automated 
 * ASIN resolution for performance tracking.
 */
const goalSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  
  // SCOPE SYSTEM
  scopeType: { 
    type: String, 
    enum: ['BRAND', 'ASIN'], 
    required: true,
    default: 'BRAND'
  },
  scopeIds: [{ type: String, required: true }], // Brand IDs or ASINs
  resolvedAsins: [{ type: String, index: true }], // Flattened for data aggregation
  
  // METRIC CONFIG
  metricType: { 
    type: String, 
    enum: ['GMS', 'ACOS', 'ROI', 'PROFIT', 'CONVERSION_RATE', 'ORDER_COUNT'],
    required: true,
    default: 'GMS'
  },
  
  // PERFORMANCE VALUES
  targetValue: { type: Number, required: true },
  currentValue: { type: Number, default: 0 },
  startValue: { type: Number, default: 0 }, // For gap calculation
  
  // CALCULATED ANALYTICS
  gap: { type: Number, default: 0 },
  runRateRequired: { type: Number, default: 0 }, // Per day
  projectedValue: { type: Number, default: 0 }, // Trend-based
  
  // STRATEGIC DRIVERS
  drivers: [{ 
    type: String // e.g., "PPC Efficiency", "Listing Image Quality", "Stock Stability"
  }],
  
  // LIFECYCLE
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  healthStatus: { 
    type: String, 
    enum: ['ahead', 'ontrack', 'behind', 'pending'], 
    default: 'pending' 
  },
  
  progressPercentage: { type: Number, default: 0 },
  
  // MULTI-TENANCY
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  
  lastCalculatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Logic for status and gap calculation
goalSchema.methods.calculateProgress = function() {
  const now = new Date();
  const totalDays = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now - this.startDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = totalDays - daysElapsed;

  this.gap = Math.max(0, this.targetValue - this.currentValue);
  this.progressPercentage = (this.currentValue / this.targetValue) * 100;

  // Calculate Required Daily Run Rate
  if (daysRemaining > 0) {
    this.runRateRequired = this.gap / daysRemaining;
  }

  // Calculate Health Status
  const expectedProgress = (daysElapsed / totalDays) * 100;
  if (this.progressPercentage >= expectedProgress * 1.1) {
    this.healthStatus = 'ahead';
  } else if (this.progressPercentage >= expectedProgress * 0.8) {
    this.healthStatus = 'ontrack';
  } else {
    this.healthStatus = 'behind';
  }
};

module.exports = mongoose.model('Goal', goalSchema);
