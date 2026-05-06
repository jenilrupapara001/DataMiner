const express = require('express');
const router = express.Router();
const ScheduledRunController = require('../controllers/scheduledRunController');
const { protect } = require('../middleware/authMiddleware'); // Assuming project uses standard authMiddleware

// All scheduled runs endpoints are protected by authentication
router.get('/', protect, ScheduledRunController.getScheduledRuns);
router.get('/:id', protect, ScheduledRunController.getScheduledRunDetails);
router.post('/trigger', protect, ScheduledRunController.triggerScheduledRun);

module.exports = router;
