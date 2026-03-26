const mongoose = require('mongoose');

/**
 * RealTimeAlert Model - Instant notifications for performance anomalies
 */
const realTimeAlertSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['revenue_drop', 'high_acos', 'low_stock', 'system']
  },
  message: { type: String, required: true },
  severity: { 
    type: String, 
    required: true,
    enum: ['critical', 'warning', 'info'] 
  },
  asin: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('RealTimeAlert', realTimeAlertSchema);
