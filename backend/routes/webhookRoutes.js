const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authenticate, requirePermission } = require('../middleware/auth');

// All routes require authentication; admin-level for write operations

// GET /api/webhooks/events — list all event types (must come before /:id)
router.get('/events', authenticate, requirePermission('dashboard_view'), webhookController.getEventTypes);

// GET /api/webhooks/logs — delivery logs
router.get('/logs', authenticate, requirePermission('dashboard_view'), webhookController.getWebhookLogs);

// GET /api/webhooks — list all webhooks
router.get('/', authenticate, requirePermission('dashboard_view'), webhookController.getWebhooks);

// POST /api/webhooks — create new webhook
router.post('/', authenticate, requirePermission('rules_manage'), webhookController.createWebhook);

// POST /api/webhooks/:id/test — send test event
router.post('/:id/test', authenticate, requirePermission('rules_manage'), webhookController.testWebhookById);

// PUT /api/webhooks/:id — update webhook
router.put('/:id', authenticate, requirePermission('rules_manage'), webhookController.updateWebhook);

// DELETE /api/webhooks/:id — delete webhook
router.delete('/:id', authenticate, requirePermission('rules_manage'), webhookController.deleteWebhook);

module.exports = router;
