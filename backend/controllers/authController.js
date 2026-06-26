const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const SystemLogService = require('../services/SystemLogService');
const otpService = require('../services/otpService');
const trustedDeviceService = require('../services/trustedDeviceService');
const tokenBlacklist = require('../services/tokenBlacklistService');
const { recordFailedAttempt, recordSuccessfulLogin, GENERIC_BLOCK } = require('../middleware/loginRateLimiter');

const generateTokens = (userId, fingerprint) => {
  const accessToken = jwt.sign({ userId, type: 'access', fp: fingerprint || null }, config.jwtSecret, { expiresIn: config.jwtExpiresIn || '15m' });
  const refreshToken = jwt.sign({ userId, type: 'refresh', fp: fingerprint || null }, config.jwtSecret, { expiresIn: config.refreshTokenExpiresIn || '7d' });
  return { accessToken, refreshToken };
};

const getResolvedUserResponse = async (user, pool) => {
  // Fetch role details
  const roleResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query('SELECT Name, DisplayName FROM Roles WHERE Id = @roleId');
  
  const roleInfo = roleResult.recordset[0] || { Name: 'viewer', DisplayName: 'Viewer' };

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
    role: {
      Name: roleInfo.Name,
      DisplayName: roleInfo.DisplayName
    },
    permissions: permsResult.recordset.map(p => p.Name)
  };
};

exports.register = async (req, res) => {
  return res.status(403).json({ success: false, message: 'Registration is currently disabled.' });
};

