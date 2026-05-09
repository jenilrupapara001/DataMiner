const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { authenticate: protect, requirePermission } = require('../middleware/auth');

router.use(protect); // Protect all routes
router.use(requirePermission('apikeys_manage')); // Enforce API Keys permission

router.get('/', apiKeyController.getKeys);
router.post('/', apiKeyController.createKey);
router.put('/:id', apiKeyController.updateKey);
router.delete('/:id', apiKeyController.deleteKey);
router.get('/:id/reveal', apiKeyController.revealKey);

module.exports = router;
