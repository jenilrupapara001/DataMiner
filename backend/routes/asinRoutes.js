const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const asinController = require('../controllers/asinController');
const tagController = require('../controllers/tagController');
const { authenticate: protect, requirePermission, checkSellerAccess } = require('../middleware/auth');

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
router.post('/:id/generate-images', protect, requirePermission('sellers_manage_asins'), asinController.generateImages);

// Search and stats
router.get('/search', protect, requirePermission('sellers_view'), asinController.searchAsins);
router.get('/stats', protect, requirePermission('sellers_view'), asinController.getAsinStats);
router.get('/filters', protect, requirePermission('sellers_view'), asinController.getAsinFilterOptions);
router.get('/brands', protect, requirePermission('sellers_view'), asinController.getAsinBrands);
router.get('/lqs-top', protect, requirePermission('sellers_view'), asinController.getAsinsByLQS);

// Main routes
router.get('/', protect, requirePermission('sellers_view'), asinController.getAsins);
router.get('/all', protect, requirePermission('sellers_view'), asinController.getAllAsinsWithHistory);
router.get('/seller/:sellerId', protect, requirePermission('sellers_view'), checkSellerAccess, asinController.getAsinsBySeller);
router.get('/repair-status/:sellerId', protect, requirePermission('sellers_view'), checkSellerAccess, asinController.getRepairJobStatus);
router.post('/repair/:sellerId', protect, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.repairIncompleteAsins);


// Trends and week history
router.get('/:id/trends', protect, requirePermission('sellers_view'), asinController.getAsinTrends);
router.put('/:id/week-history', protect, requirePermission('sellers_manage_asins'), asinController.updateWeekHistory);

// CRUD operations
router.post('/', protect, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsin);
router.post('/bulk', protect, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsins);
router.post('/bulk-delete', protect, requirePermission('sellers_manage_asins'), asinController.bulkDeleteAsins);
router.post('/bulk-update', protect, requirePermission('sellers_manage_asins'), asinController.bulkUpdateAsins);
router.post('/bulk-week-history', protect, requirePermission('sellers_manage_asins'), asinController.bulkUpdateWeekHistory);
router.post('/import-csv', protect, requirePermission('sellers_manage_asins'), upload.single('file'), asinController.importFromCsv);

// Raw data upload endpoints (Octoparse format)
router.post('/upload-raw', protect, requirePermission('sellers_manage_asins'), asinController.uploadRawAsins);
router.post('/parse-test', protect, requirePermission('sellers_manage_asins'), asinController.testParseRaw);

router.post('/export', protect, requirePermission('sellers_view'), asinController.exportData);

// Tags routes — must be before /:id to avoid conflict
router.get('/tags', protect, requirePermission('sellers_view'), tagController.getTags);
router.get('/tags/template', protect, requirePermission('sellers_view'), tagController.downloadTagsTemplate);
router.post('/tags/bulk', protect, requirePermission('sellers_manage_asins'), upload.single('file'), tagController.bulkUpdateTags);
router.put('/:asinId/tags', protect, requirePermission('sellers_manage_asins'), tagController.updateAsinTags);

router.get('/:id', protect, requirePermission('sellers_view'), asinController.getAsin);
router.put('/:id', protect, requirePermission('sellers_manage_asins'), asinController.updateAsin);
router.delete('/:id', protect, requirePermission('sellers_manage_asins'), asinController.deleteAsin);

module.exports = router;
