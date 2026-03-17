const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const config = require('../config/env');

// Demo mode bypass for development
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';

exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // DEBUG: Log auth attempt
  console.log('[DEBUG] Auth middleware:', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.substring(0, 20),
    demoMode: DEMO_MODE,
    dbState: mongoose.connection.readyState
  });

  // DEMO_MODE: only bypass auth when there is no real token provided
  if (DEMO_MODE && (!authHeader || !authHeader.startsWith('Bearer '))) {
    req.userId = 'demo-user';
    req.user = { _id: 'demo-user', role: { name: 'admin' }, assignedSellers: [] };
    console.log('[DEBUG] Demo mode enabled, using fallback user');
    return next();
  }

  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check if MongoDB is currently connected before attempting a DB lookup
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      // Fall back to JWT payload — avoids the 10s buffer timeout when Atlas is down
      console.warn('[Auth] MongoDB not connected — using JWT payload as fallback');
      let userId;
      try { userId = new mongoose.Types.ObjectId(decoded.userId); } catch { userId = decoded.userId; }
      req.userId = userId;
      req.user = {
        _id: userId,
        email: decoded.email,
        role: decoded.role || { name: 'admin' },
        assignedSellers: decoded.assignedSellers || [],
        isActive: true,
        hasPermission: async () => true,
        hasAnyPermission: async () => true,
      };
      return next();
    }

    const user = await User.findById(decoded.userId)
      .populate('role')
      .populate('role.permissions')
      .populate('assignedSellers');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};


exports.requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // Admin has all permissions
      if (req.user.role && req.user.role.name === 'admin') {
        return next();
      }

      const hasPermission = await req.user.hasPermission(permissionName);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

exports.requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // Admin has all permissions
      if (req.user.role && req.user.role.name === 'admin') {
        return next();
      }

      const hasPermission = await req.user.hasAnyPermission(permissionNames);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!req.user.role || !roles.includes(req.user.role.name)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have the required role'
      });
    }

    next();
  };
};

// Middleware to check if user has access to a specific seller
exports.checkSellerAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const isAdmin = req.user.role && req.user.role.name === 'admin';
    if (isAdmin) {
      return next();
    }

    const sellerId = req.params.sellerId || req.body.sellerId || req.query.sellerId;
    if (!sellerId) {
      return next(); // If no sellerId is provided, we skip this check (it should be handled by validators if required)
    }

    const assignedSellers = req.user.assignedSellers.map(s => s._id.toString());
    if (!assignedSellers.includes(sellerId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this seller\'s data'
      });
    }

    next();
  } catch (error) {
    console.error('Seller access check error:', error);
    res.status(500).json({ success: false, message: 'Seller access check failed' });
  }
};

// Middleware to check if user has access to another user based on hierarchy
exports.checkUserHierarchyAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const targetUserId = req.params.id;
    if (!targetUserId) return next();

    // 1. Self access is always allowed
    if (req.user._id.toString() === targetUserId) {
      return next();
    }

    // 2. Admin access is always allowed
    if (req.user.role && req.user.role.name === 'admin') {
      return next();
    }

    // 3. Check if user has global users_view permission (e.g., HR, Manager with global view)
    const hasGlobalView = await req.user.hasPermission('users_view');
    if (hasGlobalView) {
      return next();
    }

    // 4. Check if target user is a subordinate
    const hierarchyService = require('../services/hierarchyService');
    const subordinates = await hierarchyService.getSubordinateIds(req.user._id);

    if (subordinates.includes(targetUserId)) {
      return next();
    }

    // 5. Fallback to 403
    res.status(403).json({
      success: false,
      message: 'You do not have permission to access this user\'s profile'
    });
  } catch (error) {
    console.error('Hierarchy access check error:', error);
    res.status(500).json({ success: false, message: 'Hierarchy access check failed' });
  }
};

exports.auth = exports.authenticate;
exports.isAdmin = exports.requireRole('admin');
