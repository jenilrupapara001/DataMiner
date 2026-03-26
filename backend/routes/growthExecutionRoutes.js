const express = require('express');
const router = express.Router();
const growthExecutionController = require('../controllers/growthExecutionController');
const { authenticate: protect } = require('../middleware/auth');

/**
 * Growth Execution Engine Routes
 * Exposes mandatory API contracts for the high-fidelity e-commerce dashboard.
 */

// All routes are protected
router.use(protect);

// Goals
router.get('/goals/current', growthExecutionController.getCurrentGoal);

// Performance Analytics
router.get('/analytics/performance', growthExecutionController.getPerformanceAnalytics);

// Tasks
router.get('/tasks', growthExecutionController.getFilteredTasks);

// Intelligence Insights
router.get('/insights', growthExecutionController.getIntelligenceInsights);

module.exports = router;
