const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const {
    startExport,
    getDownloads,
    getExportStatus,
    downloadFile,
    getExportFields,
    startGmsExport
} = require('../controllers/exportController');
const { startAdsExport } = require('../controllers/exportAdsController');

router.post('/start', auth, startExport);
router.post('/start-ads', auth, startAdsExport);
router.post('/start-gms', auth, startGmsExport);
router.get('/downloads', auth, getDownloads);
router.get('/status/:id', auth, getExportStatus);
router.get('/download/:id', auth, downloadFile);
router.get('/fields', auth, getExportFields);

module.exports = router;
