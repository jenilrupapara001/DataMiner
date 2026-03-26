const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const { authenticate: protect } = require('../middleware/auth');

/**
 * Revenue Engine Routes
 */

// GET /api/revenue/summary
// Query params: asin, startDate, endDate, (optional) month, period
router.get('/summary', protect, revenueController.getSummary);

module.exports = router;
