const mongoose = require('mongoose');

/**
 * RevenueSummary Model - Aggregated high-performance view of revenue
 * Optimized for dashboard consumption and historical analysis.
 */
const revenueSummarySchema = new mongoose.Schema({
  asin: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  period: { 
    type: String, 
    enum: ['daily', 'monthly', 'yearly'], 
    default: 'daily',
    index: true 
  },

  // Derived Metrics
  organicRevenue: { type: Number, default: 0 },
  adRevenue: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  
  returns: { type: Number, default: 0 },
  netRevenue: { type: Number, default: 0 },
  
  units: { type: Number, default: 0 },
  
  // Ratios
  adsRatio: { type: Number, default: 0 }, // adRevenue / totalRevenue
  acos: { type: Number, default: 0 },     // From AdsPerformance context if available
  
  currency: { type: String, default: 'INR' },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Ensure one summary per ASIN/Date/Period
revenueSummarySchema.index({ asin: 1, date: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('RevenueSummary', revenueSummarySchema);
