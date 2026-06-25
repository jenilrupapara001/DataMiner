const crypto = require('crypto');
const { getPool, sql } = require('../database/db');

class TrustedDeviceService {
  constructor() {
    this.TRUST_DURATION_DAYS = 0.5; // 12 hours
  }

  generateFingerprint(req) {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['sec-ch-ua'] || '',
      req.headers['sec-ch-ua-platform'] || ''
    ].filter(Boolean).join('|');
    return crypto.createHash('sha256').update(components).digest('hex').slice(0, 64);
  }

  async isTrusted(userId, fingerprint) {
    if (!fingerprint) return false;
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('fingerprint', sql.NVarChar, fingerprint)
      .query(`SELECT TOP 1 Id FROM TrustedDevices WHERE UserId = @userId AND DeviceFingerprint = @fingerprint AND IsRevoked = 0 AND ExpiresAt > GETDATE()`);
    if (result.recordset[0]) {
      await pool.request().input('id', sql.Int, result.recordset[0].Id).query(`UPDATE TrustedDevices SET LastUsedAt = GETDATE() WHERE Id = @id`);
      return true;
    }
    return false;
  }

  async trust(userId, fingerprint, metadata = {}) {
    if (!fingerprint) return;
    const pool = await getPool();
    const expiresAt = new Date(Date.now() + this.TRUST_DURATION_DAYS * 86400000);
    const existing = await pool.request().input('userId', sql.NVarChar, userId).input('fingerprint', sql.NVarChar, fingerprint).query(`SELECT Id FROM TrustedDevices WHERE UserId = @userId AND DeviceFingerprint = @fingerprint`);
    if (existing.recordset[0]) {
      await pool.request().input('id', sql.Int, existing.recordset[0].Id).input('expiresAt', sql.DateTime, expiresAt).query(`UPDATE TrustedDevices SET ExpiresAt = @expiresAt, IsRevoked = 0, LastUsedAt = GETDATE() WHERE Id = @id`);
    } else {
      const deviceName = this._parseDeviceName(metadata.userAgent);
      await pool.request().input('userId', sql.NVarChar, userId).input('fingerprint', sql.NVarChar, fingerprint).input('deviceName', sql.NVarChar, deviceName).input('ipAddress', sql.NVarChar, metadata.ipAddress || null).input('expiresAt', sql.DateTime, expiresAt).query(`INSERT INTO TrustedDevices (UserId, DeviceFingerprint, DeviceName, IpAddress, ExpiresAt) VALUES (@userId, @fingerprint, @deviceName, @ipAddress, @expiresAt)`);
    }
  }

  async revokeAll(userId) {
    const pool = await getPool();
    await pool.request().input('userId', sql.NVarChar, userId).query(`UPDATE TrustedDevices SET IsRevoked = 1 WHERE UserId = @userId AND IsRevoked = 0`);
  }

  async getUserDevices(userId) {
    const pool = await getPool();
    const result = await pool.request().input('userId', sql.NVarChar, userId).query(`SELECT Id, DeviceName, IpAddress, LastUsedAt, ExpiresAt FROM TrustedDevices WHERE UserId = @userId AND IsRevoked = 0 AND ExpiresAt > GETDATE() ORDER BY LastUsedAt DESC`);
    return result.recordset;
  }

  _parseDeviceName(ua) {
    if (!ua) return 'Unknown Device';
    let browser = 'Browser', os = 'OS';
    if (ua.includes('Chrome')) browser = 'Chrome'; else if (ua.includes('Firefox')) browser = 'Firefox'; else if (ua.includes('Safari')) browser = 'Safari'; else if (ua.includes('Edge')) browser = 'Edge';
    if (ua.includes('Windows')) os = 'Windows'; else if (ua.includes('Mac')) os = 'macOS'; else if (ua.includes('Linux')) os = 'Linux'; else if (ua.includes('Android')) os = 'Android'; else if (ua.includes('iPhone')) os = 'iPhone';
    return `${browser} on ${os}`;
  }
}

module.exports = new TrustedDeviceService();
