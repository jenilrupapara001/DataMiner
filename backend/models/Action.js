const mongoose = require('mongoose');

const stageHistorySchema = new mongoose.Schema({
    stage: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'],
        required: true
    },
    enteredAt: { type: Date, required: true },
    exitedAt: { type: Date },
    duration: { type: Number } // in minutes
}, { _id: false });

const actionSchema = new mongoose.Schema({
    // SCOPE SYSTEM
    scopeType: { 
        type: String, 
        enum: ['BRAND', 'ASIN', 'GLOBAL'], 
        default: 'ASIN' 
    },
    scopeIds: [{ type: String }],
    resolvedAsins: [{ type: String, index: true }], // Flattened ASIN array for data tracking

    // STRATEGIC LINKAGE
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal',
        required: false,
        index: true
    },
    impactWeight: { 
        type: Number, 
        min: 1, 
        max: 10, 
        default: 5 
    }, // How much this task impacts the Goal (for prioritization)
    
    type: {
        type: String,
        required: true,
        index: true
    },
    
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        required: true,
        default: 'MEDIUM'
    },
    
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED', 'REJECTED'],
        default: 'PENDING',
        required: true
    },

    // EXECUTION METADATA
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deadline: { type: Date },

    // AI ENRICHMENT
    isAIGenerated: { type: Boolean, default: false },
    aiGenerated: { type: Boolean, default: false }, // Consistency with new system
    aiReasoning: { type: String }, // "Why this task exists"
    aiReason: { type: String }, // Consistency with new system
    expectedImpact: {
        metric: { type: String }, // "GMS" | "ACOS" | "CVR"
        value: { type: Number }
    },
    expectedImpactLegacy: { type: String }, // For old string-based impact data
    
    // PROGRESS TRACKING
    timeTracking: {
        startedAt: { type: Date },
        completedAt: { type: Date },
        actualDuration: { type: Number } // in minutes
    },

    instructions: { type: String }
}, { timestamps: true });

// Protocols for performance
actionSchema.index({ resolvedAsins: 1, status: 1 });
actionSchema.index({ assignedTo: 1, status: 1 });
actionSchema.index({ goalId: 1, status: 1 });
actionSchema.index({ createdAt: -1 });

// Virtual for checking if task is started
actionSchema.virtual('isStarted').get(function () {
    return !!this.timeTracking?.startedAt && !this.timeTracking?.completedAt;
});

// Virtual for checking if task is completed
actionSchema.virtual('isCompleted').get(function () {
    return !!this.timeTracking?.completedAt || this.status === 'COMPLETED';
});

// Method to start task
actionSchema.methods.startTask = function () {
    this.timeTracking = this.timeTracking || {};
    this.timeTracking.startedAt = new Date();
    this.timeTracking.completedAt = null;
    this.status = 'IN_PROGRESS';
    this.stage = this.stage || {};
    this.stage.current = 'IN_PROGRESS';
    this.stage.history = this.stage.history || [];
    this.stage.history.push({
        stage: 'IN_PROGRESS',
        enteredAt: new Date(),
        exitedAt: null,
        duration: null
    });
    return this;
};

// Method to submit task for review
actionSchema.methods.submitForReview = function (data) {
    const now = new Date();

    // Calculate intermediate duration if started
    if (this.timeTracking?.startedAt) {
        const duration = Math.floor((now - this.timeTracking.startedAt) / 1000 / 60);
        this.timeTracking.actualDuration = (this.timeTracking.actualDuration || 0) + duration;
    }

    this.status = 'REVIEW';
    this.stage = this.stage || {};
    this.stage.current = 'REVIEW';
    this.stage.history = this.stage.history || [];
    this.stage.history.push({
        stage: 'REVIEW',
        enteredAt: now
    });

    this.review = {
        requestedAt: now,
        comments: '', // Clear previous comments, wait for reviewer
        status: 'PENDING'
    };

    // Store completion details as "submitted for review"
    this.completion = {
        remarks: data.remarks,
        audioUrl: data.audioUrl,
        audioTranscript: data.audioTranscript,
        submittedBy: data.submittedBy,
        submittedAt: now
    };

    return this;
};

