const mongoose = require('mongoose');
const TaskTemplate = require('./models/TaskTemplate');
const GoalTemplate = require('./models/GoalTemplate');
require('dotenv').config();

const templates = [
    {
        title: 'Title SEO Optimization',
        description: 'Audit and update product title with high-volume keywords and clarity.',
        type: 'TITLE_OPTIMIZATION',
        priority: 'MEDIUM',
        estimatedMinutes: 45,
        category: 'SEO & Content'
    },
    {
        title: 'A+ Content Audit',
        description: 'Review A+ content for mobile optimization and conversion rate improvements.',
        type: 'A_PLUS_CONTENT',
        priority: 'HIGH',
        estimatedMinutes: 60,
        category: 'SEO & Content'
    },
    {
        title: 'Competitor Price Analysis',
        description: 'Monitor competitor pricing and adjust map pricing strategy accordingly.',
        type: 'PRICING_STRATEGY',
        priority: 'HIGH',
        estimatedMinutes: 30,
        category: 'Sales & Marketing'
    },
    {
        title: 'Inventory Health Check',
        description: 'Check IPI scores and identify slow-moving stock for liquidation.',
        type: 'INVENTORY_MANAGEMENT',
        priority: 'MEDIUM',
        estimatedMinutes: 40,
        category: 'Operations & General'
    },
    {
        title: 'Account Health Review',
        description: 'Verify account performance metrics and address any policy warnings.',
        type: 'GENERAL_OPTIMIZATION',
        priority: 'URGENT',
        estimatedMinutes: 20,
        category: 'Operations & General'
    }
];

const goalTemplates = [
    {
        name: 'Growth Strategy',
        description: 'Multi-phase approach to scale account GMS and brand awareness.',
        goals: [
            { title: 'Listing Audit & SEO', metric: 'LISTING', targetValue: 90 },
            { title: 'Brand Visibility & Ads', metric: 'ADS_SPEND', targetValue: 200000 },
            { title: 'GMS Growth', metric: 'GMS', targetValue: 5000000 }
        ]
    },
    {
        name: 'Profit Maximization',
        description: 'Focused on reducing ACOS and improving net profit margins.',
        goals: [
            { title: 'Ad Spend Optimization', metric: 'ACOS', targetValue: 15 },
            { title: 'PO Fulfilment Excellence', metric: 'PO_FULFILLMENT', targetValue: 98 },
            { title: 'Inventory Liquidations', metric: 'NONE', targetValue: 100 }
        ]
    }
];

const seedTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://jenil:jenilpatel@aiap.sedzp3h.mongodb.net/aiap?retryWrites=true&w=majority&appName=aiap');
        console.log('Connected to MongoDB');

        await TaskTemplate.deleteMany({});
        await TaskTemplate.insertMany(templates);

        await GoalTemplate.deleteMany({});
        await GoalTemplate.insertMany(goalTemplates);

        console.log('Task and Goal Templates seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedTemplates();
