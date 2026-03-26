const express = require('express');
const router = express.Router();
const objectiveController = require('../controllers/objectiveController');
const { authenticate: protect, requireRole } = require('../middleware/auth');

// Validates that the user is logged in
router.use(protect);

// Admin: bulk delete all objectives + KRs + actions
router.delete('/bulk-delete-all', requireRole('admin'), objectiveController.deleteAllObjectives);

router.post('/', objectiveController.createObjective);
router.get('/', objectiveController.getObjectives);
router.put('/:id', objectiveController.updateObjective);
router.delete('/:id', objectiveController.deleteObjective);

// Key Result Routes
router.post('/key-results', protect, objectiveController.createKeyResult);
router.put('/key-results/:id', protect, objectiveController.updateKeyResult);
router.delete('/key-results/:id', protect, objectiveController.deleteKeyResult);
router.post('/key-results/:id/sync', protect, objectiveController.syncKeyResult);

module.exports = router;
