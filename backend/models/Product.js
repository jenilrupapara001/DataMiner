const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  asin: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sku: {
    type: String,
    default: null
  },
  title: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
