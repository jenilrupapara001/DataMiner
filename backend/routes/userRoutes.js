const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Role & Seller endpoints (must be BEFORE /:id routes)
router.get('/roles', authenticate, userController.getAvailableRoles);
router.get('/sellers', authenticate, userController.getSellersForAssignment);
router.get('/managers', authenticate, userController.getManagers);
router.get('/permissions', authenticate, userController.getGroupedPermissions);

// User CRUD
router.get('/', authenticate, requirePermission('users_view'), userController.getUsers);
router.post('/', authenticate, requirePermission('users_manage'), validate('createUser'), userController.createUser);
router.get('/:id', authenticate, userController.getUser);
router.put('/:id', authenticate, requirePermission('users_manage'), userController.updateUser);
router.delete('/:id', authenticate, requirePermission('users_manage'), userController.deleteUser);

// User status and security
router.put('/:id/toggle-status', authenticate, requirePermission('users_manage'), userController.toggleUserStatus);
router.put('/:id/reset-password', authenticate, requirePermission('users_manage'), validate('changePassword'), userController.resetUserPassword);
router.post('/:id/force-password-reset', authenticate, requirePermission('users_manage'), userController.forcePasswordReset);

// Admin send email
router.post('/send-email', authenticate, requirePermission('users_manage'), userController.sendEmailToUser);

module.exports = router;
