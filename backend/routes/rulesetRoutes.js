const express = require('express');
const router = express.Router();
const rulesetController = require('../controllers/rulesetController');

const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/rulesets', authenticate, requirePermission('rules_view'), rulesetController.getAllRulesets);
router.get('/rulesets/:id', authenticate, requirePermission('rules_view'), rulesetController.getRulesetById);
router.post('/rulesets', authenticate, requirePermission('rules_manage'), rulesetController.createRuleset);
router.put('/rulesets/:id', authenticate, requirePermission('rules_manage'), rulesetController.updateRuleset);
router.delete('/rulesets/:id', authenticate, requirePermission('rules_manage'), rulesetController.deleteRuleset);
router.patch('/rulesets/:id/toggle', authenticate, requirePermission('rules_manage'), rulesetController.toggleRuleset);
router.post('/rulesets/:id/execute', authenticate, requirePermission('rules_manage'), rulesetController.executeRuleset);
router.post('/rulesets/:id/preview', authenticate, requirePermission('rules_view'), rulesetController.previewRuleset);
router.get('/rulesets/:id/history', authenticate, requirePermission('rules_view'), rulesetController.getRulesetHistory);
router.get('/rulesets/history/:logId', authenticate, requirePermission('rules_view'), rulesetController.getExecutionDetails);
router.post('/rulesets/:id/duplicate', authenticate, requirePermission('rules_manage'), rulesetController.duplicateRuleset);

module.exports = router;