exports.register_disabled = async (req, res) => {
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
        VALUES (@id, @email, @password, @firstName, @lastName, @roleId, 1, dbo.GetEnvDate(), dbo.GetEnvDate())
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
    const clientIp = req._authMetadata?.clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      console.warn(`[AUTH_FAILURE] Account not found. Email: ${email} | IP: ${clientIp}`);
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityTitle: email,
        description: `Failed login attempt: User not found (${email})`,
        metadata: { ip: clientIp, email }
      });
      // Record failed attempt even for non-existent emails (prevents user enumeration timing attacks)
      await recordFailedAttempt(email, clientIp);
      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }
    const user = result.recordset[0];

    if (user.LockUntil && new Date(user.LockUntil) > new Date()) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Locked login attempt: ${email}`,
        metadata: { ip: clientIp }
      });
      return res.status(423).json({ success: false, message: GENERIC_BLOCK });
    }

    if (!user.IsActive) {
      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Deactivated account login attempt: ${email}`,
        metadata: { ip: clientIp }
      });
      return res.status(403).json({ success: false, message: GENERIC_BLOCK });
    }

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      const attempts = (user.LoginAttempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= 5) lockUntil = new Date(Date.now() + 15 * 60 * 1000);

      await pool.request()
        .input('id', sql.VarChar, user.Id)
        .input('attempts', sql.Int, attempts)
        .input('lockUntil', sql.DateTime, lockUntil)
        .query('UPDATE Users SET LoginAttempts = @attempts, LockUntil = @lockUntil WHERE Id = @id');

      console.warn(`[AUTH_FAILURE] Password mismatch. Email: ${email} | IP: ${clientIp} | Attempt: ${attempts}`);

      await SystemLogService.log({
        type: 'AUTH_FAILURE', entityType: 'USER', entityId: user.Id,
        entityTitle: email, user: user.Id,
        description: `Password mismatch. Attempt: ${attempts}`,
        metadata: { ip: clientIp, attempts }
      });

      // Track failure in Redis for progressive delay and lockout
      const failCount = await recordFailedAttempt(email, clientIp);
      console.warn(`[LOGIN] Progressive failure count for ${email}: ${failCount}/${5}`);

      return res.status(401).json({ success: false, message: GENERIC_BLOCK });
    }

    // Success — clear all failure counters
    await recordSuccessfulLogin(email);

    // Reset login attempts in DB
    if (user.LoginAttempts > 0 || user.LockUntil) {
      await pool.request()
        .input('id', sql.VarChar, user.Id)
        .query('UPDATE Users SET LoginAttempts = 0, LockUntil = NULL WHERE Id = @id');
    }

    await pool.request()
      .input('id', sql.VarChar, user.Id)
      .query('UPDATE Users SET LoginAttempts = 0, LockUntil = NULL, LastSeen = dbo.GetEnvDate() WHERE Id = @id');

    // Track force password reset (don't block login — wizard handles it)
    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());

    // Check trusted device — skip OTP if trusted
    const fingerprint = Buffer.from(`${req.headers['user-agent'] || ''}|${clientIp}`).toString('base64').slice(0, 32);
    const isTrustedDevice = await trustedDeviceService.isTrusted(user.Id, fingerprint);

    if (isTrustedDevice) {
      // Direct login from trusted device
      const { accessToken, refreshToken } = generateTokens(user.Id, fingerprint);
      await pool.request().input('id', sql.VarChar, user.Id).input('token', sql.NVarChar, refreshToken)
        .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');
      const resolvedUser = await getResolvedUserResponse(user, pool);
      await SystemLogService.log({ type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id, entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id, description: `${resolvedUser.FirstName} logged in (trusted device)`, metadata: { ip: clientIp } });
      return res.json({ success: true, data: { user: resolvedUser, accessToken, refreshToken }, trustedDevice: true, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
    }

    // OTP REQUIRED — Generate temp token and send OTP
    const tempToken = jwt.sign({ userId: user.Id, email: user.Email, step: 'PASSWORD_VERIFIED', purpose: 'OTP_VERIFICATION' }, config.jwtSecret, { expiresIn: '10m' });

    try {
      const otpResult = await otpService.sendOtp(user.Id, user.Email, 'LOGIN', { ipAddress: clientIp, userAgent: req.headers['user-agent'] });
      return res.json({ success: true, requiresOtp: true, tempToken, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `Verification code sent to ${otpResult.destination}` });
    } catch (otpError) {
      return res.status(429).json({ success: false, message: otpError.message || 'Failed to send verification code' });
    }
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
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await tokenBlacklist.blacklist(authHeader.split(' ')[1]);
    }
    
    // Log Logout
    if (req.userId) {
      await SystemLogService.log({
        type: 'AUTH_LOGOUT',
        entityType: 'USER',
        entityId: req.userId,
        entityTitle: 'User Session',
        user: req.userId,
        description: 'User logged out'
      });
    }

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
          FirstName = @fn, LastName = @ln, Phone = @ph, Preferences = @pref, UpdatedAt = dbo.GetEnvDate()
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

    const result = await pool.request().input('id', sql.VarChar, req.userId).query('SELECT * FROM Users WHERE Id = @id');
    const user = result.recordset[0];

    const isMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    // Prevent reuse of last 5 passwords
    const historyResult = await pool.request()
      .input('id', sql.VarChar, req.userId)
      .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
    for (const row of historyResult.recordset) {
      if (await bcrypt.compare(newPassword, row.PasswordHash)) {
        return res.status(400).json({ success: false, message: 'Cannot reuse last 5 passwords' });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    
    // Save current password to history
    const histId = require('crypto').randomBytes(12).toString('hex');
    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('hash', sql.NVarChar, user.Password)
      .input('hid', sql.VarChar, histId)
      .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, dbo.GetEnvDate())');

    // Update password, clear force reset, clear refresh token (logout all devices)
    await pool.request()
      .input('id', sql.VarChar, req.userId)
      .input('pw', sql.NVarChar, hashed)
      .query(`UPDATE Users SET Password = @pw, ForcePasswordReset = 0, 
              PasswordChangedAt = dbo.GetEnvDate(), 
              PasswordExpiresAt = DATEADD(day, 90, dbo.GetEnvDate()),
              RefreshToken = NULL, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id`);

    // Revoke all sessions
    await tokenBlacklist.blacklistUser(req.userId);

    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { tempToken, otp, trustDevice } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!tempToken || !otp) return res.status(400).json({ success: false, message: 'Token and OTP are required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.', code: 'SESSION_EXPIRED' });
    }

    if (decoded.purpose !== 'OTP_VERIFICATION' || decoded.step !== 'PASSWORD_VERIFIED') {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT * FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Verify OTP
    await otpService.verifyOtp(user.Id, otp, 'LOGIN', { ipAddress: clientIp, userAgent });

    // Trust device if requested
    const fingerprint = Buffer.from(`${userAgent || ''}|${clientIp}`).toString('base64').slice(0, 32);
    if (trustDevice) {
      await trustedDeviceService.trust(user.Id, fingerprint, { ipAddress: clientIp, userAgent });
    }

    // Complete login — generate tokens
    const { accessToken, refreshToken } = generateTokens(user.Id, fingerprint);
    await pool.request().input('id', sql.VarChar, user.Id).input('token', sql.NVarChar, refreshToken)
      .query('UPDATE Users SET RefreshToken = @token WHERE Id = @id');

    const resolvedUser = await getResolvedUserResponse(user, pool);
    await SystemLogService.log({ type: 'AUTH_SUCCESS', entityType: 'USER', entityId: user.Id, entityTitle: resolvedUser.FirstName + ' ' + resolvedUser.LastName, user: user.Id, description: `${resolvedUser.FirstName} logged in (OTP verified)`, metadata: { ip: clientIp } });

    const needsPasswordReset = !!(user.ForcePasswordReset) || (user.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());
    res.json({ success: true, data: { user: resolvedUser, accessToken, refreshToken }, requiresSetup: !!(user.IsFirstLogin) && !user.SetupCompletedAt, needsPasswordReset });
  } catch (error) {
    if (error.message && error.message.includes('OTP')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ success: false, message: 'Token required' });

    let decoded;
    try { decoded = jwt.verify(tempToken, config.jwtSecret); } catch (e) { return res.status(401).json({ success: false, message: 'Session expired' }); }

    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, decoded.userId).query('SELECT Email FROM Users WHERE Id = @id AND IsActive = 1');
    const user = result.recordset[0];
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const otpResult = await otpService.resendOtp(decoded.userId, user.Email, 'LOGIN', { ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress, userAgent: req.headers['user-agent'] });

    res.json({ success: true, destination: otpResult.destination, expiresIn: otpResult.expiresIn, message: `New code sent to ${otpResult.destination}` });
  } catch (error) {
    res.status(429).json({ success: false, message: error.message || 'Failed to resend code' });
  }
};
