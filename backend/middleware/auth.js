const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../database/db');
const config = require('../config/env');

const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';

/**
 * SQL-based Authentication Middleware
 */
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (DEMO_MODE) {
    req.userId = 'demo-user';
    req.user = {
      Id: 'demo-user',
      _id: 'demo-user',
      role: { Name: 'admin', name: 'admin' },
      assignedSellers: [],
      isActive: true,
      hasPermission: async () => true,
      hasAnyPermission: async () => true
    };
    return next();
  }

  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    const pool = await getPool();

    // 1. Fetch User and Role
    const userResult = await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .query(`
        SELECT U.*, R.Name as RoleName, R.DisplayName as RoleDisplayName 
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        WHERE U.Id = @id
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const userData = userResult.recordset[0];
    if (!userData.IsActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // 2. Fetch Permissions
    const permissionsResult = await pool.request()
      .input('roleId', sql.VarChar, userData.RoleId)
      .query(`
        SELECT P.Name 
        FROM Permissions P
        JOIN RolePermissions RP ON P.Id = RP.PermissionId
        WHERE RP.RoleId = @roleId
      `);
    const permissions = permissionsResult.recordset.map(p => p.Name);

    // 3. Fetch Assigned Sellers
    const sellersResult = await pool.request()
      .input('userId', sql.VarChar, userData.Id)
      .query(`SELECT SellerId FROM UserSellers WHERE UserId = @userId`);
    const assignedSellers = sellersResult.recordset.map(s => s.SellerId);

    // 4. Construct User Object
    req.userId = userData.Id;
    req.user = {
      ...userData,
      _id: userData.Id, // Compatibility with legacy code
      role: { Name: userData.RoleName, name: userData.RoleName, DisplayName: userData.RoleDisplayName },
      assignedSellers: assignedSellers,
      permissions: permissions,
      hasPermission: async (perm) => permissions.includes(perm),
      hasAnyPermission: async (perms) => perms.some(p => permissions.includes(p))
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * Require Permission Middleware (SQL Version)
 */
exports.requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.role?.name === 'admin' || req.user.role?.Name === 'admin') return next();

    const hasPerm = await req.user.hasPermission(permissionName);
    if (!hasPerm) return res.status(403).json({ success: false, message: 'Missing required permission' });
    next();
  };
};

/**
 * Require Any Permission Middleware (SQL Version)
 */
exports.requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.role?.name === 'admin' || req.user.role?.Name === 'admin') return next();

    const hasAny = await req.user.hasAnyPermission(permissionNames);
    if (!hasAny) return res.status(403).json({ success: false, message: 'Missing required permissions' });
    next();
  };
};

/**
 * Require Role Middleware (SQL Version)
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const currentRole = req.user.role?.Name || req.user.role?.name || req.user.role;
    if (!roles.includes(currentRole)) return res.status(403).json({ success: false, message: 'Required role not found' });
    next();
  };
};

/**
 * Check Seller Access Middleware (SQL Version)
 */
exports.checkSellerAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  const roleName = req.user.role?.Name || req.user.role?.name;
  const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
  if (isGlobalUser) return next();

  const sellerId = req.params.sellerId || req.body.sellerId || req.query.sellerId || req.params.id; // Added params.id as fallback for some routes
  if (!sellerId) return next();

  if (!req.user.assignedSellers.includes(sellerId.toString())) {
    return res.status(403).json({ success: false, message: 'Access to this seller denied' });
  }
  next();
};

/**
 * Check User Hierarchy Access Middleware (SQL Version)
 */
exports.checkUserHierarchyAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  const targetUserId = req.params.id;
  if (!targetUserId || req.user.Id === targetUserId || req.user._id === targetUserId) return next();

  const roleName = req.user.role?.Name || req.user.role?.name;
  if (['admin', 'operational_manager'].includes(roleName)) return next();

  const hasGlobalView = await req.user.hasPermission('users_view');
  if (hasGlobalView) return next();

  try {
    const pool = await getPool();
    // Simplified: Check if target user has the current user as supervisor
    const supervisorResult = await pool.request()
      .input('userId', sql.VarChar, targetUserId)
      .input('supervisorId', sql.VarChar, req.user.Id || req.user._id)
      .query('SELECT 1 FROM UserSupervisors WHERE UserId = @userId AND SupervisorId = @supervisorId');

    if (supervisorResult.recordset.length > 0) return next();

    res.status(403).json({ success: false, message: 'Access denied: User is not in your hierarchy' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Hierarchy check failed' });
  }
};

exports.auth = exports.authenticate;
exports.isAdmin = exports.requireRole('admin');
exports.isGlobalUser = exports.requireRole('admin', 'operational_manager');
