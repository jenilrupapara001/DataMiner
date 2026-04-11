const express = require('express');
const router = express.Router();
const rulesetController = require('../controllers/rulesetController');

const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/rulesets', authenticate, requirePermission('settings_view'), rulesetController.getAllRulesets);
router.get('/rulesets/:id', authenticate, requirePermission('settings_view'), rulesetController.getRulesetById);
router.post('/rulesets', authenticate, requirePermission('settings_edit'), rulesetController.createRuleset);
router.put('/rulesets/:id', authenticate, requirePermission('settings_edit'), rulesetController.updateRuleset);
router.delete('/rulesets/:id', authenticate, requirePermission('settings_edit'), rulesetController.deleteRuleset);
router.patch('/rulesets/:id/toggle', authenticate, requirePermission('settings_edit'), rulesetController.toggleRuleset);
router.post('/rulesets/:id/execute', authenticate, requirePermission('settings_edit'), rulesetController.executeRuleset);
router.post('/rulesets/:id/preview', authenticate, requirePermission('settings_view'), rulesetController.previewRuleset);
router.get('/rulesets/:id/history', authenticate, requirePermission('settings_view'), rulesetController.getRulesetHistory);
router.get('/rulesets/history/:logId', authenticate, requirePermission('settings_view'), rulesetController.getExecutionDetails);
router.post('/rulesets/:id/duplicate', authenticate, requirePermission('settings_edit'), rulesetController.duplicateRuleset);

module.exports = router;