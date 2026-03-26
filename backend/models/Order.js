const mongoose = require('mongoose');

/**
 * Order Model - Represents raw sales data from Amazon (SP-API or Reports)
 */
const orderSchema = new mongoose.Schema({
  asin: { type: String, required: true, index: true },
  sku: { type: String, index: true },
  date: { type: Date, required: true, index: true },
  
  units: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 }, // Total gross revenue (organic + ad)
  returns: { type: Number, default: 0 }, // Return value/count
  
  currency: { type: String, default: 'INR' },
  marketplace: { type: String, default: 'amazon.in' },
  
  source: { type: String, default: 'sp-api' }, // sp-api, csv, etc.
  uploaded_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Compound index for efficient daily lookup/upsert
orderSchema.index({ asin: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
