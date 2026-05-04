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
        _id: role.Id,
        id: role.Id,
        name: role.Name,
        displayName: role.DisplayName,
        description: role.Description,
        level: role.Level || 0,
        color: role.Color || '#4F46E5',
        isSystem: role.IsSystem === 1 || role.IsSystem === true,
        isActive: role.IsActive === 1 || role.IsActive === true,
        createdAt: role.CreatedAt,
        updatedAt: role.UpdatedAt,
        permissions: perms.recordset.map(p => ({
          _id: p.Id,
          id: p.Id,
          name: p.Name,
          displayName: p.DisplayName,
          description: p.Description,
          category: p.Category,
          action: p.Action
        }))
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
        _id: role.Id,
        id: role.Id,
        name: role.Name,
        displayName: role.DisplayName,
        description: role.Description,
        level: role.Level || 0,
        color: role.Color || '#4F46E5',
        isSystem: role.IsSystem === 1 || role.IsSystem === true,
        isActive: role.IsActive === 1 || role.IsActive === true,
        createdAt: role.CreatedAt,
        updatedAt: role.UpdatedAt,
        permissions: perms.recordset.map(p => ({
          _id: p.Id,
          id: p.Id,
          name: p.Name,
          displayName: p.DisplayName,
          description: p.Description,
          category: p.Category,
          action: p.Action
        }))
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

    const permissions = result.recordset.map(p => ({
      _id: p.Id,
      id: p.Id,
      name: p.Name,
      displayName: p.DisplayName,
      description: p.Description,
      category: p.Category,
      action: p.Action
    }));

    const groupedPermissions = permissions.reduce((acc, perm) => {
      const cat = perm.category || 'Default';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {});

    res.json({ success: true, data: { permissions, groupedPermissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const defaultPermissions = [
  // Dashboard & Analytics
  { name: 'dashboard_view', displayName: 'View Dashboard', description: 'Access to main dashboard overview and analytics', category: 'Analytics', action: 'view' },
  { name: 'activity_logs_view', displayName: 'View Activity Logs', description: 'View system-wide activity and audit logs', category: 'Analytics', action: 'view' },

  // Reports
  { name: 'reports_sku_view', displayName: 'View SKU Reports', description: 'Access to SKU-level performance reports', category: 'Reports', action: 'view' },
  { name: 'reports_parent_view', displayName: 'View Parent ASIN Reports', description: 'Access to Parent ASIN-level reports', category: 'Reports', action: 'view' },
  { name: 'reports_monthly_view', displayName: 'View Monthly Trends', description: 'View month-over-month performance trends', category: 'Reports', action: 'view' },
  { name: 'reports_ads_view', displayName: 'View Ads Intelligence', description: 'Access to advertising performance data', category: 'Reports', action: 'view' },
  { name: 'reports_profit_view', displayName: 'View Profit & Loss', description: 'Access to financial and P&L reports', category: 'Reports', action: 'view' },
  { name: 'reports_inventory_view', displayName: 'View Inventory Reports', description: 'Access to inventory health and stock reports', category: 'Reports', action: 'view' },
  { name: 'reports_goals_view', displayName: 'View Goal Progress', description: 'Track progress against achievement goals', category: 'Reports', action: 'view' },
  { name: 'reports_export', displayName: 'Export Data', description: 'Export report data to CSV/Excel', category: 'Reports', action: 'export' },

  // Marketplace & Sellers
  { name: 'sellers_view', displayName: 'View Sellers', description: 'View registered sellers and marketplaces', category: 'Marketplace', action: 'view' },
  { name: 'sellers_manage', displayName: 'Manage Sellers', description: 'Add, edit or deactivate sellers', category: 'Marketplace', action: 'manage' },
  { name: 'asins_view', displayName: 'View ASINs', description: 'View product catalog and ASIN details', category: 'Marketplace', action: 'view' },
  { name: 'asins_manage', displayName: 'Manage ASINs', description: 'Add, edit or delete product ASINs', category: 'Marketplace', action: 'manage' },
  { name: 'asins_tracker', displayName: 'Access ASIN Tracker', description: 'Use the BSR and price tracker tools', category: 'Marketplace', action: 'view' },
  { name: 'asins_bulk', displayName: 'Bulk Operations', description: 'Perform bulk ASIN uploads and updates', category: 'Marketplace', action: 'manage' },

  // Automation & Scraping
  { name: 'scraping_view', displayName: 'View Scrape Tasks', description: 'View status of data extraction tasks', category: 'Automation', action: 'view' },
  { name: 'scraping_manage', displayName: 'Manage Automation', description: 'Control Octoparse tasks and sync schedules', category: 'Automation', action: 'manage' },
  { name: 'rules_view', displayName: 'View Smart Rules', description: 'View automated rules and alert conditions', category: 'Automation', action: 'view' },
  { name: 'rules_manage', displayName: 'Manage Rulesets', description: 'Create and edit automated business rules', category: 'Automation', action: 'manage' },
  { name: 'templates_manage', displayName: 'Manage Templates', description: 'Manage scraping and data templates', category: 'Automation', action: 'manage' },

  // Operations & Teams
  { name: 'actions_view', displayName: 'View Task Actions', description: 'View assigned operational tasks', category: 'Operations', action: 'view' },
  { name: 'actions_manage', displayName: 'Manage Operations', description: 'Assign tasks and manage workflows', category: 'Operations', action: 'manage' },
  { name: 'teams_manage', displayName: 'Manage Teams', description: 'Create and manage organizational teams', category: 'Operations', action: 'manage' },
  { name: 'files_manage', displayName: 'File Manager', description: 'Upload and manage system files and assets', category: 'Operations', action: 'manage' },

  // Security & Users
  { name: 'users_view', displayName: 'View User List', description: 'View all system users', category: 'Security', action: 'view' },
  { name: 'users_manage', displayName: 'Manage Users', description: 'Create, edit and deactivate system users', category: 'Security', action: 'manage' },
  { name: 'roles_view', displayName: 'View Roles', description: 'View roles and permission sets', category: 'Security', action: 'view' },
  { name: 'roles_manage', displayName: 'Manage Permissions', description: 'Modify role-based access control policies', category: 'Security', action: 'manage' },
  { name: 'apikeys_manage', displayName: 'Manage API Keys', description: 'Manage integration and service API keys', category: 'Security', action: 'manage' },
  { name: 'settings_manage', displayName: 'System Settings', description: 'Modify global application configurations', category: 'Security', action: 'manage' },

  // Specialized Tools
  { name: 'calculator_view', displayName: 'Revenue Calculator', description: 'Access the profit and margin calculator', category: 'Tools', action: 'view' },
  { name: 'calculator_config', displayName: 'Configure Fees', description: 'Modify fee and cost structures for calculations', category: 'Tools', action: 'manage' },
  { name: 'alerts_view', displayName: 'View Alerts', description: 'View system and performance alerts', category: 'Tools', action: 'view' },
  { name: 'alerts_manage', displayName: 'Resolve Alerts', description: 'Acknowledge and resolve active alerts', category: 'Tools', action: 'manage' },
];

const defaultRoles = [
  {
    name: 'admin',
    displayName: 'Super Admin',
    description: 'Master access to all system modules and security settings.',
    isSystem: true,
    level: 100,
    color: '#EF4444', // Red-500
  },
  {
    name: 'operational_manager',
    displayName: 'Operational Manager',
    description: 'Full operational control over marketplace, tasks, and teams.',
    isSystem: true,
    level: 90,
    color: '#8B5CF6', // Violet-500
  },
  {
    name: 'marketplace_lead',
    displayName: 'Marketplace Lead',
    description: 'Dedicated focus on seller management, ASINs, and scraping automation.',
    isSystem: true,
    level: 80,
    color: '#F59E0B', // Amber-500
  },
  {
    name: 'data_analyst',
    displayName: 'Data Analyst',
    description: 'Expert access to all reports, analytics, and business intelligence.',
    isSystem: true,
    level: 70,
    color: '#06B6D4', // Cyan-500
  },
  {
    name: 'team_leader',
    displayName: 'Team Leader',
    description: 'Manages team operations, tasks, and basic reporting.',
    isSystem: true,
    level: 60,
    color: '#10B981', // Emerald-500
  },
  {
    name: 'inventory_specialist',
    displayName: 'Inventory Specialist',
    description: 'Focus on inventory management and stock health monitoring.',
    isSystem: true,
    level: 40,
    color: '#3B82F6', // Blue-500
  },
  {
    name: 'catalogue_manager',
    displayName: 'Catalogue Manager',
    description: 'Dedicated to product catalog maintenance and data exports.',
    isSystem: true,
    level: 30,
    color: '#F472B6', // Pink-400
  },
  {
    name: 'employee',
    displayName: 'Associate',
    description: 'Standard access for executing assigned tasks and viewing data.',
    isSystem: true,
    level: 20,
    color: '#6366F1', // Indigo-500
  },
  {
    name: 'viewer',
    displayName: 'Guest Viewer',
    description: 'Restricted read-only access to dashboards and basic reports.',
    isSystem: true,
    level: 10,
    color: '#94A3B8', // Slate-400
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
      const checkResult = await transaction.request()
        .input('name', sql.NVarChar, perm.name)
        .query('SELECT Id FROM Permissions WHERE Name = @name');

      const permId = generateId();
      if (checkResult.recordset.length === 0) {
        await transaction.request()
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
    const allPermissionsResult = await transaction.request().query('SELECT * FROM Permissions');
    const allPermissions = allPermissionsResult.recordset;

    const getPermIds = (filterFn) => allPermissions.filter(filterFn).map(p => p.Id);

    const permissionSets = {
      admin: allPermissions.map(p => p.Id),
      operational_manager: getPermIds(p => p.Category !== 'Security' || p.Name === 'users_view'),
      marketplace_lead: getPermIds(p => ['Marketplace', 'Automation', 'Analytics'].includes(p.Category)),
      data_analyst: getPermIds(p => ['Analytics', 'Reports', 'Tools'].includes(p.Category)),
      team_leader: getPermIds(p => ['Operations', 'Analytics', 'Tools'].includes(p.Category) || p.Name === 'asins_view'),
      inventory_specialist: getPermIds(p => (p.Name && p.Name.includes('inventory')) || p.Name === 'dashboard_view' || p.Category === 'Reports'),
      catalogue_manager: getPermIds(p => p.Category === 'Marketplace' || p.Name === 'reports_export' || p.Name === 'dashboard_view'),
      employee: getPermIds(p => ['view', 'export'].includes(p.Action) && !['Security', 'Automation'].includes(p.Category)),
      viewer: getPermIds(p => p.Action === 'view' && !['Security', 'Automation'].includes(p.Category)),
    };

    for (const roleData of defaultRoles) {
      const existingResult = await transaction.request()
        .input('name', sql.NVarChar, roleData.name)
        .query('SELECT Id, IsSystem FROM Roles WHERE Name = @name');

      const roleId = existingResult.recordset.length > 0 ? existingResult.recordset[0].Id : generateId();
      const rolePerms = permissionSets[roleData.name] || [];

      if (existingResult.recordset.length === 0) {
        await transaction.request()
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
        await transaction.request()
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
      await transaction.request().input('roleId', sql.VarChar, roleId).query('DELETE FROM RolePermissions WHERE RoleId = @roleId');
      for (const permId of rolePerms) {
        await transaction.request()
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
