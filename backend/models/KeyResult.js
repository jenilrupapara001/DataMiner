const mongoose = require('mongoose');

const keyResultSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    objectiveId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Objective',
        required: true
    },
    metric: {
        type: String,
        required: true, // e.g. "Revenue", "Tasks Completed", "BSR", "NPS"
        default: 'Percentage'
    },
    metricType: {
        type: String,
        enum: ['GMS', 'ACOS', 'ORDERS', 'ROI', 'PROFIT', 'CONVERSION_RATE', 'NONE'],
        default: 'NONE'
    },
    startValue: {
        type: Number,
        default: 0
    },
    targetValue: {
        type: Number,
        required: true
    },
    currentValue: {
        type: Number,
        default: 0
    },
    unit: {
        type: String,
        default: '' // e.g. "$", "%", "units"
    },
    weight: {
        type: Number,
        default: 1, // Relative importance 1-10
        min: 1,
        max: 10
    },
    status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BEHIND'],
        default: 'NOT_STARTED'
    },
    healthStatus: {
        type: String,
        enum: ['BEHIND', 'ON_TRACK', 'AHEAD'],
        default: 'ON_TRACK'
    },
    achievementPercent: { type: Number, default: 0 },
    resolvedAsins: [{ type: String }],
    projectedValue: { type: Number, default: 0 },
    dailyRunRateRequired: { type: Number, default: 0 },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Optional: Auto-sync configuration
    autoSync: {
        enabled: { type: Boolean, default: false },
        source: { type: String, enum: ['TASKS', 'SALES_API', 'MANUAL'], default: 'MANUAL' }
    }
}, { timestamps: true });

// Virtual for Actions (Tasks) linked to this KR
keyResultSchema.virtual('actions', {
    ref: 'Action',
    localField: '_id',
    foreignField: 'keyResultId'
});

// Update progress method
keyResultSchema.methods.updateProgress = function (newValue) {
    this.currentValue = newValue;

    // Calculate status based on progress vs time (simplified for now)
    const percentage = (this.currentValue / this.targetValue) * 100;
    if (percentage >= 100) {
        this.status = 'COMPLETED';
    } else if (percentage > 0) {
        this.status = 'IN_PROGRESS';
    } else {
        this.status = 'NOT_STARTED';
    }

    return this.save();
};

keyResultSchema.index({ objectiveId: 1 });

module.exports = mongoose.models.KeyResult || mongoose.model('KeyResult', keyResultSchema);
