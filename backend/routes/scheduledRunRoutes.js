const express = require('express');
const router = express.Router();
const ScheduledRunController = require('../controllers/scheduledRunController');
const { authenticate: protect } = require('../middleware/auth');

// All scheduled runs endpoints are protected by authentication
router.get('/', protect, ScheduledRunController.getScheduledRuns);
router.get('/seller-logs/:sellerId', protect, ScheduledRunController.getSellerLogs);
router.get('/seller-metrics', protect, ScheduledRunController.getSellerMetrics);
router.get('/:id', protect, ScheduledRunController.getScheduledRunDetails);
router.post('/trigger', protect, ScheduledRunController.triggerScheduledRun);

module.exports = router;
