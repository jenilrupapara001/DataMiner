const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requirePermission } = require('../middleware/auth');

// New helper routes for dropdowns
router.get('/managers', authenticate, userController.getManagers);
router.get('/roles', authenticate, userController.getAvailableRoles);
router.get('/sellers', authenticate, userController.getSellersForAssignment);

// Main user CRUD
router.get('/', authenticate, requirePermission('users_view'), userController.getUsers);
router.get('/:id', authenticate, userController.getUser);
router.post('/', authenticate, requirePermission('users_create'), userController.createUser);
router.put('/:id', authenticate, requirePermission('users_edit'), userController.updateUser);
router.delete('/:id', authenticate, requirePermission('users_delete'), userController.deleteUser);

// User status and security
router.put('/:id/toggle-status', authenticate, requirePermission('users_edit'), userController.toggleUserStatus);
router.put('/:id/reset-password', authenticate, requirePermission('users_edit'), userController.resetUserPassword);

module.exports = router;
