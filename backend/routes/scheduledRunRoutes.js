const express = require('express');
const router = express.Router();
const ScheduledRunController = require('../controllers/scheduledRunController');
const { authenticate: protect } = require('../middleware/auth');

// All scheduled runs endpoints are protected by authentication
router.get('/', protect, ScheduledRunController.getScheduledRuns);
router.get('/:id', protect, ScheduledRunController.getScheduledRunDetails);
router.post('/trigger', protect, ScheduledRunController.triggerScheduledRun);

module.exports = router;
