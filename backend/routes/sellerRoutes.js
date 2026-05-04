const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

router.get('/', authenticate, requirePermission('seller_view'), sellerController.getSellers);
router.get('/:id', authenticate, requirePermission('seller_view'), checkSellerAccess, sellerController.getSeller);
router.post('/', authenticate, requirePermission('seller_manage'), sellerController.createSeller);
router.put('/:id', authenticate, requirePermission('seller_manage'), checkSellerAccess, sellerController.updateSeller);
router.delete('/:id', authenticate, requirePermission('seller_manage'), checkSellerAccess, sellerController.deleteSeller);
router.post('/import', authenticate, requirePermission('seller_manage'), sellerController.importSellers);

module.exports = router;
