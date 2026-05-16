const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/temp/' });
const { authenticate: protect } = require('../middleware/auth');

const {
    catalogSync,
    tagsImport,
    downloadCatalogTemplate,
    octoparseJsonUpload
} = require('../controllers/bulkUploadController');

// Catalog sync - upload CSV with Parent ASIN, Child ASIN, SKU
router.post('/catalog-sync', protect, upload.single('file'), catalogSync);

// Tags import - upload CSV with ASIN codes and tags
router.post('/tags-import', protect, upload.single('file'), tagsImport);

// Octoparse JSON ingestion - direct mapping of scraped data
router.post('/octoparse-json', protect, upload.single('file'), octoparseJsonUpload);

// Download empty catalog template
router.get('/catalog-template', protect, downloadCatalogTemplate);

module.exports = router;

