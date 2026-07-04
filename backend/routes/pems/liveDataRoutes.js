const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/pems/liveDataController');

// Public endpoints — no auth required
router.get('/metrics', ctrl.getMetrics);
router.post('/fetch', ctrl.fetchLiveData);

module.exports = router;
