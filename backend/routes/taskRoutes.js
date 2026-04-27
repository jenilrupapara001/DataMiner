const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    generateTasks,
    getTasks,
    updateTaskStatus,
    assignTask,
    deleteTask
} = require('../controllers/taskController');

router.post('/generate', auth, generateTasks);
router.get('/', auth, getTasks);
router.put('/:id/status', auth, updateTaskStatus);
router.put('/:id/assign', auth, assignTask);
router.delete('/:id', auth, deleteTask);

module.exports = router;
