const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const setupWizardController = require('../controllers/setupWizardController');

router.get('/status', authenticate, setupWizardController.getStatus);
router.post('/step/:stepName/complete', authenticate, setupWizardController.completeStep);
router.post('/password', authenticate, setupWizardController.changePassword);
router.post('/complete', authenticate, setupWizardController.completeWizard);

module.exports = router;
