const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../database/db');

class OtpService {
  constructor() {
    this.OTP_LENGTH = 6;
    this.OTP_EXPIRY_MINUTES = 5;
    this.MAX_ATTEMPTS = 3;
    this.RATE_LIMIT_SECONDS = 60;
    this.DAILY_LIMIT = 10;
    this.BCRYPT_COST = 10;
  }

  generateOtp() {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  async sendOtp(userId, email, purpose = 'LOGIN', metadata = {}) {
    await this._checkRateLimit(userId);
    await this._checkDailyLimit(userId);
    await this._invalidatePreviousOtps(userId, purpose);

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, this.BCRYPT_COST);
    const user = await this._getUser(userId);
    const pool = await getPool();

    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('email', sql.NVarChar, email)
      .input('otpHash', sql.NVarChar, otpHash)
      .input('purpose', sql.NVarChar, purpose)
      .input('ipAddress', sql.NVarChar, metadata.ipAddress || null)
      .input('userAgent', sql.NVarChar, (metadata.userAgent || '').substring(0, 500))
      .input('expiresAt', sql.DateTime, new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60000))
      .query(`INSERT INTO OtpVerifications (UserId, Email, OtpHash, Purpose, IpAddress, UserAgent, ExpiresAt) VALUES (@userId, @email, @otpHash, @purpose, @ipAddress, @userAgent, @expiresAt)`);

    await this._updateOtpCounter(userId);
    await this._sendOtpEmail(email, otp, user, purpose, metadata);
    await this._auditLog(userId, email, 'OTP_SENT', 'SUCCESS', null, metadata);

