const express = require('express');
const router = express.Router();
const objectiveController = require('../controllers/objectiveController');
const tasksPageController = require('../controllers/tasksPageController');
const { authenticate: protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Validates that the user is logged in
router.use(protect);

// Admin: bulk delete all objectives + KRs + actions
router.delete('/bulk-delete-all', requireRole('admin'), objectiveController.deleteAllObjectives);

router.post('/', validate('createObjective'), objectiveController.createObjective);
router.get('/', objectiveController.getObjectives);
router.put('/:id', objectiveController.updateObjective);
router.delete('/:id', objectiveController.deleteObjective);

// Key Result Routes
router.post('/key-results', protect, objectiveController.createKeyResult);
router.put('/key-results/:id', protect, objectiveController.updateKeyResult);
router.delete('/key-results/:id', protect, objectiveController.deleteKeyResult);
router.post('/key-results/:id/sync', protect, objectiveController.syncKeyResult);

// TasksPage consolidated overview - returns all data in one call
router.get('/overview', tasksPageController.getOverview);

module.exports = router;
