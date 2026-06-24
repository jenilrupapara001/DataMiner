const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const { sendAdminEmail } = require('../services/emailService');
const { buildInClause } = require('../utils/sqlHelpers');

/**
 * Get all users with filters, pagination, and role/seller info
 * GET /api/users
 */
exports.getUsers = async (req, res) => {
  try {
    const { 
      page = 1, limit = 25, search, role, isActive, 
      sortBy = 'CreatedAt', sortOrder = 'DESC',
      sellerId
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const offset = (pageNum - 1) * limitNum;

    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    // RBAC: Non-admin users can only see their subordinates
    const currentUserRole = req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    const isAdmin = currentUserRole === 'admin';

    if (!isAdmin) {
      const userId = (req.user?.Id || req.user?.id || req.user?._id || '').toString();
      const subordinates = await getSubordinateIds(pool, userId);
      subordinates.push(userId);
      if (subordinates.length === 0) {
        return res.json({ success: true, data: { users: [], pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 } } });
      }
      const subPlaceholders = buildInClause(request, 'subId', subordinates);
      whereClause += ` AND U.Id IN (${subPlaceholders})`;
    }

    // Filters
    if (search) {
      whereClause += ' AND (U.FirstName LIKE @search OR U.LastName LIKE @search OR U.Email LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (role && role !== 'all') {
      whereClause += ' AND (R.Name = @roleName OR R.Id = @roleId)';
      request.input('roleName', sql.VarChar, role);
      request.input('roleId', sql.VarChar, role);
    }
    if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
      whereClause += ' AND U.IsActive = @isActive';
      request.input('isActive', sql.Bit, isActive === 'true' || isActive === '1' ? 1 : 0);
    }
    if (sellerId) {
      whereClause += ' AND EXISTS (SELECT 1 FROM UserSellers US WHERE US.UserId = U.Id AND US.SellerId = @sellerId)';
      request.input('sellerId', sql.VarChar, sellerId);
    }

    // Count
    const countResult = await request.query(`
      SELECT COUNT(*) as total FROM Users U 
      LEFT JOIN Roles R ON U.RoleId = R.Id
      ${whereClause}
    `);
    const total = countResult.recordset[0].total;

    // Active/Inactive counts (without isActive filter, but with other filters)
    let countWhereClause = whereClause.replace(/AND U\.IsActive = @isActive/, '');
    if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
      // Re-add the isActive param to the base where (removed above), but we need separate queries
    }
    const countReq = pool.request();
    // Rebuild params for the status counts
    if (search) countReq.input('search', sql.NVarChar, `%${search}%`);
    if (role && role !== 'all') {
      countReq.input('roleName', sql.VarChar, role);
      countReq.input('roleId', sql.VarChar, role);
    }
    if (sellerId) countReq.input('sellerId', sql.VarChar, sellerId);
    // Re-add RBAC
    let countWhere = 'WHERE 1=1';
    if (!isAdmin) {
      const userId2 = (req.user?.Id || req.user?.id || req.user?._id || '').toString();
      const subordinates2 = await getSubordinateIds(pool, userId2);
      subordinates2.push(userId2);
      if (subordinates2.length > 0) {
        const subPlaceholders2 = buildInClause(countReq, 'subId2', subordinates2);
        countWhere += ` AND U.Id IN (${subPlaceholders2})`;
      }
    }
    if (search) countWhere += ' AND (U.FirstName LIKE @search OR U.LastName LIKE @search OR U.Email LIKE @search)';
    if (role && role !== 'all') countWhere += ' AND (R.Name = @roleName OR R.Id = @roleId)';
    if (sellerId) countWhere += ' AND EXISTS (SELECT 1 FROM UserSellers US WHERE US.UserId = U.Id AND US.SellerId = @sellerId)';

    const statusCountResult = await countReq.query(`
      SELECT 
        SUM(CASE WHEN U.IsActive = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN U.IsActive = 0 THEN 1 ELSE 0 END) as inactiveCount
      FROM Users U
      LEFT JOIN Roles R ON U.RoleId = R.Id
      ${countWhere}
    `);
    const activeCountResult = statusCountResult.recordset[0].activeCount || 0;
    const inactiveCountResult = statusCountResult.recordset[0].inactiveCount || 0;

    // Fetch users with role info
    const sortField = sortBy === 'name' ? 'U.FirstName' : 
                      sortBy === 'email' ? 'U.Email' : 
                      sortBy === 'role' ? 'R.Name' : 'U.CreatedAt';
    
    const usersResult = await request
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limitNum)
      .query(`
        SELECT 
          U.Id, U.Email, U.FirstName, U.LastName, U.Phone,
          U.IsActive, U.LoginAttempts, U.LastSeen, U.CreatedAt, U.UpdatedAt,
          U.RoleId, U.Preferences, U.ExtraPermissions, U.ExcludedPermissions,
          R.Name as RoleName, R.DisplayName as RoleDisplayName, 
          R.Color as RoleColor, R.Level as RoleLevel
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        ${whereClause}
        ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    // Fetch assigned sellers for each user
    const userIds = usersResult.recordset.map(u => u.Id);
    const userReq = pool.request();
    const userIdPlaceholders = buildInClause(userReq, 'userId', userIds);
    let sellerMap = {};
    
    if (usersResult.recordset.length > 0) {
      const sellersResult = await userReq.query(`
        SELECT US.UserId, S.Id as SellerId, S.Name as SellerName, S.Marketplace
        FROM UserSellers US
        JOIN Sellers S ON US.SellerId = S.Id
        WHERE US.UserId IN (${userIdPlaceholders})
      `);
      
      sellersResult.recordset.forEach(s => {
        if (!sellerMap[s.UserId]) sellerMap[s.UserId] = [];
        sellerMap[s.UserId].push({
          _id: s.SellerId,
          name: s.SellerName,
          marketplace: s.Marketplace
        });
      });
    }

    // Fetch supervisors for each user
    let supervisorMap = {};
    if (userIds.length > 0) {
      const supReq = pool.request();
      const supPlaceholders = buildInClause(supReq, 'supId', userIds);
      const supervisorsResult = await supReq.query(`
        SELECT US.UserId, S.Id as SupervisorId, S.FirstName, S.LastName, S.Email
        FROM UserSupervisors US
        JOIN Users S ON US.SupervisorId = S.Id
        WHERE US.UserId IN (${supPlaceholders})
      `);
      
      supervisorsResult.recordset.forEach(s => {
        if (!supervisorMap[s.UserId]) supervisorMap[s.UserId] = [];
        supervisorMap[s.UserId].push({
          id: s.SupervisorId,
          _id: s.SupervisorId,
          firstName: s.FirstName,
          lastName: s.LastName,
          email: s.Email
        });
      });
    }

    // Fetch brand managers map for each user
    let brandManagersMap = {};
    if (userIds.length > 0) {
      const bmReq = pool.request();
      const bmPlaceholders = buildInClause(bmReq, 'bmId', userIds);
      const bmResult = await bmReq.query(`
        SELECT UserId, BrandManagerId FROM UserBrandManagers WHERE UserId IN (${bmPlaceholders})
      `);
      bmResult.recordset.forEach(bm => {
        if (!brandManagersMap[bm.UserId]) brandManagersMap[bm.UserId] = [];
        brandManagersMap[bm.UserId].push(bm.BrandManagerId);
      });
    }

    // Fetch permissions for each user's role
    const roleIds = [...new Set(usersResult.recordset.map(u => u.RoleId).filter(Boolean))];
    let permissionMap = {};
    
    if (roleIds.length > 0) {
      const permReq = pool.request();
      const roleIdPlaceholders = buildInClause(permReq, 'roleId', roleIds);
      const permResult = await permReq.query(`
        SELECT RP.RoleId, P.Name as PermissionName
        FROM RolePermissions RP
        JOIN Permissions P ON RP.PermissionId = P.Id
        WHERE RP.RoleId IN (${roleIdPlaceholders})
      `);
      
      permResult.recordset.forEach(p => {
        if (!permissionMap[p.RoleId]) permissionMap[p.RoleId] = [];
        permissionMap[p.RoleId].push(p.PermissionName);
      });
    }

    // Build response
    const users = usersResult.recordset.map(u => ({
      _id: u.Id,
      id: u.Id,
      email: u.Email,
      firstName: u.FirstName || '',
      lastName: u.LastName || '',
      phone: u.Phone || '',
      isActive: u.IsActive === 1 || u.IsActive === true,
      loginAttempts: u.LoginAttempts || 0,
      lastSeen: u.LastSeen,
      createdAt: u.CreatedAt,
      updatedAt: u.UpdatedAt,
      assignedSellers: sellerMap[u.Id] || [],
      supervisors: supervisorMap[u.Id] || [],
      brandManagers: brandManagersMap[u.Id] || [],
      extraPermissions: u.ExtraPermissions ? JSON.parse(u.ExtraPermissions) : [],
      excludedPermissions: u.ExcludedPermissions ? JSON.parse(u.ExcludedPermissions) : [],
      role: {
        _id: u.RoleId,
        name: u.RoleName || 'viewer',
        displayName: u.RoleDisplayName || 'Viewer',
        color: u.RoleColor || '#6B7280',
        level: u.RoleLevel || 0,
        permissions: permissionMap[u.RoleId] || []
      },
      preferences: u.Preferences ? (typeof u.Preferences === 'string' ? JSON.parse(u.Preferences) : u.Preferences) : {}
    }));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          activeCount: activeCountResult,
          inactiveCount: inactiveCountResult
        }
      }
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single user
 * GET /api/users/:id
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const userResult = await pool.request()
      .input('id', sql.VarChar, id)
      .query(`
        SELECT U.*, R.Name as RoleName, R.DisplayName as RoleDisplayName, 
               R.Color as RoleColor, R.Level as RoleLevel
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        WHERE U.Id = @id
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const u = userResult.recordset[0];

    // Fetch assigned sellers
    const sellersResult = await pool.request()
      .input('uid', sql.VarChar, id)
      .query(`
        SELECT S.Id as _id, S.Name as name, S.Marketplace as marketplace
        FROM Sellers S 
        JOIN UserSellers US ON S.Id = US.SellerId 
        WHERE US.UserId = @uid
      `);

    // Fetch role permissions
    const permsResult = await pool.request()
      .input('roleId', sql.VarChar, u.RoleId)
      .query(`
        SELECT P.Name FROM Permissions P 
        JOIN RolePermissions RP ON P.Id = RP.PermissionId 
        WHERE RP.RoleId = @roleId
      `);

    // Fetch brand manager assignments
    const brandManagersResult = await pool.request()
      .input('uid', sql.VarChar, id)
      .query('SELECT BrandManagerId FROM UserBrandManagers WHERE UserId = @uid');
    const brandManagers = brandManagersResult.recordset.map(bm => bm.BrandManagerId);

    res.json({
      success: true,
      data: {
        _id: u.Id,
        id: u.Id,
        email: u.Email,
        firstName: u.FirstName || '',
        lastName: u.LastName || '',
        phone: u.Phone || '',
        isActive: u.IsActive === 1 || u.IsActive === true,
        loginAttempts: u.LoginAttempts || 0,
        lastSeen: u.LastSeen,
        createdAt: u.CreatedAt,
        updatedAt: u.UpdatedAt,
        extraPermissions: u.ExtraPermissions ? JSON.parse(u.ExtraPermissions) : [],
        excludedPermissions: u.ExcludedPermissions ? JSON.parse(u.ExcludedPermissions) : [],
        brandManagers,
        role: {
          _id: u.RoleId,
          name: u.RoleName || 'viewer',
          displayName: u.RoleDisplayName || 'Viewer',
          color: u.RoleColor || '#6B7280',
          level: u.RoleLevel || 0,
          permissions: permsResult.recordset.map(p => p.Name)
        },
        assignedSellers: sellersResult.recordset,
        supervisors: (await pool.request()
          .input('uid', sql.VarChar, id)
          .query('SELECT SupervisorId FROM UserSupervisors WHERE UserId = @uid')
        ).recordset.map(s => s.SupervisorId),
        preferences: u.Preferences ? JSON.parse(typeof u.Preferences === 'string' ? u.Preferences : '{}') : {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create user
 * POST /api/users
 */
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, roleId, assignedSellerIds, extraPermissions, excludedPermissions, brandManagers } = req.body;
    const pool = await getPool();

    // Check if email exists
    const existing = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Id FROM Users WHERE Email = @email');
    
    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Validate role
    if (roleId) {
      const roleResult = await pool.request()
        .input('rid', sql.VarChar, roleId)
        .query('SELECT Id FROM Roles WHERE Id = @rid');
      if (roleResult.recordset.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
    }

    const hashedPassword = await bcrypt.hash(password || 'Welcome@123', 12);
    const userId = generateId();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction.request()
        .input('id', sql.VarChar, userId)
        .input('email', sql.NVarChar, email)
        .input('password', sql.NVarChar, hashedPassword)
        .input('fn', sql.NVarChar, firstName || null)
        .input('ln', sql.NVarChar, lastName || null)
        .input('ph', sql.NVarChar, phone || null)
        .input('rid', sql.VarChar, roleId || null)
        .input('extraPerms', sql.NVarChar, JSON.stringify(extraPermissions || []))
        .input('exclPerms', sql.NVarChar, JSON.stringify(excludedPermissions || []))
        .query(`
          INSERT INTO Users (Id, Email, Password, FirstName, LastName, Phone, RoleId, IsActive, CreatedAt, UpdatedAt, ExtraPermissions, ExcludedPermissions)
          VALUES (@id, @email, @password, @fn, @ln, @ph, @rid, 1, dbo.GetEnvDate(), dbo.GetEnvDate(), @extraPerms, @exclPerms)
        `);

      // Assign sellers
      if (assignedSellerIds && Array.isArray(assignedSellerIds)) {
        for (const sellerId of assignedSellerIds) {
          await transaction.request()
            .input('uid', sql.VarChar, userId)
            .input('sid', sql.VarChar, sellerId)
            .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)');
        }
      }

      // Assign supervisors
      const { supervisors } = req.body;
      if (supervisors && Array.isArray(supervisors)) {
        for (const supervisorId of supervisors) {
          await transaction.request()
            .input('uid', sql.VarChar, userId)
            .input('supId', sql.VarChar, supervisorId)
            .query('INSERT INTO UserSupervisors (UserId, SupervisorId) VALUES (@uid, @supId)');
        }
      }

      // Assign brand managers (listing team assignments)
      if (brandManagers && Array.isArray(brandManagers)) {
        for (const bmId of brandManagers) {
          await transaction.request()
            .input('uid', sql.VarChar, userId)
            .input('bmId', sql.VarChar, bmId)
            .query('INSERT INTO UserBrandManagers (UserId, BrandManagerId) VALUES (@uid, @bmId)');
        }
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({ success: true, data: { _id: userId, email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, email, roleId, isActive, assignedSellerIds, extraPermissions, excludedPermissions, brandManagers } = req.body;
    const pool = await getPool();

    // Check user exists
    const userCheck = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT Id FROM Users WHERE Id = @id');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Update user details
      const updateRequest = transaction.request()
        .input('id', sql.VarChar, id)
        .input('fn', sql.NVarChar, firstName || null)
        .input('ln', sql.NVarChar, lastName || null)
        .input('ph', sql.NVarChar, phone || null)
        .input('email', sql.NVarChar, email || null);

      let setClauses = ['UpdatedAt = dbo.GetEnvDate()'];
      
      if (firstName !== undefined) { setClauses.push('FirstName = @fn'); }
      if (lastName !== undefined) { setClauses.push('LastName = @ln'); }
      if (phone !== undefined) { setClauses.push('Phone = @ph'); }
      if (email !== undefined) { setClauses.push('Email = @email'); }
      if (roleId !== undefined) { 
        setClauses.push('RoleId = @rid');
        updateRequest.input('rid', sql.VarChar, roleId);
      }
      if (isActive !== undefined) {
        setClauses.push('IsActive = @isActive');
        updateRequest.input('isActive', sql.Bit, isActive ? 1 : 0);
      }
      if (extraPermissions !== undefined) {
        setClauses.push('ExtraPermissions = @extraPerms');
        updateRequest.input('extraPerms', sql.NVarChar, JSON.stringify(extraPermissions || []));
      }
      if (excludedPermissions !== undefined) {
        setClauses.push('ExcludedPermissions = @exclPerms');
        updateRequest.input('exclPerms', sql.NVarChar, JSON.stringify(excludedPermissions || []));
      }

      await updateRequest.query(`UPDATE Users SET ${setClauses.join(', ')} WHERE Id = @id`);

      // Update seller assignments
      if (assignedSellerIds !== undefined) {
        await transaction.request()
          .input('uid', sql.VarChar, id)
          .query('DELETE FROM UserSellers WHERE UserId = @uid');

        if (Array.isArray(assignedSellerIds) && assignedSellerIds.length > 0) {
          for (const sellerId of assignedSellerIds) {
            await transaction.request()
              .input('uid', sql.VarChar, id)
              .input('sid', sql.VarChar, sellerId)
              .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)');
          }
        }
      }

      // Update supervisor assignments
      const { supervisors } = req.body;
      if (supervisors !== undefined) {
        await transaction.request()
          .input('uid', sql.VarChar, id)
          .query('DELETE FROM UserSupervisors WHERE UserId = @uid');

        if (Array.isArray(supervisors) && supervisors.length > 0) {
          for (const supervisorId of supervisors) {
            await transaction.request()
              .input('uid', sql.VarChar, id)
              .input('supId', sql.VarChar, supervisorId)
              .query('INSERT INTO UserSupervisors (UserId, SupervisorId) VALUES (@uid, @supId)');
          }
        }
      }

      // Update brand manager assignments (listing team assignments)
      if (brandManagers !== undefined) {
        await transaction.request()
          .input('uid', sql.VarChar, id)
          .query('DELETE FROM UserBrandManagers WHERE UserId = @uid');

        if (Array.isArray(brandManagers) && brandManagers.length > 0) {
          for (const bmId of brandManagers) {
            await transaction.request()
              .input('uid', sql.VarChar, id)
              .input('bmId', sql.VarChar, bmId)
              .query('INSERT INTO UserBrandManagers (UserId, BrandManagerId) VALUES (@uid, @bmId)');
          }
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

/**
 * Delete user
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user?.Id || req.user?.id || req.user?._id || '').toString();

    if (id === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const pool = await getPool();
    
    // Clean up related records
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM UserSellers WHERE UserId = @id');
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM UserSupervisors WHERE UserId = @id');
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Users WHERE Id = @id');

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle user status
 * PUT /api/users/:id/toggle-status
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = (req.user?.Id || req.user?.id || req.user?._id || '').toString();

    if (id === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    const pool = await getPool();
    const userResult = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT IsActive FROM Users WHERE Id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newStatus = userResult.recordset[0].IsActive ? 0 : 1;
    
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('isActive', sql.Bit, newStatus)
      .query('UPDATE Users SET IsActive = @isActive, LockUntil = NULL WHERE Id = @id');

    res.json({ 
      success: true, 
      data: { isActive: newStatus === 1 },
      message: newStatus ? 'User activated' : 'User deactivated' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reset user password
 * PUT /api/users/:id/reset-password
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const pool = await getPool();

    const hashed = await bcrypt.hash(newPassword, 12);
    
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('pw', sql.NVarChar, hashed)
      .query(`UPDATE Users SET Password = @pw, LoginAttempts = 0, LockUntil = NULL,
              ForcePasswordReset = 0, RefreshToken = NULL,
              PasswordChangedAt = dbo.GetEnvDate(),
              PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()) WHERE Id = @id`);

    // Revoke all sessions
    const tokenBlacklist = require('../services/tokenBlacklistService');
    await tokenBlacklist.blacklistUser(id);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.forcePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    
    // Clear refresh token to force logout
    await pool.request()
      .input('id', sql.VarChar, id)
      .query('UPDATE Users SET ForcePasswordReset = 1, RefreshToken = NULL WHERE Id = @id');

    // Revoke all tokens for this user
    const tokenBlacklist = require('../services/tokenBlacklistService');
    await tokenBlacklist.blacklistUser(id);

    res.json({ success: true, message: 'User must reset password on next login' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get available roles for dropdown
 * GET /api/users/roles
 */
exports.getAvailableRoles = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT R.Id, R.Name, R.DisplayName, R.Color, R.Level,
               (SELECT STRING_AGG(P.Name, ',') FROM RolePermissions RP JOIN Permissions P ON RP.PermissionId = P.Id WHERE RP.RoleId = R.Id) as PermissionNames
        FROM Roles R 
        WHERE R.IsActive = 1 
        ORDER BY R.Level DESC
      `);
    
    // Also fetch permissions grouped for each role
    const allPerms = await pool.request()
      .query('SELECT RP.RoleId, P.Id, P.Name, P.DisplayName, P.Category FROM RolePermissions RP JOIN Permissions P ON RP.PermissionId = P.Id');
    
    const permMap = {};
    allPerms.recordset.forEach(p => {
      if (!permMap[p.RoleId]) permMap[p.RoleId] = [];
      permMap[p.RoleId].push({
        _id: p.Id,
        id: p.Id,
        name: p.Name,
        displayName: p.DisplayName,
        category: p.Category
      });
    });

    const roles = result.recordset.map(r => ({
      _id: r.Id,
      id: r.Id,
      name: r.Name,
      displayName: r.DisplayName,
      color: r.Color || '#6B7280',
      level: r.Level || 0,
      permissions: permMap[r.Id] || []
    }));

    res.json({ success: true, data: { roles } });
  } catch (error) {
    console.error('getAvailableRoles Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all sellers for assignment dropdown
 * GET /api/users/sellers
 */
exports.getSellersForAssignment = async (req, res) => {
  try {
    const pool = await getPool();
    const sellersResult = await pool.request()
      .query('SELECT Id as _id, Id, Name as name, Marketplace as marketplace, SellerId as sellerId FROM Sellers WHERE IsActive = 1 ORDER BY Name');
    
    const sellers = sellersResult.recordset;
    if (sellers.length === 0) {
      return res.json({ success: true, data: { sellers: [] } });
    }

    // Enrich with managers
    const sellerReq = pool.request();
    const sellerIdPlaceholders = buildInClause(sellerReq, 'sellerId', sellers.map(s => s.Id));
    const managersResult = await sellerReq.query(`
      SELECT US.SellerId, U.Id as _id, U.FirstName as firstName, U.LastName as lastName, U.Email as email
      FROM UserSellers US
      JOIN Users U ON US.UserId = U.Id
      JOIN Roles R ON U.RoleId = R.Id
      WHERE US.SellerId IN (${sellerIdPlaceholders}) AND R.Name IN ('admin', 'manager', 'Brand Manager')
    `);

    const managerMap = {};
    managersResult.recordset.forEach(m => {
      if (!managerMap[m.SellerId]) managerMap[m.SellerId] = [];
      const { SellerId, ...managerInfo } = m;
      managerMap[m.SellerId].push(managerInfo);
    });

    const enrichedSellers = sellers.map(s => ({
      ...s,
      managers: managerMap[s.Id] || []
    }));
    
    res.json({ 
      success: true, 
      data: { 
        sellers: enrichedSellers
      } 
    });
  } catch (error) {
    console.error('getSellersForAssignment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get permissions grouped by category
 * GET /api/users/permissions
 */
exports.getGroupedPermissions = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Id, Name, DisplayName, Description, Category, Action FROM Permissions ORDER BY Category, Action');
    
    const grouped = {};
    result.recordset.forEach(p => {
      const cat = p.Category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        _id: p.Id,
        id: p.Id,
        name: p.Name,
        displayName: p.DisplayName,
        description: p.Description,
        action: p.Action
      });
    });

    const flat = result.recordset.map(p => ({
      _id: p.Id,
      id: p.Id,
      name: p.Name,
      displayName: p.DisplayName,
      description: p.Description,
      category: p.Category,
      action: p.Action
    }));

    res.json({ success: true, data: { permissions: flat, groupedPermissions: grouped } });
  } catch (error) {
    console.error('getGroupedPermissions Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper: Get subordinate user IDs (for RBAC)
async function getSubordinateIds(pool, userId) {
  try {
    const result = await pool.request()
      .input('uid', sql.VarChar, userId)
      .query('SELECT SupervisorId FROM UserSupervisors WHERE UserId = @uid');
    return result.recordset.map(r => r.SupervisorId);
  } catch {
    return [];
  }
}

/**
 * Get available managers
 * GET /api/users/managers
 */
exports.getManagers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT U.Id, U.FirstName, U.LastName, U.Email, R.Name as RoleName, R.DisplayName as RoleDisplayName
      FROM Users U
      LEFT JOIN Roles R ON U.RoleId = R.Id
      WHERE U.IsActive = 1
    `);

    // Fetch assigned sellers for each manager
    const manReq = pool.request();
    const manIdPlaceholders = buildInClause(manReq, 'manId', result.recordset.map(u => u.Id));
    let sellerMap = {};
    
    if (result.recordset.length > 0) {
      const sellersResult = await manReq.query(`
        SELECT US.UserId, S.Id as SellerId, S.Name as SellerName, S.Marketplace
        FROM UserSellers US
        JOIN Sellers S ON US.SellerId = S.Id
        WHERE US.UserId IN (${manIdPlaceholders})
      `);
      
      sellersResult.recordset.forEach(s => {
        if (!sellerMap[s.UserId]) sellerMap[s.UserId] = [];
        sellerMap[s.UserId].push({
          _id: s.SellerId,
          name: s.SellerName,
          marketplace: s.Marketplace
        });
      });
    }

    res.json({
      success: true,
      data: result.recordset.map(u => ({
        _id: u.Id,
        id: u.Id,
        firstName: u.FirstName,
        lastName: u.LastName,
        email: u.Email,
        role: { name: u.RoleName, displayName: u.RoleDisplayName },
        assignedSellers: sellerMap[u.Id] || []
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendEmailToUser = async (req, res) => {
  try {
    const { userId, subject, html, message } = req.body;
    
    if (!userId && !req.body.to) {
      return res.status(400).json({ success: false, message: 'User ID or recipient email required' });
    }

    let to;
    let userName = 'User';

    if (req.body.to) {
      to = req.body.to;
    } else {
      const pool = await getPool();
      const userResult = await pool.request()
        .input('id', sql.VarChar, userId)
        .query('SELECT Email, FirstName, LastName FROM Users WHERE Id = @id');

      if (userResult.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const user = userResult.recordset[0];
      to = user.Email;
      userName = user.FirstName || 'User';
    }

    const finalSubject = subject || 'Message from Super Admin';
    const finalHtml = html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Message from Super Admin</h2>
        <p>Hello ${userName},</p>
        <p>${message || ''}</p>
        <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-size: 12px; color: #666;">Sent via RetailOps Dashboard</p>
        </div>
      </div>
    `;

    const result = await sendAdminEmail(to, finalSubject, finalHtml, 'RetailOps Super Admin');
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      data: { messageId: result.messageId, to }
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
