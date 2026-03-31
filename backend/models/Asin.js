const mongoose = require('mongoose');

const weekHistorySchema = new mongoose.Schema({
  week: { type: String, required: true }, // e.g., "W45"
  date: { type: Date, required: true },
  price: { type: Number, default: 0 },
  bsr: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  lqs: { type: Number, default: 0 },
  imageCount: { type: Number, default: 0 },
  descLength: { type: Number, default: 0 },
  hasAplus: { type: Boolean, default: false },
  // New metrics for detailed tracking
  titleLength: { type: Number, default: 0 },
  bulletPoints: { type: Number, default: 0 },
  videoCount: { type: Number, default: 0 },
  offers: { type: Number, default: 0 },
  subBSRs: [{ type: String }],
});

const asinSchema = new mongoose.Schema({
  asinCode: { type: String, required: true },
  sku: { type: String }, // SKU field
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  title: { type: String },
  description: { type: String }, // Description content
  imageUrl: { type: String },
  brand: { type: String },
  manufacturer: { type: String },
  currentASP: { type: Number, default: 0 },
  currentPrice: { type: Number, default: 0 }, // Same as currentASP
  priceType: { type: String, enum: ['Standard Price', 'Deal Price'], default: 'Standard Price' },
  dealBadge: { type: String, default: 'No deal found' },
  mrp: { type: Number, default: 0 },
  category: { type: String },
  soldBy: { type: String, default: '' },
  imageUrl: { type: String }, // Backwards compatibility
  mainImageUrl: { type: String }, // Modern mapping
  images: [{ type: String }],
  imagesCount: { type: Number, default: 0 },
  bsr: { type: Number, default: 0 }, // Main BSR
  subBSRs: [{ type: String }],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  stockLevel: { type: Number, default: 0, index: true },
  ratingBreakdown: {
    fiveStar: { type: Number, default: 0 },
    fourStar: { type: Number, default: 0 },
    threeStar: { type: Number, default: 0 },
    twoStar: { type: Number, default: 0 },
    oneStar: { type: Number, default: 0 },
  },
  reviewCount: { type: Number, default: 0 },
  bulletPoints: { type: Number, default: 0 }, // List count
  // Enhanced Product Details (from Tracker & Calculator)
  weight: { type: Number }, // in grams
  dimensions: { type: String }, // LxWxH
  volumetricWeight: { type: Number },
  stapleLevel: { type: String, enum: ['Standard', 'Heavy', 'Oversize'] },

  // Scrape Status (from Tracker)
  scrapeStatus: {
    type: String,
    enum: ['PENDING', 'SCRAPING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  lastScrapeExecutionId: { type: String },
  scrapeError: { type: String },
  marketplace: { type: String, default: 'amazon.in' },

  // LQS Details (Enhanced)
  lqsDetails: {
    titleLength: Number,
    bulletPointCount: Number,
    imageCount: Number,
    videoCount: Number,
    hasAplus: Boolean,
    descriptionLength: Number,
    reviewRating: Number,
    reviewCount: Number,
  },

  // Action Items (Task Management)
  actionItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Action' }],

  // Fee Preview (from Calculator)
  feePreview: {
    referralFee: Number,
    closingFee: Number,
    shippingFee: Number,
    fbaFee: Number,
    storageFee: Number,
    tax: Number,
    totalFees: Number,
    netRevenue: Number,
    margin: Number,
    calculatedAt: Date
  },

  amazonListedDate: { type: String },
  status: { type: String, enum: ['Active', 'Pending', 'Scraping', 'Error', 'Paused'], default: 'Active' },
  lastScraped: { type: Date },

  // Daily consolidated history
  history: [{
    date: { type: Date, required: true },
    price: { type: Number, default: 0 },
    bsr: { type: Number, default: 0 }, // Consolidated BSR
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    offers: { type: Number, default: 0 },
    lqs: { type: Number, default: 0 },
  }],

  // Rating history (existing)
  ratingHistory: [{
    date: Date,
    rating: Number,
    reviewCount: Number,
  }],

  // Week-on-Week history (new - for trend tracking)
  weekHistory: [weekHistorySchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index for unique ASIN per seller
asinSchema.index({ asinCode: 1, seller: 1 }, { unique: true });

// Index for faster queries
asinSchema.index({ seller: 1, status: 1 });
asinSchema.index({ category: 1 });
asinSchema.index({ lqs: -1 });
asinSchema.index({ bsr: 1 });

// Method to update week history (Allow multiple entries per week if dates are different)
asinSchema.methods.updateWeekHistory = function (weekData) {
  // Try to find an entry with the exact same date (ignoring time)
  const incomingDate = new Date(weekData.date).toDateString();
  const existingIndex = this.weekHistory.findIndex(w => new Date(w.date).toDateString() === incomingDate);

  if (existingIndex >= 0) {
    this.weekHistory[existingIndex] = { ...this.weekHistory[existingIndex].toObject(), ...weekData };
  } else {
    this.weekHistory.push(weekData);
  }

  // Sort by date after update
  this.weekHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Keep only last 24 entries (roughly 3-4 weeks if daily, or more if weekly)
  if (this.weekHistory.length > 24) {
    this.weekHistory = this.weekHistory.slice(-24);
  }
};

// Method to get week-on-week trends
asinSchema.methods.getTrends = function () {
  if (this.weekHistory.length < 2) return null;

  const sorted = [...this.weekHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    priceChange: last.price - first.price,
    pricePercent: ((last.price - first.price) / first.price * 100).toFixed(1),
    bsrChange: last.bsr - first.bsr,
    bsrPercent: ((last.bsr - first.bsr) / first.bsr * 100).toFixed(1),
    ratingChange: last.rating - first.rating,
    reviewsChange: last.reviews - first.reviews,
    lqsChange: last.lqs - first.lqs,
  };
};

asinSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Asin || mongoose.model('Asin', asinSchema);
