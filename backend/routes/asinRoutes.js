const express = require('express');
const router = express.Router();
const asinController = require('../controllers/asinController');
const { authenticate: protect, requirePermission, checkSellerAccess } = require('../middleware/auth');

// Priority Actions
router.post('/:id/generate-images', protect, requirePermission('sellers_manage_asins'), asinController.generateImages);

// Search and stats
router.get('/search', protect, requirePermission('sellers_view'), asinController.searchAsins);
router.get('/stats', protect, requirePermission('sellers_view'), asinController.getAsinStats);
router.get('/lqs-top', protect, requirePermission('sellers_view'), asinController.getAsinsByLQS);

// Main routes
router.get('/', protect, requirePermission('sellers_view'), asinController.getAsins);
router.get('/all', protect, requirePermission('sellers_view'), asinController.getAllAsinsWithHistory);
router.get('/seller/:sellerId', protect, requirePermission('sellers_view'), checkSellerAccess, asinController.getAsinsBySeller);

// Trends and week history
router.get('/:id/trends', protect, requirePermission('sellers_view'), asinController.getAsinTrends);
router.put('/:id/week-history', protect, requirePermission('sellers_manage_asins'), asinController.updateWeekHistory);

// CRUD operations
router.post('/', protect, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsin);
router.post('/bulk', protect, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsins);
router.post('/bulk-delete', protect, requirePermission('sellers_manage_asins'), asinController.bulkDeleteAsins);
router.post('/bulk-update', protect, requirePermission('sellers_manage_asins'), asinController.bulkUpdateAsins);
router.post('/bulk-week-history', protect, requirePermission('sellers_manage_asins'), asinController.bulkUpdateWeekHistory);

router.get('/:id', protect, requirePermission('sellers_view'), asinController.getAsin);
router.put('/:id', protect, requirePermission('sellers_manage_asins'), asinController.updateAsin);
router.delete('/:id', protect, requirePermission('sellers_manage_asins'), asinController.deleteAsin);

module.exports = router;
