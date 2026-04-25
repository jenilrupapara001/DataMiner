const User = require('../models/User');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

const getResolvedUserResponse = async (user) => {
  const permissions = await user.getPermissions();
  const userData = user.toJSON ? user.toJSON() : user;
  return {
    ...userData,
    permissions: permissions.map(p => p.name)
  };
};

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Get role from body or default to viewer
    let roleId;
    if (req.body.role) {
      const requestedRole = await Role.findOne({ name: req.body.role });
      if (requestedRole) {
        roleId = requestedRole._id;
      }
    }

    if (!roleId) {
      // Get default role (viewer)
      let defaultRole = await Role.findOne({ name: 'viewer' });
      if (!defaultRole) {
        // Lazy create viewer role if not exists
        defaultRole = await Role.create({
          name: 'viewer',
          displayName: 'Viewer',
          description: 'Read-only access to dashboards and reports',
          isSystem: true,
          level: 10,
          color: '#6B7280',
        });
      }
      roleId = defaultRole._id;
    }

    // Create user
    const user = await (await User.create({
      email,
      password,
      firstName,
      lastName,
      role: roleId,
    })).populate({
      path: 'role',
      populate: { path: 'permissions' }
    });

    // Validated: Sync to CometChat
    try {
      const { syncUserToCometChat } = require('../services/cometChatService');
      syncUserToCometChat(user); // Fire and forget, don't block registration
    } catch (chatError) {
      console.error('CometChat Sync Error during registration:', chatError);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    const resolvedUser = await getResolvedUserResponse(user);

    res.status(201).json({
      success: true,
      data: {
        user: resolvedUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).populate({
      path: 'role',
      populate: { path: 'permissions' }
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    await user.updateOne({
      $set: {
        loginAttempts: 0,
        lastLogin: new Date(),
        refreshToken: null,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    const resolvedUser = await getResolvedUserResponse(user);

    res.json({
      success: true,
      data: {
        user: resolvedUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // Find user and check if refresh token matches
    const user = await User.findById(decoded.userId).populate('role');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const tokens = generateTokens(user._id);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: 'role',
        populate: { path: 'permissions' }
      });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const resolvedUser = await getResolvedUserResponse(user);
    res.json({ success: true, data: resolvedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user info' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        firstName,
        lastName,
        phone,
        preferences: { ...preferences },
      },
      { new: true, runValidators: true }
    ).populate('role');

    // Sync to CometChat on profile update
    try {
      const { syncUserToCometChat } = require('../services/cometChatService');
      syncUserToCometChat(user);
    } catch (chatError) {
      console.error('CometChat Sync Error during profile update:', chatError);
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};