// Method to direct complete task (bypassing review if needed or call from review)
actionSchema.methods.completeTask = function (data) {
    const now = new Date();

    this.status = 'COMPLETED';
    this.timeTracking = this.timeTracking || {};
    this.timeTracking.completedAt = now;

    if (this.timeTracking.startedAt) {
        const duration = Math.floor((now - this.timeTracking.startedAt) / 1000 / 60);
        this.timeTracking.actualDuration = (this.timeTracking.actualDuration || 0) + duration;
    }

    this.stage = this.stage || {};
    this.stage.current = 'COMPLETED';
    this.stage.history = this.stage.history || [];
    this.stage.history.push({
        stage: 'COMPLETED',
        enteredAt: now
    });

    this.completion = {
        remarks: data.remarks,
        audioUrl: data.audioUrl,
        audioTranscript: data.audioTranscript,
        completedBy: data.completedBy,
        completedAt: now
    };

    return this;
};

// Method to review task (APPROVE/REJECT)
actionSchema.methods.reviewTask = function (reviewerId, decision, comments) {
    const now = new Date();

    this.review = this.review || {};
    this.review.reviewedAt = now;
    this.review.reviewedBy = reviewerId;
    this.review.comments = comments;
    this.review.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    if (decision === 'APPROVE') {
        this.status = 'COMPLETED';
        this.timeTracking = this.timeTracking || {};
        this.timeTracking.completedAt = now;
        this.stage.current = 'COMPLETED';

        // Finalize completion details
        this.completion = this.completion || {};
        this.completion.completedAt = now;
        this.completion.completedBy = reviewerId; // Manager completes it
    } else {
        this.status = 'REJECTED';
        this.stage.current = 'NOT_STARTED';

        // Reset time tracking for restart
        if (this.timeTracking) {
            this.timeTracking.startedAt = null;
            this.timeTracking.completedAt = null;
        }
    }

    this.stage.history.push({
        stage: this.stage.current,
        enteredAt: now
    });

    return this;
};

// Method to calculate next occurrence for recurring tasks
actionSchema.methods.calculateNextOccurrence = function () {
    if (!this.recurring?.enabled) return null;

    const now = new Date();
    let nextDate = new Date(now);

    switch (this.recurring.frequency) {
        case 'DAILY':
            nextDate.setDate(nextDate.getDate() + 1);
            break;

        case 'WEEKLY':
            if (this.recurring.daysOfWeek && this.recurring.daysOfWeek.length > 0) {
                // Find next occurrence based on selected days
                const currentDay = now.getDay();
                const sortedDays = this.recurring.daysOfWeek.sort((a, b) => a - b);

                let nextDay = sortedDays.find(day => day > currentDay);
                if (!nextDay) {
                    nextDay = sortedDays[0];
                    nextDate.setDate(nextDate.getDate() + 7);
                }

                const daysToAdd = nextDay - currentDay;
                nextDate.setDate(nextDate.getDate() + daysToAdd);
            } else {
                nextDate.setDate(nextDate.getDate() + 7);
            }
            break;

        case 'MONTHLY':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }

    return nextDate;
};

// Static method to create recurring instance
actionSchema.statics.createRecurringInstance = async function (parentAction) {
    const newAction = new this({
        resolvedAsins: parentAction.resolvedAsins,
        type: parentAction.type,
        title: parentAction.title,
        description: parentAction.description,
        priority: parentAction.priority,
        status: 'PENDING',
        assignedTo: parentAction.assignedTo,
        createdBy: parentAction.createdBy,
        tags: parentAction.tags,
        timeTracking: {
            timeLimit: parentAction.timeTracking?.timeLimit
        },
        stage: {
            current: 'NOT_STARTED',
            history: []
        },
        recurring: {
            enabled: parentAction.recurring.enabled,
            frequency: parentAction.recurring.frequency,
            daysOfWeek: parentAction.recurring.daysOfWeek,
            parentActionId: parentAction._id
        },
        autoGenerated: {
            isAuto: true,
            source: 'RECURRING',
            confidence: 100
        }
    });

    return newAction;
};

module.exports = mongoose.models.Action || mongoose.model('Action', actionSchema);
