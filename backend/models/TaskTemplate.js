const mongoose = require('mongoose');

const taskTemplateSchema = new mongoose.Schema({
    // 🧠 BASIC INFO
    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true
    },

    // 🔥 FLEXIBLE TYPE (NO HARD ENUM)
    type: {
        type: String,
        required: true,
        index: true
        // Example: "listing.optimization", "ads.bidding", "inventory.restock"
    },

    // 📂 DYNAMIC CATEGORY SYSTEM
    category: {
        type: String,
        required: true,
        index: true
        // Example: "seo", "ads", "operations", "analytics"
    },

    subCategory: {
        type: String,
        default: null
        // Example: "title", "images", "keywords"
    },

    // 🌍 PLATFORM SUPPORT
    platforms: [{
        type: String
        // Example: "amazon", "flipkart", "shopify"
    }],

    // ⚡ PRIORITY & EFFORT
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },

    estimatedMinutes: {
        type: Number,
        default: 30
    },

    difficulty: {
        type: String,
        enum: ['EASY', 'MEDIUM', 'HARD'],
        default: 'MEDIUM'
    },

    // 🎯 BUSINESS IMPACT
    impactArea: [{
        type: String
        // Example: "revenue", "conversion", "traffic", "profit"
    }],

    expectedImpact: {
        type: String
        // Example: "Increase CTR by 5-10%"
    },

    // 🤖 AI / AUTOMATION READY
    isAIGenerated: {
        type: Boolean,
        default: false
    },

    automationPossible: {
        type: Boolean,
        default: false
    },

    automationType: {
        type: String,
        default: null
        // Example: "script", "api", "manual"
    },

    // 🔗 PLAYBOOK SYSTEM
    playbookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playbook',
        default: null
    },

    // 📊 CONDITIONS (FOR DECISION ENGINE)
    triggerConditions: {
        type: Object,
        default: {}
        // Example:
        // { acos: ">30", conversionRate: "<10" }
    },

    // 🧩 TAGS (SUPER IMPORTANT FOR FLEXIBILITY)
    tags: [{
        type: String
        // Example: ["low-conversion", "high-acos", "seo-fix"]
    }],

    // 🏢 MULTI-TENANT (AGENCY USE)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },

    isGlobal: {
        type: Boolean,
        default: true
    },

    // 🧪 VERSIONING (VERY ADVANCED BUT IMPORTANT)
    version: {
        type: Number,
        default: 1
    }

}, { timestamps: true });

module.exports = mongoose.models.TaskTemplate || mongoose.model('TaskTemplate', taskTemplateSchema);