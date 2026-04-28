const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    startExport,
    getDownloads,
    downloadFile,
    getExportFields
} = require('../controllers/exportController');

router.post('/start', auth, startExport);
router.get('/downloads', auth, getDownloads);
router.get('/download/:id', auth, downloadFile);
router.get('/fields', auth, getExportFields);

module.exports = router;
