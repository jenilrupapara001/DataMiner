const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sellerAsinTrackerController');
const inventoryTracker = require('../services/sellerInventoryTrackerService');
const { authenticate, requireAnyPermission } = require('../middleware/auth');

// All routes require auth
router.use(authenticate);

// GET  /api/seller-tracker              — list all sellers with Keepa sync stats
router.get('/', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getTrackerList);

// GET  /api/seller-tracker/:sellerId/asins — list all ASINs for a seller
router.get('/:sellerId/asins', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getSellerAsins);

// GET  /api/seller-tracker/:sellerId/inventory-status — detailed inventory status
router.get('/:sellerId/inventory-status', requireAnyPermission(['sellers_view', 'sellers_manage']), async (req, res) => {
    try {
        const status = await inventoryTracker.getInventoryStatus(req.params.sellerId);
        if (!status) return res.status(404).json({ success: false, message: 'Seller not found' });
        res.json({ success: true, data: status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/seller-tracker/inventory/sync — sync inventory for all sellers (must be before /sync/:sellerId)
router.post('/inventory/sync', requireAnyPermission(['sellers_manage']), async (req, res) => {
    try {
        const result = await inventoryTracker.syncAllSellersInventory();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/seller-tracker/inventory/sync/:sellerId — sync inventory for one seller (must be before /sync/:sellerId)
router.post('/inventory/sync/:sellerId', requireAnyPermission(['sellers_manage', 'sellers_manage_asins']), async (req, res) => {
    try {
        const result = await inventoryTracker.syncSellerInventory(req.params.sellerId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/seller-tracker/inventory/token-status — get Keepa token status
router.get('/inventory/token-status', requireAnyPermission(['sellers_view', 'sellers_manage']), async (req, res) => {
    try {
        const status = await inventoryTracker.getTokenStatus();
        res.json({ success: true, data: status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/seller-tracker/sync/:sellerId — sync one seller from Keepa
router.post('/sync/:sellerId', requireAnyPermission(['sellers_manage', 'sellers_manage_asins']), ctrl.syncSeller);

// POST /api/seller-tracker/sync-all    — sync all sellers from Keepa
router.post('/sync-all', requireAnyPermission(['sellers_manage']), ctrl.syncAll);

// GET /api/seller-tracker/:sellerId/activities — list activities for a seller
router.get('/:sellerId/activities', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getSellerActivities);

// GET /api/seller-tracker/:sellerId/tasks — list tasks for a seller
router.get('/:sellerId/tasks', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getSellerTasks);

// POST /api/seller-tracker/:sellerId/tasks — create a task for a seller
router.post('/:sellerId/tasks', requireAnyPermission(['sellers_manage']), ctrl.createSellerTask);

module.exports = router;
