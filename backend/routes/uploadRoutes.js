const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate, requirePermission } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/json'
  ];

  const ext = file.originalname.toLowerCase();
  if (allowedTypes.includes(file.mimetype) || 
      ext.endsWith('.csv') || 
      ext.endsWith('.json') || 
      ext.endsWith('.xlsx') || 
      ext.endsWith('.xls')) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls), CSV, and JSON files are accepted'), false);
  }
};

const limits = {
  fileSize: 200 * 1024 * 1024 // 20MB
};

const upload = multer({
  storage,
  fileFilter,
  limits
});

router.post('/upload/upload-monthly', authenticate, upload.single('file'), uploadController.uploadMonthlyData);
router.post('/upload/upload-ads', authenticate, upload.single('file'), uploadController.uploadAdsData);
router.post('/upload/octoparse', authenticate, upload.single('file'), uploadController.uploadOctoparseData);
router.get('/upload/upload-stats', authenticate, uploadController.getUploadStats);

// GMS endpoints
router.post('/upload/upload-gms', authenticate, requirePermission('gms_tracker_import'), upload.single('file'), uploadController.uploadGmsData);
router.get('/upload/gms-data', authenticate, requirePermission('gms_tracker_view'), uploadController.getGmsData);
router.post('/upload/gms-clear', authenticate, requirePermission('gms_tracker_export'), uploadController.clearGmsData);

module.exports = router;
