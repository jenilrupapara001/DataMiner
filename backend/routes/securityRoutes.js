const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const trustedDeviceService = require('../services/trustedDeviceService');

// OTP Analytics (admin only)
router.get('/otp-analytics', authenticate, async (req, res) => {
  try {
    const role = (req.user.role?.name || req.user.role || '').toLowerCase();
    if (!['admin', 'superadmin', 'super_admin', 'operational_manager'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const hours = parseInt(req.query.hours) || 24;
    const pool = await getPool();
    const stats = await pool.request().input('hours', sql.Int, hours).query(`
      SELECT COUNT(*) as TotalSent,
        SUM(CASE WHEN Action = 'OTP_VERIFIED' THEN 1 ELSE 0 END) as Verified,
        SUM(CASE WHEN Action = 'OTP_FAILED' THEN 1 ELSE 0 END) as Failed
      FROM OtpAuditLog WHERE CreatedAt > DATEADD(HOUR, -@hours, GETUTCDATE())
    `);
    const topUsers = await pool.request().input('hours', sql.Int, hours).query(`
      SELECT TOP 10 Email, COUNT(*) as Count FROM OtpAuditLog
      WHERE CreatedAt > DATEADD(HOUR, -@hours, GETUTCDATE())
      GROUP BY Email ORDER BY Count DESC
    `);
    const suspicious = await pool.request().input('hours', sql.Int, hours).query(`
      SELECT TOP 10 IpAddress, COUNT(*) as Attempts FROM OtpAuditLog
      WHERE Status = 'FAILED' AND CreatedAt > DATEADD(HOUR, -@hours, GETUTCDATE())
      GROUP BY IpAddress HAVING COUNT(*) > 3 ORDER BY Attempts DESC
    `);
    res.json({ success: true, stats: stats.recordset[0], topUsers: topUsers.recordset, suspiciousIps: suspicious.recordset });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Trusted Devices
router.get('/trusted-devices', authenticate, async (req, res) => {
  try {
    const devices = await trustedDeviceService.getUserDevices(req.user.Id || req.user._id);
    res.json({ success: true, devices });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/trusted-devices/all', authenticate, async (req, res) => {
  try {
    await trustedDeviceService.revokeAll(req.user.Id || req.user._id);
    res.json({ success: true, message: 'All trusted devices revoked' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/trusted-devices/:deviceId', authenticate, async (req, res) => {
  try {
    await trustedDeviceService.revoke(req.user.Id || req.user._id, parseInt(req.params.deviceId));
    res.json({ success: true, message: 'Device revoked' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
