const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('../../controllers/pems/liveDataController');
const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/metrics', ctrl.getMetrics);
router.post('/fetch', ctrl.fetchLiveData);
router.post('/upload', upload.single('file'), ctrl.uploadAndProcess);
router.get('/progress/:jobId', ctrl.getProgress);
router.get('/results/:jobId', ctrl.getResults);
router.get('/download/:jobId', ctrl.downloadResults);
router.post('/cancel/:jobId', ctrl.cancelJob);
router.get('/creds-stats', (req, res) => res.json({ success: true, data: CreatorsApiCredentials.getStats() }));

// V2 — locked to secondary credential only
router.post('/v2/fetch', ctrl.fetchLiveDataV2);
router.post('/v2/upload', upload.single('file'), ctrl.uploadAndProcessV2);
router.get('/v2/progress/:jobId', ctrl.getProgressV2);
router.get('/v2/results/:jobId', ctrl.getResultsV2);
router.get('/v2/download/:jobId', ctrl.downloadResultsV2);
router.post('/v2/cancel/:jobId', ctrl.cancelJobV2);

module.exports = router;
