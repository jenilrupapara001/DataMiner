const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const hierarchyService = require('../services/hierarchyService');

/**
 * Get Users (SQL Version)
 */
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, isActive, sortBy = 'CreatedAt', sortOrder = 'desc' } = req.query;
    const pool = await getPool();

    const roleName = req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    
    let subordinateIds = [];
    if (!isGlobalUser) {
      subordinateIds = await hierarchyService.getSubordinateIds(req.user.Id || req.user._id);
      subordinateIds.push(req.user.Id || req.user._id); // Include self
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClauses = [];
    const request = pool.request();

    if (search) {
      whereClauses.push('(FirstName LIKE @search OR LastName LIKE @search OR Email LIKE @search)');
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    if (role) {
      whereClauses.push('RoleId = @roleId');
      request.input('roleId', sql.VarChar, role);
    }
    if (isActive !== undefined) {
      whereClauses.push('IsActive = @isActive');
      request.input('isActive', sql.Bit, isActive === 'true' ? 1 : 0);
    }
    if (!isGlobalUser) {
      whereClauses.push('Id IN (' + subordinateIds.map(id => `'${id}'`).join(',') + ')');
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const orderSql = `ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    const usersResult = await request
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT U.*, R.Name as RoleName, R.DisplayName as RoleDisplayName, R.Color as RoleColor, R.Level as RoleLevel
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        ${whereSql}
        ${orderSql}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const totalResult = await pool.request().query(`SELECT COUNT(*) as Total FROM Users ${whereSql}`);
    const total = totalResult.recordset[0].Total;

    // Fetch associated data for each user (assigned sellers, supervisors)
    // For performance, we could do this in separate queries or joins, but since limit is small (20), we can do it here.
    const users = await Promise.all(usersResult.recordset.map(async (u) => {
      const sellers = await pool.request().input('uid', sql.VarChar, u.Id).query('SELECT S.Id, S.Name, S.Marketplace FROM Sellers S JOIN UserSellers US ON S.Id = US.SellerId WHERE US.UserId = @uid');
      const supervisors = await pool.request().input('uid', sql.VarChar, u.Id).query('SELECT U.FirstName, U.LastName, U.Email FROM Users U JOIN UserSupervisors USV ON U.Id = USV.SupervisorId WHERE USV.UserId = @uid');
      
      return {
        ...u,
        _id: u.Id,
        role: { _id: u.RoleId, name: u.RoleName, displayName: u.RoleDisplayName, color: u.RoleColor, level: u.RoleLevel },
        assignedSellers: sellers.recordset.map(s => ({ ...s, _id: s.Id })),
        supervisors: supervisors.recordset
      };
    }));

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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Managers (SQL Version)
 */
exports.getManagers = async (req, res) => {
  try {
    const pool = await getPool();
    const managers = await pool.request().query(`
      SELECT U.Id, U.FirstName, U.LastName, U.Email, R.Name as RoleName, R.DisplayName as RoleDisplayName
      FROM Users U
      JOIN Roles R ON U.RoleId = R.Id
      WHERE R.Name IN ('admin', 'manager', 'Brand Manager') AND U.IsActive = 1
    `);

    res.json({
      success: true,
      data: managers.recordset.map(m => ({
        ...m,
        _id: m.Id,
        role: { name: m.RoleName, displayName: m.RoleDisplayName }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get User (SQL Version)
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const userResult = await pool.request().input('id', sql.VarChar, id).query(`
      SELECT U.*, R.Name as RoleName, R.DisplayName as RoleDisplayName, R.Level as RoleLevel
      FROM Users U
      LEFT JOIN Roles R ON U.RoleId = R.Id
      WHERE U.Id = @id
    `);

    if (userResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const u = userResult.recordset[0];

    const sellers = await pool.request().input('uid', sql.VarChar, u.Id).query('SELECT S.Id, S.Name, S.Marketplace FROM Sellers S JOIN UserSellers US ON S.Id = US.SellerId WHERE US.UserId = @uid');
    const supervisors = await pool.request().input('uid', sql.VarChar, u.Id).query('SELECT U.Id, U.FirstName, U.LastName, U.Email FROM Users U JOIN UserSupervisors USV ON U.Id = USV.SupervisorId WHERE USV.UserId = @uid');
    
    // Fetch role permissions
    const perms = await pool.request().input('roleId', sql.VarChar, u.RoleId).query('SELECT P.Name FROM Permissions P JOIN RolePermissions RP ON P.Id = RP.PermissionId WHERE RP.RoleId = @roleId');

    const user = {
      ...u,
      _id: u.Id,
      role: { _id: u.RoleId, name: u.RoleName, displayName: u.RoleDisplayName, level: u.RoleLevel, permissions: perms.recordset },
      assignedSellers: sellers.recordset.map(s => ({ ...s, _id: s.Id })),
      supervisors: supervisors.recordset.map(s => ({ ...s, _id: s.Id }))
    };

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create User (SQL Version)
 */
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role: roleId, assignedSellers, supervisors } = req.body;
    const pool = await getPool();

    const existing = await pool.request().input('email', sql.NVarChar, email).query('SELECT Id FROM Users WHERE Email = @email');
    if (existing.recordset.length > 0) return res.status(400).json({ success: false, message: 'Email registered' });

    const roleResult = await pool.request().input('rid', sql.VarChar, roleId).query('SELECT * FROM Roles WHERE Id = @rid');
    if (roleResult.recordset.length === 0) return res.status(400).json({ success: false, message: 'Invalid role' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateId();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('id', sql.VarChar, userId)
        .input('email', sql.NVarChar, email)
        .input('password', sql.NVarChar, hashedPassword)
        .input('fn', sql.NVarChar, firstName)
        .input('ln', sql.NVarChar, lastName)
        .input('ph', sql.NVarChar, phone)
        .input('rid', sql.VarChar, roleId)
        .query(`
          INSERT INTO Users (Id, Email, Password, FirstName, LastName, Phone, RoleId, IsActive, CreatedAt, UpdatedAt)
          VALUES (@id, @email, @password, @fn, @ln, @ph, @rid, 1, GETDATE(), GETDATE())
        `);

      if (assignedSellers && Array.isArray(assignedSellers)) {
        for (const sId of assignedSellers) {
          await transaction.request().input('uid', sql.VarChar, userId).input('sid', sql.VarChar, sId).query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)');
        }
      }

      if (supervisors && Array.isArray(supervisors)) {
        for (const supId of supervisors) {
          await transaction.request().input('uid', sql.VarChar, userId).input('supid', sql.VarChar, supId).query('INSERT INTO UserSupervisors (UserId, SupervisorId) VALUES (@uid, @supid)');
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({ success: true, data: { Id: userId, _id: userId, Email: email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update User (SQL Version)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role: roleId, isActive, assignedSellers, supervisors } = req.body;
    const pool = await getPool();

    const userResult = await pool.request().input('id', sql.VarChar, id).query('SELECT U.*, R.Level as RoleLevel FROM Users U LEFT JOIN Roles R ON U.RoleId = R.Id WHERE U.Id = @id');
    if (userResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const userToUpdate = userResult.recordset[0];

    const currentUserRoleLevel = req.user.role?.level || req.user.role?.Level || 0;
    const roleName = req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    const isAdmin = roleName === 'admin';

    if (!isAdmin && userToUpdate.RoleLevel >= currentUserRoleLevel && (req.user.Id || req.user._id) !== id) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('id', sql.VarChar, id)
        .input('fn', sql.NVarChar, firstName)
        .input('ln', sql.NVarChar, lastName)
        .input('ph', sql.NVarChar, phone)
        .input('rid', sql.VarChar, roleId || userToUpdate.RoleId)
        .input('active', sql.Bit, isActive !== undefined ? (isActive ? 1 : 0) : userToUpdate.IsActive)
        .query(`
          UPDATE Users SET 
            FirstName = @fn, LastName = @ln, Phone = @ph, RoleId = @rid, IsActive = @active, UpdatedAt = GETDATE()
          WHERE Id = @id
        `);

      if (assignedSellers) {
        await transaction.request().input('uid', sql.VarChar, id).query('DELETE FROM UserSellers WHERE UserId = @uid');
        for (const sId of assignedSellers) {
          await transaction.request().input('uid', sql.VarChar, id).input('sid', sql.VarChar, sId).query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)');
        }
      }

      if (supervisors) {
        await transaction.request().input('uid', sql.VarChar, id).query('DELETE FROM UserSupervisors WHERE UserId = @uid');
        for (const supId of supervisors) {
          await transaction.request().input('uid', sql.VarChar, id).input('supid', sql.VarChar, supId).query('INSERT INTO UserSupervisors (UserId, SupervisorId) VALUES (@uid, @supid)');
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
 * Delete User (SQL Version)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const roleName = req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    if (roleName !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });

    if ((req.user.Id || req.user._id) === id) return res.status(400).json({ success: false, message: 'Cannot delete self' });

    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Users WHERE Id = @id');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle Status (SQL Version)
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const userResult = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM Users WHERE Id = @id');
    if (userResult.recordset.length === 0) return res.status(404).json({ success: false });
    
    const user = userResult.recordset[0];
    await pool.request().input('id', sql.VarChar, id).input('active', sql.Bit, user.IsActive ? 0 : 1).query('UPDATE Users SET IsActive = @active WHERE Id = @id');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * Reset Password (SQL Version)
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const pool = await getPool();

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.request().input('id', sql.VarChar, id).input('pw', sql.NVarChar, hashed).query('UPDATE Users SET Password = @pw WHERE Id = @id');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};
