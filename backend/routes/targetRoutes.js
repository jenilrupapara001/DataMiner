const express = require('express');
const router = express.Router();
const controller = require('../controllers/targetController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, controller.getTargets);
router.post('/', authenticate, controller.createTargets);
router.put('/', authenticate, controller.updateTarget);
router.put('/achievements', authenticate, controller.updateAchievements);
router.delete('/bulk', authenticate, controller.deleteTargetsBulk);
router.delete('/:id', authenticate, controller.deleteTarget);

module.exports = router;