    return { success: true, expiresIn: this.OTP_EXPIRY_MINUTES * 60, destination: this._maskEmail(email), attemptsRemaining: this.MAX_ATTEMPTS };
  }

  async verifyOtp(userId, otp, purpose = 'LOGIN', metadata = {}) {
    if (!otp || !/^\d{6}$/.test(otp)) throw new Error('Invalid OTP format. Must be 6 digits.');

    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('purpose', sql.NVarChar, purpose)
      .query(`SELECT TOP 1 * FROM OtpVerifications WHERE UserId = @userId AND Purpose = @purpose AND IsUsed = 0 AND ExpiresAt > GETDATE() ORDER BY CreatedAt DESC`);

    const otpRecord = result.recordset[0];
    if (!otpRecord) {
      await this._auditLog(userId, null, 'OTP_VERIFY', 'FAILED', 'No valid OTP found or expired', metadata);
      throw new Error('OTP expired or invalid. Please request a new one.');
    }

    if (otpRecord.Attempts >= otpRecord.MaxAttempts) {
      await pool.request().input('id', sql.Int, otpRecord.Id).query(`UPDATE OtpVerifications SET IsUsed = 1 WHERE Id = @id`);
      await this._auditLog(userId, otpRecord.Email, 'OTP_VERIFY', 'FAILED', 'Max attempts reached', metadata);
      throw new Error('Too many incorrect attempts. Please request a new OTP.');
    }

    const isValid = await bcrypt.compare(otp, otpRecord.OtpHash);

    await pool.request().input('id', sql.Int, otpRecord.Id).query(`UPDATE OtpVerifications SET Attempts = Attempts + 1 WHERE Id = @id`);

    if (!isValid) {
      const remaining = otpRecord.MaxAttempts - otpRecord.Attempts - 1;
      await this._auditLog(userId, otpRecord.Email, 'OTP_VERIFY', 'FAILED', `Invalid OTP, ${remaining} attempts left`, metadata);
      throw new Error(remaining > 0 ? `Invalid OTP. ${remaining} attempt(s) remaining.` : 'Invalid OTP. No more attempts. Please request a new OTP.');
    }

    await pool.request().input('id', sql.Int, otpRecord.Id).query(`UPDATE OtpVerifications SET IsUsed = 1, UsedAt = GETDATE() WHERE Id = @id`);
    await this._auditLog(userId, otpRecord.Email, 'OTP_VERIFY', 'SUCCESS', null, metadata);
    return { success: true, verifiedAt: new Date() };
  }

  async resendOtp(userId, email, purpose = 'LOGIN', metadata = {}) {
    return await this.sendOtp(userId, email, purpose, metadata);
  }

  async _sendOtpEmail(email, otp, user, purpose, metadata) {
    try {
      const emailService = require('./emailService');
      const purposeText = { 'LOGIN': 'login to RetailOps', 'PASSWORD_RESET': 'reset your password' }[purpose] || 'continue';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
        <div style="max-width:500px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
          <h1 style="text-align:center;color:#18181b;margin:0 0 8px;font-size:20px">Verification Code</h1>
          <p style="text-align:center;color:#71717a;margin:0 0 24px;font-size:13px">RetailOps Security</p>
          <p style="font-size:14px;color:#334155">Hi <strong>${user.FirstName || 'there'}</strong>,</p>
          <p style="font-size:14px;color:#334155">You requested to ${purposeText}. Use this code:</p>
          <div style="background:#f8fafc;border:2px dashed #d4d4d8;padding:24px;text-align:center;margin:20px 0;border-radius:8px">
            <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#18181b;font-family:monospace">${otp}</div>
            <div style="color:#71717a;font-size:12px;margin-top:8px">Expires in ${this.OTP_EXPIRY_MINUTES} minutes</div>
          </div>
          <div style="background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:13px;color:#713f12">
            <strong>Security:</strong> Never share this code. If you didn't request this, ignore this email.
          </div>
          <div style="border-top:1px solid #f4f4f5;padding-top:16px;margin-top:20px;font-size:12px;color:#a1a1aa;text-align:center">
            Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | IP: ${metadata.ipAddress || 'Unknown'}
          </div>
        </div></body></html>`;

      await emailService.send({ to: email, subject: `RetailOps OTP: ${otp.slice(0, 3)}-${otp.slice(3)}`, html });
    } catch (e) {
      // Email failed — log OTP to console so dev can still test
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📧 Email delivery failed: ${e.message}`);
      console.log(`🔐 OTP for ${email}: ${otp}`);
      console.log(`⏰ Expires in ${this.OTP_EXPIRY_MINUTES} minutes`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
  }

  async _checkRateLimit(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`SELECT TOP 1 CreatedAt FROM OtpVerifications WHERE UserId = @userId AND CreatedAt > DATEADD(SECOND, -${this.RATE_LIMIT_SECONDS}, GETDATE()) ORDER BY CreatedAt DESC`);
    if (result.recordset[0]) {
      const secondsSince = Math.floor((Date.now() - new Date(result.recordset[0].CreatedAt)) / 1000);
      const waitTime = this.RATE_LIMIT_SECONDS - secondsSince;
      if (waitTime > 0) throw new Error(`Please wait ${waitTime} seconds before requesting another OTP`);
    }
  }

  async _checkDailyLimit(userId) {
    const pool = await getPool();
    const result = await pool.request().input('userId', sql.NVarChar, userId).query(`SELECT OtpSentCountToday, OtpResetDate FROM Users WHERE Id = @userId`);
    const user = result.recordset[0];
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const resetDate = user.OtpResetDate?.toISOString?.()?.split('T')[0] || (user.OtpResetDate || '').split(' ')[0];
    if (resetDate !== today) {
      await pool.request().input('userId', sql.NVarChar, userId).query(`UPDATE Users SET OtpSentCountToday = 0, OtpResetDate = CAST(GETDATE() AS DATE) WHERE Id = @userId`);
      return;
    }
    if (user.OtpSentCountToday >= this.DAILY_LIMIT) throw new Error(`Daily OTP limit of ${this.DAILY_LIMIT} reached. Please try again tomorrow.`);
  }

  async _updateOtpCounter(userId) {
    const pool = await getPool();
    await pool.request().input('userId', sql.NVarChar, userId).query(`UPDATE Users SET LastOtpSentAt = GETDATE(), OtpSentCountToday = OtpSentCountToday + 1 WHERE Id = @userId`);
  }

  async _invalidatePreviousOtps(userId, purpose) {
    const pool = await getPool();
    await pool.request().input('userId', sql.NVarChar, userId).input('purpose', sql.NVarChar, purpose).query(`UPDATE OtpVerifications SET IsUsed = 1 WHERE UserId = @userId AND Purpose = @purpose AND IsUsed = 0`);
  }

  async _getUser(userId) {
    const pool = await getPool();
    const result = await pool.request().input('userId', sql.NVarChar, userId).query(`SELECT Id, Email, FirstName, LastName FROM Users WHERE Id = @userId`);
    if (!result.recordset[0]) throw new Error('User not found');
    return result.recordset[0];
  }

  _maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***';
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 ? `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}` : `${local[0]}*`;
    return `${maskedLocal}@${domain}`;
  }

  async _auditLog(userId, email, action, status, reason = null, metadata = {}) {
    try {
      const pool = await getPool();
      await pool.request()
        .input('userId', sql.NVarChar, userId || 'system')
        .input('email', sql.NVarChar, email || 'unknown')
        .input('action', sql.NVarChar, action)
        .input('status', sql.NVarChar, status)
        .input('reason', sql.NVarChar, reason)
        .input('ipAddress', sql.NVarChar, metadata.ipAddress || null)
        .input('userAgent', sql.NVarChar, (metadata.userAgent || '').substring(0, 500))
        .query(`INSERT INTO OtpAuditLog (UserId, Email, Action, Status, Reason, IpAddress, UserAgent) VALUES (@userId, @email, @action, @status, @reason, @ipAddress, @userAgent)`);
    } catch (e) { console.error('OTP audit log failed:', e.message); }
  }
}

module.exports = new OtpService();
