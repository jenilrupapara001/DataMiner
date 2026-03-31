const mongoose = require('mongoose');

const octoTaskSchema = new mongoose.Schema({
  taskId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  isAssigned: { 
    type: Boolean, 
    default: false,
    index: true
  },
  sellerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Seller',
    default: null
  },
  lastAssignedAt: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('OctoTask', octoTaskSchema);
