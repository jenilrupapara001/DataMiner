const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/systemSettingController');
const { auth, isAdmin, authenticate } = require('../middleware/auth');

// GET settings: any authenticated user can read (needed for ASIN optimization rules etc.)
router.get('/', auth, systemSettingController.getSettings);
router.get('/octoparse-automation', auth, systemSettingController.getOctoparseAutomation);
router.post('/octoparse-automation', auth, isAdmin, systemSettingController.toggleOctoparseAutomation);

router.get('/:key', auth, systemSettingController.getSettingByKey);

// Write routes: admin only
router.post('/update', auth, isAdmin, systemSettingController.updateSettings);
router.post('/test-email', auth, isAdmin, systemSettingController.testEmail);

module.exports = router;
