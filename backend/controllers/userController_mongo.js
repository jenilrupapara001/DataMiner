const User = require('../models/User');
const Role = require('../models/Role');

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    
    if (!isGlobalUser) {
      const hierarchyService = require('../services/hierarchyService');
      const subordinates = await hierarchyService.getSubordinateIds(req.user._id);
      query.$or = [
        { _id: req.user._id }, // Include self
        { _id: { $in: subordinates } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .populate('role', 'name displayName color level')
        .populate('assignedSellers', 'name marketplace')
        .populate('supervisors', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
};

exports.getManagers = async (req, res) => {
  try {
    // Find roles that qualify as managers (admin, manager, or Brand Manager)
    const roles = await Role.find({ name: { $in: ['admin', 'manager', 'Brand Manager'] } });
    const roleIds = roles.map(r => r._id);

    const managers = await User.find({
      role: { $in: roleIds },
      isActive: true
    })
      .select('firstName lastName email role')
      .populate('role', 'name displayName');

    res.json({
      success: true,
      data: managers
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ success: false, message: 'Failed to get managers' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('role')
      .populate('role.permissions')
      .populate('assignedSellers', 'name marketplace')
      .populate('supervisors', 'firstName lastName email');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role: roleId, assignedSellers } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Verify role exists
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: roleId,
      assignedSellers: assignedSellers || [],
      supervisors: req.body.supervisors || [],
      extraPermissions: req.body.extraPermissions || [],
      excludedPermissions: req.body.excludedPermissions || [],
      createdBy: req.user._id,
    });

    // Validated: Sync to CometChat
    try {
      const { syncUserToCometChat } = require('../services/cometChatService');
      syncUserToCometChat(user);
    } catch (chatError) {
      console.error('CometChat Sync Error during user creation:', chatError);
    }

    await user.populate('role', 'name displayName color');

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phone, role: roleId, isActive, assignedSellers } = req.body;

    const userToUpdate = await User.findById(req.params.id).populate('role');
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role-based hierarchical check
    const currentUserRoleLevel = req.user.role?.level || 0;
    const targetUserRoleLevel = userToUpdate.role?.level || 0;
    const roleName = req.user?.role?.name || req.user?.role;
    const isAdmin = roleName === 'admin';
    const isOperationalManager = roleName === 'operational_manager';

    if (!isAdmin && targetUserRoleLevel >= currentUserRoleLevel && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You cannot update a user with a higher or equal role level' });
    }

    const updateData = { firstName, lastName, phone, isActive };

    if (assignedSellers) {
      updateData.assignedSellers = assignedSellers;
    }

    if (req.body.supervisors) {
      updateData.supervisors = req.body.supervisors;
    }

    if (req.body.extraPermissions) {
      updateData.extraPermissions = req.body.extraPermissions;
    }

    if (req.body.excludedPermissions) {
      updateData.excludedPermissions = req.body.excludedPermissions;
    }

    if (roleId) {
      const newRole = await Role.findById(roleId);
      if (!newRole) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      // Prevent non-admins from promoting users to higher/equal level
      if (!isAdmin && newRole.level >= currentUserRoleLevel) {
        return res.status(403).json({ success: false, message: 'You cannot assign a role level higher than or equal to your own' });
      }

      updateData.role = roleId;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('role');

    // Sync to CometChat on update
    try {
      const { syncUserToCometChat } = require('../services/cometChatService');
      syncUserToCometChat(updatedUser);
    } catch (chatError) {
      console.error('CometChat Sync Error during user update:', chatError);
    }

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('role');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const roleName = req.user?.role?.name || req.user?.role;
    const isAdmin = roleName === 'admin';

    // ONLY Super Admin can delete users
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can delete users' });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const uid = require('../services/cometChatService').sanitizeUid(user.email);
    await User.findByIdAndDelete(req.params.id);

    // Sync to CometChat on deletion
    try {
      const { deleteFromCometChat } = require('../services/cometChatService');
      deleteFromCometChat(uid); // Fire and forget
    } catch (chatError) {
      console.error('CometChat Deletion Error:', chatError);
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('role');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role-based hierarchical check
    const currentUserRoleLevel = req.user.role?.level || 0;
    const targetUserRoleLevel = user.role?.level || 0;
    const isAdmin = req.user.role?.name === 'admin';

    if (!isAdmin && targetUserRoleLevel >= currentUserRoleLevel) {
      return res.status(403).json({ success: false, message: 'You cannot modify a user with a higher or equal role level' });
    }

    // Prevent deactivating self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await user.populate('role', 'name displayName color');

    // Sync to CometChat on status toggle
    try {
      const { syncUserToCometChat } = require('../services/cometChatService');
      syncUserToCometChat(user);
    } catch (chatError) {
      console.error('CometChat Sync Error during user status toggle:', chatError);
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle user status' });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    const user = await User.findById(req.params.id).populate('role');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role-based hierarchical check
    const currentUserRoleLevel = req.user.role?.level || 0;
    const targetUserRoleLevel = user.role?.level || 0;
    const isAdmin = req.user.role?.name === 'admin';

    if (!isAdmin && targetUserRoleLevel >= currentUserRoleLevel && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You cannot reset password for a user with a higher or equal role level' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};
