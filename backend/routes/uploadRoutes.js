const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

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

  if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.json')) {
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

router.post('/upload/upload-monthly', upload.single('file'), uploadController.uploadMonthlyData);
router.post('/upload/upload-ads', upload.single('file'), uploadController.uploadAdsData);
router.post('/upload/octoparse', upload.single('file'), uploadController.uploadOctoparseData);
router.get('/upload/upload-stats', uploadController.getUploadStats);

module.exports = router;
