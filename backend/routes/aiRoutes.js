const express = require('express');
const router = express.Router();
const aiGoalController = require('../controllers/aiGoalController');
const aiTaskController = require('../controllers/aiTaskController');

/**
 * Brandcentral AI Strategy Routes
 * 
 * These endpoints power the intent-based Growth Execution Engine.
 */

// AI GOAL LIFECYCLE
router.post('/goals/ai-preview', aiGoalController.getPreview);
router.post('/goals/ai-create', aiGoalController.createFullStrategy);

// AI TASK LIFECYCLE
router.post('/tasks/ai-create', aiTaskController.createEnrichedTask);
router.post('/generate-recovery-tasks', aiTaskController.generateRecoveryTasks);

module.exports = router;
