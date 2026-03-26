const mongoose = require('mongoose');

const GoalTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    goals: [{
        title: {
            type: String,
            required: true
        },
        metric: {
            type: String,
            enum: ['NONE', 'GMS', 'ACOS', 'ROI', 'PROFIT', 'CONVERSION_RATE', 'ORDER_COUNT', 'LISTING', 'PO_FULFILLMENT', 'LQS', 'ADS_SPEND', 'PRODUCTS_TO_LIST'],
            default: 'NONE'
        },
        targetValue: {
            type: Number
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GoalTemplate', GoalTemplateSchema);
