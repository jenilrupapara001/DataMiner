const express = require('express');
const router = express.Router();
const listingQualityController = require('../controllers/listingQualityController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Analysis triggers (Manual)
router.post('/analyze/:asinId', listingQualityController.analyzeAsin);
router.post('/analyze-batch', listingQualityController.analyzeBatch);

// Specific legacy route mappings (pointing to unified analyzer)
router.post('/analyze-title/:asinId', listingQualityController.analyzeAsin);
router.post('/analyze-bullets/:asinId', listingQualityController.analyzeAsin);
router.post('/analyze-images/:asinId', listingQualityController.analyzeAsin);
router.post('/analyze-description/:asinId', listingQualityController.analyzeAsin);

router.post('/analyze-titles-batch', listingQualityController.analyzeBatch);
router.post('/analyze-bullets-batch', listingQualityController.analyzeBatch);
router.post('/analyze-images-batch', listingQualityController.analyzeBatch);
router.post('/analyze-descriptions-batch', listingQualityController.analyzeBatch);

// Data fetching
router.get('/analysis/:asinId', listingQualityController.getAnalysis);
router.get('/title/:asinId', listingQualityController.getAnalysis); // For backward compatibility

module.exports = router;
