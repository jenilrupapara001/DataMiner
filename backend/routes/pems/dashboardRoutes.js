const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const dc = require('../../controllers/pems/dashboardController');

router.get('/summary', auth, dc.getSummary);
router.get('/live-tasks', auth, dc.getLiveTasks);
router.get('/activity-feed', auth, dc.getActivityFeed);

module.exports = router;
