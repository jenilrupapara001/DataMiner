const express = require('express');
const router = express.Router();
const aiGoalController = require('../controllers/aiGoalController');
const aiTaskController = require('../controllers/aiTaskController');
const { authenticate } = require('../middleware/auth');

/**
 * Brandcentral AI Strategy Routes
 * 
 * These endpoints power the intent-based Growth Execution Engine.
 */

// AI GOAL LIFECYCLE
router.post('/goals/ai-preview', authenticate, aiGoalController.getPreview);
router.post('/goals/ai-create', authenticate, aiGoalController.createFullStrategy);

// AI TASK LIFECYCLE
router.post('/tasks/ai-create', authenticate, aiTaskController.createEnrichedTask);
router.post('/generate-recovery-tasks', authenticate, aiTaskController.generateRecoveryTasks);

module.exports = router;
