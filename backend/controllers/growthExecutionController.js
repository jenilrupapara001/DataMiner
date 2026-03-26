const Objective = require('../models/Objective');
const Action = require('../models/Action');
const KeyResult = require('../models/KeyResult');
const mongoose = require('mongoose');

/**
 * Growth Execution Controller
 * Implements mandatory API contracts for the high-fidelity dashboard.
 */

// GET /api/goals/current
exports.getCurrentGoal = async (req, res) => {
    try {
        // Find the most recent active monthly/weekly objective
        const objective = await Objective.findOne({
            status: { $in: ['IN_PROGRESS', 'AT_RISK', 'NOT_STARTED'] }
        }).sort({ createdAt: -1 });

        if (!objective) {
            return res.status(404).json({ message: 'No active goal found' });
        }

        // Calculate achieved GMS from Key Results if available
        const krs = await KeyResult.find({ objectiveId: objective._id });
        const gmsKR = krs.find(kr => kr.title.includes('GMS') || kr.measurementMetric === 'GMS');
        
        const achievedGMS = gmsKR ? gmsKR.currentValue : (objective.progress / 100) * (objective.goalSettings?.targetValue || 1000000);
        const targetGMS = objective.goalSettings?.targetValue || 1000000;

        // Determine status based on progress vs time elapsed
        const now = new Date();
        const totalDuration = objective.endDate - objective.startDate;
        const elapsed = now - objective.startDate;
        const expectedProgress = (elapsed / totalDuration) * 100;
        
        let status = 'ON_TRACK';
        if (objective.progress < expectedProgress - 10) status = 'BEHIND';
        if (objective.progress > expectedProgress + 5) status = 'AHEAD';

        res.json({
            id: objective._id,
            name: objective.title,
            targetGMS,
            achievedGMS,
            startDate: objective.startDate,
            endDate: objective.endDate,
            status,
            dailyRequiredRevenue: (targetGMS - achievedGMS) / Math.max(1, (objective.endDate - now) / (1000 * 60 * 60 * 24))
        });
    } catch (error) {
        console.error('Error fetching current goal:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/analytics/performance?goalId=
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const { goalId } = req.query;
        if (!goalId) return res.status(400).json({ message: 'goalId is required' });

        const objective = await Objective.findById(goalId);
        if (!objective) return res.status(404).json({ message: 'Goal not found' });

        // Generate mock-ish but realistic timeline based on objective duration
        // In a real scenario, this would aggregate daily sales from MarketData
        const timeline = [];
        const start = new Date(objective.startDate);
        const end = new Date(objective.endDate);
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const targetGMS = objective.goalSettings?.targetValue || 1000000;
        
        for (let i = 0; i <= Math.min(30, totalDays); i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            if (date > new Date()) break;

            const targetRevenue = (targetGMS / totalDays) * i;
            // Simulated actual revenue with some variance
            const actualRevenue = targetRevenue * (0.85 + Math.random() * 0.25);
            
            timeline.push({
                date: date.toISOString().split('T')[0],
                actualRevenue: Math.round(actualRevenue),
                targetRevenue: Math.round(targetRevenue)
            });
        }

        const lastActual = timeline[timeline.length - 1]?.actualRevenue || 0;
        const lastTarget = timeline[timeline.length - 1]?.targetRevenue || 1;
        const gapPercentage = Math.round(((lastTarget - lastActual) / lastTarget) * 100);

        res.json({
            timeline,
            projectionRevenue: Math.round(lastActual * 1.2), // Simple projection
            gapPercentage,
            expectedFinal: Math.round(targetGMS * (lastActual / lastTarget))
        });
    } catch (error) {
        console.error('Error fetching performance analytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/tasks?filter=
exports.getFilteredTasks = async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};

        if (filter === 'URGENT') query.priority = 'HIGH';
        if (filter === 'AI_SUGGESTED') query.isAISuggested = true;
        
        const actions = await Action.find(query).limit(20);
        
        const formattedTasks = actions.map(action => ({
            id: action._id,
            title: action.title,
            type: action.itemType || 'TASK',
            priority: action.priority,
            status: action.status,
            impactScore: action.impactWeight || Math.floor(Math.random() * 100),
            brandId: action.brandId,
            asinList: action.resolvedAsins || [],
            isAISuggested: action.isAISuggested || false
        }));

        res.json(formattedTasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// GET /api/insights
exports.getIntelligenceInsights = async (req, res) => {
    try {
        // In a production system, this would come from an AI service or scheduled analysis
        const insights = [
            {
                id: '1',
                type: "STOCK",
                message: "3 high-velocity ASINs will go out of stock in 5 days if run rate continues.",
                actionLabel: "Restock Now",
                actionType: "CREATE_TASK"
            },
            {
                id: '2',
                type: "ADS",
                message: "ACoS for 'Electronics' category is 15% above target. High wasted spend detected.",
                actionLabel: "Optimize Bids",
                actionType: "AI_OPTIMIZE"
            },
            {
                id: '3',
                type: "OPPORTUNITY",
                message: "Competitor 'Brand X' is out of stock on top keywords. Opportunity to capture market share.",
                actionLabel: "Increase Aggression",
                actionType: "STRATEGY_SHIFT"
            }
        ];

        res.json(insights);
    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
