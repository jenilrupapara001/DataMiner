const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

const { authenticate, requirePermission } = require('../middleware/auth');

// Alert routes
router.get('/alerts', authenticate, requirePermission('dashboard_view'), alertsController.getAlerts);
router.get('/alerts/count', authenticate, requirePermission('dashboard_view'), alertsController.getUnreadAlertCount);
router.patch('/alerts/:id', authenticate, requirePermission('dashboard_view'), alertsController.acknowledgeAlert);
router.patch('/alerts/acknowledge-all', authenticate, requirePermission('dashboard_view'), alertsController.acknowledgeAllAlerts);

// Alert rule routes
router.get('/alert-rules', authenticate, requirePermission('rules_view'), alertsController.getAlertRules);
router.post('/alert-rules', authenticate, requirePermission('rules_manage'), alertsController.createAlertRule);

// Execute all rules (root level to avoid :id conflict)
router.post('/execute-all-rules', authenticate, requirePermission('rules_manage'), alertsController.executeAllRules);

// Specific routes with :id pattern
router.patch('/alert-rules/:id/toggle', authenticate, requirePermission('rules_manage'), alertsController.toggleAlertRule);
router.post('/alert-rules/:id/execute', authenticate, requirePermission('rules_manage'), alertsController.executeRule);
router.get('/alert-rules/:id', authenticate, requirePermission('rules_view'), alertsController.getAlertRuleById);
router.put('/alert-rules/:id', authenticate, requirePermission('rules_manage'), alertsController.updateAlertRule);
router.delete('/alert-rules/:id', authenticate, requirePermission('rules_manage'), alertsController.deleteAlertRule);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gms-dashboard-api'
  });
});

module.exports = router;
