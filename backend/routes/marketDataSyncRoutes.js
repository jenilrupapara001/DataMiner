const express = require('express');
const router = express.Router();
const marketSyncController = require('../controllers/marketDataSyncController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

/**
 * Routes for Discreet Market Data Synchronization.
 * Uses 'market-sync' namespace to avoid provider exposure.
 */

// Basic health check for service
router.get('/status', authenticate, marketSyncController.getSyncStatus);

// Diagnostic route
router.get('/ping', (req, res) => res.json({ message: 'market-sync router is active' }));

// Trigger sync for a specific ASIN
router.post('/sync/:id', authenticate, requirePermission('scraping_manage'), marketSyncController.syncAsin);

// Trigger global sync for all ASINs across all sellers
router.post('/sync-all', authenticate, requirePermission('scraping_manage'), marketSyncController.syncAllAsins);

// Trigger batch sync for all ASINs of a seller
router.post('/sync-all/:sellerId', authenticate, requirePermission('scraping_manage'), checkSellerAccess, marketSyncController.syncSellerAsins);

// Fetch and apply results for a task
router.post('/fetch-results/:sellerId', authenticate, requirePermission('scraping_manage'), checkSellerAccess, marketSyncController.fetchAndApplyResults);

// Ingest results from a specific task or latest task execution
router.post('/ingest-task', authenticate, requirePermission('scraping_manage'), marketSyncController.ingestTaskResults);

// Global ingestion trigger for all sellers
router.post('/ingest-all', authenticate, requirePermission('scraping_manage'), marketSyncController.syncAllSellersResults);

// Setup a new Octoparse Sync Task for a seller by duplicating the master template
router.post('/setup-task/:sellerId', authenticate, requirePermission('scraping_manage'), checkSellerAccess, marketSyncController.setupSellerTask);

// Handle sync data updates (e.g., from webhooks or manual updates)
router.post('/update', authenticate, requirePermission('scraping_manage'), marketSyncController.handleSyncComplete);

// Task Pool Management
router.get('/pool-status', authenticate, requirePermission('scraping_manage'), marketSyncController.getPoolStatus);
router.post('/pool-tasks', authenticate, requirePermission('scraping_manage'), marketSyncController.uploadTaskPool);

// Real-time task status for all sellers
router.get('/tasks', authenticate, requirePermission('scraping_view'), marketSyncController.getGlobalSyncTasks);

// Bulk update seller task IDs
router.post('/bulk-update-tasks', authenticate, requirePermission('scraping_manage'), marketSyncController.bulkUpdateSellerTasks);

// Bulk inject ASIN URLs into associated Octoparse tasks
router.post('/bulk-inject-asins', authenticate, requirePermission('scraping_manage'), marketSyncController.bulkInjectAsinsToTasks);

// Start cloud extraction for a seller's task
router.post('/start-task/:sellerId', authenticate, requirePermission('scraping_manage'), checkSellerAccess, marketSyncController.startTask);

// Fetch and map results for a seller

// Bulk inject raw JSON data manually
router.post('/bulk-inject-json', authenticate, requirePermission('scraping_manage'), marketSyncController.bulkInjectJson);

// Global database integrity repair
router.post('/repair', authenticate, requirePermission('scraping_manage'), marketSyncController.triggerRepair);

module.exports = router;
