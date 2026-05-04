const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const asinController = require('../controllers/asinController');
const tagController = require('../controllers/tagController');
const { authenticate: protect, requirePermission, checkSellerAccess } = require('../middleware/auth');
const { getTagsHistory, getTagsSummary } = require('../controllers/tagsHistoryController');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `asin-import-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.txt' || ext === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TXT, and XLSX files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Priority Actions
router.get('/health-check/tags', (req, res) => res.json({ success: true, message: 'Tags routes are definitely active' }));
router.get('/:asinId/tags-history', protect, requirePermission('asinmanager_view'), getTagsHistory);
router.get('/:asinId/tags-summary', protect, requirePermission('asinmanager_view'), getTagsSummary);
router.put('/:asinId/tags', protect, requirePermission('asinmanager_manage'), tagController.updateAsinTags);

router.post('/:id/generate-images', protect, requirePermission('asinmanager_manage'), asinController.generateImages);

// Search and stats
router.get('/search', protect, requirePermission('asinmanager_view'), asinController.searchAsins);
router.get('/stats', protect, requirePermission('asinmanager_view'), asinController.getAsinStats);
router.get('/filters', protect, requirePermission('asinmanager_view'), asinController.getAsinFilterOptions);
router.get('/brands', protect, requirePermission('asinmanager_view'), asinController.getAsinBrands);
router.get('/lqs-top', protect, requirePermission('asinmanager_view'), asinController.getAsinsByLQS);

// Main routes
router.get('/', protect, requirePermission('asinmanager_view'), asinController.getAsins);
router.get('/all', protect, requirePermission('asinmanager_view'), asinController.getAllAsinsWithHistory);
router.get('/seller/:sellerId', protect, requirePermission('asinmanager_view'), checkSellerAccess, asinController.getAsinsBySeller);
router.get('/repair-status/:sellerId', protect, requirePermission('asinmanager_view'), checkSellerAccess, asinController.getRepairJobStatus);
router.post('/repair/:sellerId', protect, requirePermission('asinmanager_manage'), checkSellerAccess, asinController.repairIncompleteAsins);


// Trends and week history
router.get('/:id/trends', protect, requirePermission('asinmanager_view'), asinController.getAsinTrends);
router.get('/:id/subbsr-trend', protect, requirePermission('asinmanager_view'), asinController.getSubBsrTrend);
router.put('/:id/week-history', protect, requirePermission('asinmanager_manage'), asinController.updateWeekHistory);

// CRUD operations
router.post('/', protect, requirePermission('asinmanager_manage'), checkSellerAccess, asinController.createAsin);
router.post('/bulk', protect, requirePermission('asinmanager_manage'), checkSellerAccess, asinController.createAsins);
router.post('/bulk-delete', protect, requirePermission('asinmanager_manage'), asinController.bulkDeleteAsins);
router.post('/bulk-update', protect, requirePermission('asinmanager_manage'), asinController.bulkUpdateAsins);
router.post('/bulk-week-history', protect, requirePermission('asinmanager_manage'), asinController.bulkUpdateWeekHistory);
router.post('/import-csv', protect, requirePermission('asinmanager_import'), upload.single('file'), asinController.importFromCsv);
router.post('/bulk-upload-all-sellers', protect, requirePermission('asinmanager_import'), upload.single('file'), asinController.bulkUploadAllSellers);
router.post('/recalculate-lqs', protect, requirePermission('asinmanager_manage'), asinController.recalculateLqs);

// Raw data upload endpoints (Octoparse format)
router.post('/upload-raw', protect, requirePermission('asinmanager_manage'), asinController.uploadRawAsins);
router.post('/parse-test', protect, requirePermission('asinmanager_manage'), asinController.testParseRaw);

router.post('/export', protect, requirePermission('asinmanager_export'), asinController.exportData);

// Tags routes — must be before /:id to avoid conflict
router.get('/tags', protect, requirePermission('asinmanager_view'), tagController.getTags);
router.get('/tags/template', protect, requirePermission('asinmanager_view'), tagController.downloadTagsTemplate);
router.post('/bulk-tags', protect, requirePermission('asinmanager_manage'), tagController.bulkUpdateTags);
router.post('/tags/bulk', protect, requirePermission('asinmanager_import'), upload.single('file'), tagController.bulkUpdateTagsCSV);
router.get('/:id', protect, requirePermission('asinmanager_view'), asinController.getAsin);
router.put('/:id', protect, requirePermission('asinmanager_manage'), asinController.updateAsin);
router.delete('/:id', protect, requirePermission('asinmanager_manage'), asinController.deleteAsin);

module.exports = router;
