const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const { authenticate: protect } = require('../middleware/auth');

/**
 * GMS Goal Tracking Routes
 */

// Create & Auto-attach
router.post('/', protect, goalController.createGoal);

// Get/Refresh Progress
router.get('/:id/progress', protect, goalController.getProgress);

// List all goals (admin or internal tracking)
router.get('/', protect, goalController.getGoals);

// List by Brand
router.get('/brand/:brandId', protect, goalController.getBrandGoals);

module.exports = router;
