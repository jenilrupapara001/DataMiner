const express = require('express');
const router = express.Router();
const controller = require('../controllers/dataController');
const dashboardController = require('../controllers/dashboardController');

const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/master-revenue', authenticate, requirePermission('skureport_view'), controller.getMasterWithRevenue);
router.get('/chart-data', authenticate, requirePermission('dashboard_view'), controller.getChartData); // Monthly trend
router.get('/chart-size-bar', authenticate, requirePermission('dashboard_view'), controller.getRevenueBySize); // Revenue by size
router.get('/chart-size-pie', authenticate, requirePermission('dashboard_view'), controller.getSizeShare); // Size share pie
router.get('/data/ads-report', authenticate, requirePermission('adsreport_view'), controller.getAdsReport);
router.get('/data/sku-report', authenticate, requirePermission('skureport_view'), controller.getSkuReport);
router.get('/data/parent-asin-report', authenticate, requirePermission('parentreport_view'), controller.getParentAsinReport);
router.get('/data/month-wise-report', authenticate, requirePermission('monthlyreport_view'), controller.getMonthWiseReport);
router.get('/categories', authenticate, controller.getCategories); // Category options
router.get('/search', authenticate, controller.globalSearch);
router.get('/dashboard', authenticate, requirePermission('dashboard_view'), dashboardController.getDashboardData);

module.exports = router;
