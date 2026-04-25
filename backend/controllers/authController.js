const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

const getResolvedUserResponse = async (user, pool) => {
  // Fetch permissions
  const permsResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query(`
      SELECT P.Name FROM Permissions P
      JOIN RolePermissions RP ON P.Id = RP.PermissionId
      WHERE RP.RoleId = @roleId
    `);
  
  return {
    ...user,
    _id: user.Id,
    id: user.Id,
    permissions: permsResult.recordset.map(p => p.Name)
  };
};

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const pool = await getPool();

    // Check if user exists
    const existing = await pool.request().input('email', sql.NVarChar, email).query('SELECT Id FROM Users WHERE Email = @email');
    if (existing.recordset.length > 0) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Get role
    let roleId;
    if (req.body.role) {
      const roleResult = await pool.request().input('name', sql.NVarChar, req.body.role).query('SELECT Id FROM Roles WHERE Name = @name');
      if (roleResult.recordset.length > 0) roleId = roleResult.recordset[0].Id;
    }
    if (!roleId) {
      const viewerRole = await pool.request().query("SELECT Id FROM Roles WHERE Name = 'viewer'");
      roleId = viewerRole.recordset[0]?.Id;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateId();

    await pool.request()
      .input('id', sql.VarChar, userId)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('firstName', sql.NVarChar, firstName)
      .input('lastName', sql.NVarChar, lastName)
      .input('roleId', sql.VarChar, roleId)
      .query(`
        INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, CreatedAt, UpdatedAt)
        VALUES (@id, @email, @password, @firstName, @lastName, @roleId, 1, GETDATE(), GETDATE())
      `);

    const { accessToken, refreshToken } = generateTokens(userId);
    await pool.request()
      .input('id', sql.VarChar, userId)
      .input('token', sql.NVarChar, refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const user = (await pool.request().input('id', sql.VarChar, userId).query('SELECT * FROM Users WHERE Id = @id')).recordset[0];
    const resolvedUser = await getResolvedUserResponse(user, pool);

    res.status(201).json({ success: true, data: { user: resolvedUser, accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await getPool();

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const user = result.recordset[0];

    if (user.LockUntil && new Date(user.LockUntil) > new Date()) {
      return res.status(423).json({ success: false, message: 'Account is temporarily locked' });
    }

    if (!user.IsActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      const attempts = (user.LoginAttempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= 5) lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      
      await pool.request()
        .input('id', sql.VarChar, user.Id)
        .input('attempts', sql.Int, attempts)
        .input('lockUntil', sql.DateTime, lockUntil)
        .query('UPDATE Users SET LoginAttempts = @attempts, LockUntil = @lockUntil WHERE Id = @id');
      
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .query('UPDATE Users SET LoginAttempts = 0, LockUntil = NULL, LastSeen = GETDATE() WHERE Id = @id');

    const { accessToken, refreshToken } = generateTokens(user.Id);
    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .input('token', sql.NVarChar, refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const resolvedUser = await getResolvedUserResponse(user, pool);
    res.json({ success: true, data: { user: resolvedUser, accessToken, refreshToken } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Token required' });

    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    if (!user || user.RefreshToken !== refreshToken) return res.status(401).json({ success: false, message: 'Invalid token' });
    if (!user.IsActive) return res.status(403).json({ success: false, message: 'Deactivated' });

    const tokens = generateTokens(user.Id);
    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .input('token', sql.NVarChar, tokens.refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.VarChar, req.userId).query('UPDATE Users SET RefreshToken = NULL WHERE Id = @id');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.getMe = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ success: false });
    const resolvedUser = await getResolvedUserResponse(result.recordset[0], pool);
    res.json({ success: true, data: resolvedUser });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('fn', sql.NVarChar, firstName)
      .input('ln', sql.NVarChar, lastName)
      .input('ph', sql.NVarChar, phone)
      .input('pref', sql.NVarChar, JSON.stringify(preferences))
      .query(`
        UPDATE Users SET 
          FirstName = @fn, LastName = @ln, Phone = @ph, Preferences = @pref, UpdatedAt = GETDATE()
        WHERE Id = @id
      `);

    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pool = await getPool();

    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT Password FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    const isMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('pw', sql.NVarChar, hashed)
      .query('UPDATE Users SET Password = @pw, UpdatedAt = GETDATE() WHERE Id = @id');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};
