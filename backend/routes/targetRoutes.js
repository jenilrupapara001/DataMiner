const express = require('express');
const router = express.Router();
const controller = require('../controllers/targetController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/', authenticate, requirePermission('targets_view'), controller.getTargets);
router.post('/', authenticate, requirePermission('targets_create'), controller.createTargets);
router.put('/', authenticate, requirePermission('targets_edit'), controller.updateTarget);
router.put('/achievements', authenticate, requirePermission('targets_edit'), controller.updateAchievements);
router.delete('/bulk', authenticate, requirePermission('targets_delete'), controller.deleteTargetsBulk);
router.delete('/:id', authenticate, requirePermission('targets_delete'), controller.deleteTarget);

module.exports = router;
