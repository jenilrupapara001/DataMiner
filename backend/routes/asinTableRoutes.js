const express = require('express');
const router = express.Router();
const asinTableController = require('../controllers/asinTableController');
const { authenticate: protect } = require('../middleware/auth');

/**
 * ASIN Table Integration Routes
 */

// GET /api/asins/table
// Unified endpoint for high-performance ASIN intelligence ledger
router.get('/', protect, asinTableController.getAsinTable);

module.exports = router;
