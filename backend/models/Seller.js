const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  marketplace: { type: String, required: true, enum: ['amazon.in'] },
  sellerId: { type: String, required: true, unique: true },
  apiKey: { type: String },
  plan: { type: String, enum: ['Starter', 'Pro', 'Enterprise'], default: 'Starter' },
  scrapeLimit: { type: Number, default: 100 },
  scrapeUsed: { type: Number, default: 0 },
  totalAsins: { type: Number, default: 0 },
  activeAsins: { type: Number, default: 0 },
  lastScraped: { type: Date },
  status: { type: String, enum: ['Active', 'Paused'], default: 'Active' },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  marketSyncTaskId: { type: String },
  cometChatUid: { type: String, index: true },
  // Keepa integration fields
  keepaSellerId: { type: String },          // Amazon Seller ID for Keepa (defaults to sellerId)
  keepaDomainId: { type: Number },          // Keepa domain: 10=IN, 1=US, 3=UK, 4=DE
  lastKeepaSync: { type: Date },            // Last successful Keepa sync
  keepaAsinCount: { type: Number, default: 0 }, // Total ASINs found on Keepa
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


sellerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Seller', sellerSchema);
