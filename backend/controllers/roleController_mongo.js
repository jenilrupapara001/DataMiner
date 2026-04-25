const Role = require('../models/Role');
const Permission = require('../models/Permission');

exports.getRoles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [roles, total] = await Promise.all([
      Role.find(query)
        .populate('permissions', 'name displayName category action')
        .sort({ level: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Role.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        roles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Failed to get roles' });
  }
};

exports.getRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('permissions');

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get role' });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions, level, color } = req.body;

    // Check if role name exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({ success: false, message: 'Role name already exists' });
    }

    // Validate permissions
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({ _id: { $in: permissions } });
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ success: false, message: 'One or more permissions are invalid' });
      }
    }

    const role = await Role.create({
      name,
      displayName,
      description,
      permissions: permissions || [],
      level: level || 0,
      color: color || '#4F46E5',
      isSystem: false,
    });

    await role.populate('permissions');

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ success: false, message: 'Failed to create role' });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { displayName, description, permissions, level, color, isActive } = req.body;

    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Prevent modifying core technical name of system roles implicitly 
    // (the updateData mapping below already excludes 'name' and 'isSystem')

    // Validate permissions
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({ _id: { $in: permissions } });
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ success: false, message: 'One or more permissions are invalid' });
      }
    }

    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (level !== undefined) updateData.level = level;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('permissions');

    res.json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      return res.status(403).json({ success: false, message: 'Cannot delete system roles' });
    }

    await Role.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete role' });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ category: 1, action: 1 });

    // Group by category
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.json({ success: true, data: { permissions, groupedPermissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get permissions' });
  }
};

exports.seedRolesAndPermissions = async (req, res) => {
  try {
    await Role.seedDefaultRoles(Permission);
    res.json({ success: true, message: 'Roles and permissions seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed roles and permissions' });
  }
};
