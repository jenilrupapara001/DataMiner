const { sql, getPool, generateId } = require('../database/db');

exports.getRoles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const pool = await getPool();

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClauses = [];
    const request = pool.request();

    if (search) {
      whereClauses.push('(Name LIKE @search OR DisplayName LIKE @search)');
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (isActive !== undefined) {
      whereClauses.push('IsActive = @isActive');
      request.input('isActive', sql.Bit, isActive === 'true' ? 1 : 0);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const rolesResult = await request
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT * FROM Roles
        ${whereSql}
        ORDER BY Level DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const totalResult = await pool.request().query(`SELECT COUNT(*) as Total FROM Roles ${whereSql}`);
    const total = totalResult.recordset[0].Total;

    const roles = await Promise.all(rolesResult.recordset.map(async (role) => {
      const perms = await pool.request()
        .input('roleId', sql.VarChar, role.Id)
        .query('SELECT P.* FROM Permissions P JOIN RolePermissions RP ON P.Id = RP.PermissionId WHERE RP.RoleId = @roleId');
      
      return {
        ...role,
        _id: role.Id,
        permissions: perms.recordset.map(p => ({ ...p, _id: p.Id }))
      };
    }));

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM Roles WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Role not found' });
    
    const role = result.recordset[0];
    const perms = await pool.request()
      .input('roleId', sql.VarChar, id)
      .query('SELECT P.* FROM Permissions P JOIN RolePermissions RP ON P.Id = RP.PermissionId WHERE RP.RoleId = @roleId');

    res.json({
      success: true,
      data: {
        ...role,
        _id: role.Id,
        permissions: perms.recordset.map(p => ({ ...p, _id: p.Id }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions, level, color } = req.body;
    const pool = await getPool();

    const existing = await pool.request().input('name', sql.NVarChar, name).query('SELECT Id FROM Roles WHERE Name = @name');
    if (existing.recordset.length > 0) return res.status(400).json({ success: false, message: 'Role exists' });

    const roleId = generateId();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('id', sql.VarChar, roleId)
        .input('name', sql.NVarChar, name)
        .input('dn', sql.NVarChar, displayName)
        .input('desc', sql.NVarChar, description)
        .input('lvl', sql.Int, level || 0)
        .input('clr', sql.NVarChar, color || '#4F46E5')
        .query(`
          INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
          VALUES (@id, @name, @dn, @desc, @lvl, @clr, 0, 1, GETDATE(), GETDATE())
        `);

      if (permissions && Array.isArray(permissions)) {
        for (const pId of permissions) {
          await transaction.request().input('rid', sql.VarChar, roleId).input('pid', sql.VarChar, pId).query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@rid, @pid)');
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({ success: true, data: { Id: roleId, _id: roleId, Name: name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, description, permissions, level, color, isActive } = req.body;
    const pool = await getPool();

    const roleResult = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM Roles WHERE Id = @id');
    if (roleResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Role not found' });
    
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('id', sql.VarChar, id)
        .input('dn', sql.NVarChar, displayName)
        .input('desc', sql.NVarChar, description)
        .input('lvl', sql.Int, level)
        .input('clr', sql.NVarChar, color)
        .input('active', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : 1)
        .query(`
          UPDATE Roles SET 
            DisplayName = COALESCE(@dn, DisplayName),
            Description = COALESCE(@desc, Description),
            Level = COALESCE(@lvl, Level),
            Color = COALESCE(@clr, Color),
            IsActive = @active,
            UpdatedAt = GETDATE()
          WHERE Id = @id
        `);

      if (permissions && Array.isArray(permissions)) {
        await transaction.request().input('rid', sql.VarChar, id).query('DELETE FROM RolePermissions WHERE RoleId = @rid');
        for (const pId of permissions) {
          await transaction.request().input('rid', sql.VarChar, id).input('pid', sql.VarChar, pId).query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@rid, @pid)');
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, id).query('SELECT IsSystem FROM Roles WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false });
    if (result.recordset[0].IsSystem) return res.status(403).json({ success: false, message: 'Cannot delete system roles' });

    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM RolePermissions WHERE RoleId = @id');
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Roles WHERE Id = @id');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Permissions ORDER BY Category, Action');

    const permissions = result.recordset.map(p => ({ ...p, _id: p.Id }));
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.Category]) acc[perm.Category] = [];
      acc[perm.Category].push(perm);
      return acc;
    }, {});

    res.json({ success: true, data: { permissions, groupedPermissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const defaultPermissions = [
  // Dashboard
  { name: 'dashboard_view', displayName: 'View Dashboard', description: 'View dashboard overview', category: 'dashboard', action: 'view' },

  // Reports
  { name: 'reports_sku_view', displayName: 'View SKU Report', description: 'View SKU performance report', category: 'reports', action: 'view' },
  { name: 'reports_parent_view', displayName: 'View Parent ASIN Report', description: 'View parent ASIN performance report', category: 'reports', action: 'view' },
  { name: 'reports_monthly_view', displayName: 'View Monthly Report', description: 'View monthly performance report', category: 'reports', action: 'view' },
  { name: 'reports_ads_view', displayName: 'View Ads Report', description: 'View advertising performance report', category: 'reports', action: 'view' },
  { name: 'reports_profit_view', displayName: 'View Profit & Loss', description: 'View profit and loss report', category: 'reports', action: 'view' },
  { name: 'reports_inventory_view', displayName: 'View Inventory', description: 'View inventory report', category: 'reports', action: 'view' },
  { name: 'reports_export', displayName: 'Export Reports', description: 'Export report data', category: 'reports', action: 'export' },

  // Sellers
  { name: 'sellers_view', displayName: 'View Sellers', description: 'View seller list', category: 'sellers', action: 'view' },
  { name: 'sellers_create', displayName: 'Add Sellers', description: 'Add new sellers', category: 'sellers', action: 'create' },
  { name: 'sellers_edit', displayName: 'Edit Sellers', description: 'Edit seller information', category: 'sellers', action: 'edit' },
  { name: 'sellers_delete', displayName: 'Delete Sellers', description: 'Delete sellers', category: 'sellers', action: 'delete' },
  { name: 'sellers_manage_asins', displayName: 'Manage ASINs', description: 'Manage seller ASINs', category: 'sellers', action: 'manage' },

  // Users
  { name: 'users_view', displayName: 'View Users', description: 'View user list', category: 'users', action: 'view' },
  { name: 'users_create', displayName: 'Add Users', description: 'Add new users', category: 'users', action: 'create' },
  { name: 'users_edit', displayName: 'Edit Users', description: 'Edit user information', category: 'users', action: 'edit' },
  { name: 'users_delete', displayName: 'Delete Users', description: 'Delete users', category: 'users', action: 'delete' },
  { name: 'users_assign_roles', displayName: 'Assign Roles', description: 'Assign roles to users', category: 'users', action: 'manage' },

  // Roles & Permissions
  { name: 'roles_view', displayName: 'View Roles', description: 'View roles list', category: 'users', action: 'view' },
  { name: 'roles_create', displayName: 'Create Roles', description: 'Create new roles', category: 'users', action: 'create' },
  { name: 'roles_edit', displayName: 'Edit Roles', description: 'Edit role permissions', category: 'users', action: 'edit' },
  { name: 'roles_delete', displayName: 'Delete Roles', description: 'Delete roles', category: 'users', action: 'delete' },

  // Settings
  { name: 'settings_view', displayName: 'View Settings', description: 'View system settings', category: 'settings', action: 'view' },
  { name: 'settings_edit', displayName: 'Edit Settings', description: 'Edit system settings', category: 'settings', action: 'edit' },

  // Scraping
  { name: 'scraping_view', displayName: 'View Scraping', description: 'View scraping tasks', category: 'scraping', action: 'view' },
  { name: 'scraping_create', displayName: 'Create Tasks', description: 'Create scraping tasks', category: 'scraping', action: 'create' },
  { name: 'scraping_manage', displayName: 'Manage Scraping', description: 'Manage all scraping operations', category: 'scraping', action: 'manage' },

  // Actions (Task Management)
  { name: 'actions_view', displayName: 'View Actions', description: 'View actions and tasks', category: 'actions', action: 'view' },
  { name: 'actions_create', displayName: 'Create Actions', description: 'Create new actions', category: 'actions', action: 'create' },
  { name: 'actions_edit', displayName: 'Edit Actions', description: 'Edit existing actions', category: 'actions', action: 'edit' },
  { name: 'actions_delete', displayName: 'Delete Actions', description: 'Delete actions', category: 'actions', action: 'delete' },
  { name: 'actions_manage', displayName: 'Manage Actions', description: 'Assign and manage actions', category: 'actions', action: 'manage' },

  // Revenue Calculator
  { name: 'calculator_view', displayName: 'View Calculator', description: 'Use revenue calculator', category: 'calculator', action: 'view' },
  { name: 'calculator_bulk', displayName: 'Bulk Calculation', description: 'Use bulk calculation features', category: 'calculator', action: 'create' },
  { name: 'calculator_config', displayName: 'Configure Fees', description: 'Configure fee structures', category: 'calculator', action: 'manage' },

  // Inventory
  { name: 'inventory_view', displayName: 'View Inventory', description: 'View inventory levels', category: 'inventory', action: 'view' },
  { name: 'inventory_manage', displayName: 'Manage Inventory', description: 'Update inventory details', category: 'inventory', action: 'manage' },
];

const defaultRoles = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all permissions',
    isSystem: true,
    level: 100,
    color: '#DC2626',
  },
  {
    name: 'operational_manager',
    displayName: 'Operational Manager',
    description: 'High-level operational access across all managers and sellers',
    isSystem: true,
    level: 90,
    color: '#7C3AED',
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Can manage sellers and view all reports',
    isSystem: true,
    level: 80,
    color: '#D97706',
  },
  {
    name: 'analyst',
    displayName: 'Analyst',
    description: 'Can view reports and dashboards',
    isSystem: true,
    level: 50,
    color: '#0891B2',
  },
  {
    name: 'team_leader',
    displayName: 'Team Leader',
    description: 'Manages a specific team and their tasks',
    isSystem: true,
    level: 40,
    color: '#8B5CF6',
  },
  {
    name: 'employee',
    displayName: 'Employee',
    description: 'Core team member executing tasks',
    isSystem: true,
    level: 20,
    color: '#10B981',
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    isSystem: true,
    level: 10,
    color: '#6B7280',
  },
];

exports.seedRolesAndPermissions = async (req, res) => {
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const request = transaction.request();

    // Seed permissions (upsert)
    for (const perm of defaultPermissions) {
      const checkResult = await request
        .input('name', sql.NVarChar, perm.name)
        .query('SELECT Id FROM Permissions WHERE Name = @name');

      const permId = generateId();
      if (checkResult.recordset.length === 0) {
        await request
          .input('id', sql.VarChar, permId)
          .input('name', sql.NVarChar, perm.name)
          .input('displayName', sql.NVarChar, perm.displayName)
          .input('description', sql.NVarChar, perm.description || null)
          .input('category', sql.NVarChar, perm.category)
          .input('action', sql.NVarChar, perm.action)
          .query(`
            INSERT INTO Permissions (Id, Name, DisplayName, Description, Category, Action, CreatedAt)
            VALUES (@id, @name, @displayName, @description, @category, @action, GETDATE())
          `);
      }
    }

    // Fetch all permissions after seeding
    const allPermissionsResult = await pool.request().query('SELECT * FROM Permissions');
    const allPermissions = allPermissionsResult.recordset;

    // Permission mapping helpers
    const getPermIds = (filterFn) => allPermissions.filter(filterFn).map(p => p.Id);

    const permissionSets = {
      admin: allPermissions.map(p => p.Id),
      operational_manager: getPermIds(p => p.Action !== 'delete'),
      manager: getPermIds(p => ['dashboard', 'reports', 'sellers', 'scraping', 'actions', 'calculator', 'inventory', 'users'].includes(p.Category)),
      analyst: getPermIds(p => ['dashboard', 'reports', 'actions', 'calculator', 'inventory'].includes(p.Category)),
      team_leader: getPermIds(p => ['dashboard', 'reports', 'actions', 'calculator', 'inventory', 'users'].includes(p.Category) && p.Action !== 'manage'),
      employee: getPermIds(p => ['dashboard', 'actions', 'calculator', 'inventory'].includes(p.Category) && ['view', 'edit', 'execute'].includes(p.Action)),
      viewer: getPermIds(p => p.Action === 'view' && p.Category !== 'settings'),
    };

    // Seed roles (upsert)
    for (const roleData of defaultRoles) {
      const existingResult = await request
        .input('name', sql.NVarChar, roleData.name)
        .query('SELECT Id, IsSystem FROM Roles WHERE Name = @name');

      const roleId = existingResult.recordset.length > 0 ? existingResult.recordset[0].Id : generateId();
      const rolePerms = permissionSets[roleData.name] || [];

      if (existingResult.recordset.length === 0) {
        await request
          .input('id', sql.VarChar, roleId)
          .input('name', sql.NVarChar, roleData.name)
          .input('displayName', sql.NVarChar, roleData.displayName)
          .input('description', sql.NVarChar, roleData.description || null)
          .input('level', sql.Int, roleData.level)
          .input('color', sql.NVarChar, roleData.color)
          .input('isSystem', sql.Bit, 1)
          .input('isActive', sql.Bit, 1)
          .query(`
            INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
            VALUES (@id, @name, @displayName, @description, @level, @color, @isSystem, @isActive, GETDATE(), GETDATE())
          `);
      } else if (existingResult.recordset[0].IsSystem) {
        await request
          .input('id', sql.VarChar, roleId)
          .input('displayName', sql.NVarChar, roleData.displayName)
          .input('description', sql.NVarChar, roleData.description || null)
          .input('level', sql.Int, roleData.level)
          .input('color', sql.NVarChar, roleData.color)
          .query(`
            UPDATE Roles SET
              DisplayName = @displayName,
              Description = @description,
              Level = @level,
              Color = @color,
              UpdatedAt = GETDATE()
            WHERE Id = @id
          `);
      }

      // Update role permissions: clear existing and insert new
      await request.input('roleId', sql.VarChar, roleId).query('DELETE FROM RolePermissions WHERE RoleId = @roleId');
      for (const permId of rolePerms) {
        await request
          .input('roleId', sql.VarChar, roleId)
          .input('permId', sql.VarChar, permId)
          .query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permId)');
      }
    }

    await transaction.commit();
    res.json({ success: true, message: 'Roles and permissions seeded successfully' });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed roles and permissions' });
  }
};
