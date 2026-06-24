const { getPool, sql } = require('../database/db');
const bcrypt = require('bcryptjs');

const WIZARD_STEPS = [
  { id: 'welcome', order: 1, title: 'Welcome to RetailOps!', required: true, skippable: false },
  { id: 'security_tips', order: 2, title: 'Security Tips', required: true, skippable: false },
  { id: 'change_password', order: 3, title: 'Set Your Password', required: true, skippable: false },
  { id: 'accept_policies', order: 4, title: 'Terms & Policies', required: true, skippable: false },
  { id: 'complete', order: 5, title: 'All Done!', required: true, skippable: false },
];

class SetupWizardService {
  async getStatus(userId) {
    const pool = await getPool();
    const result = await pool.request().input('userId', sql.VarChar, userId)
      .query('SELECT IsFirstLogin, SetupCompletedAt, SecurityPolicyAccepted FROM Users WHERE Id = @userId');
    const user = result.recordset[0];
    if (!user) return { needsSetup: false };

    const progress = await pool.request().input('userId', sql.VarChar, userId)
      .query('SELECT StepName, Status FROM SetupWizardProgress WHERE UserId = @userId');
    const completedSteps = progress.recordset.filter(p => p.Status === 'COMPLETED').map(p => p.StepName);

    const nextStep = WIZARD_STEPS.find(s => !completedSteps.includes(s.id));
    const completed = WIZARD_STEPS.filter(s => completedSteps.includes(s.id)).length;
    const total = WIZARD_STEPS.length;

    return {
      needsSetup: user.IsFirstLogin === 1 && !user.SetupCompletedAt,
      isFirstLogin: user.IsFirstLogin === 1,
      forcePasswordReset: false,
      progress: { completed, total, percentage: Math.round((completed / total) * 100) },
      nextStep: nextStep ? nextStep.id : 'complete',
      completedSteps,
      securityAccepted: user.SecurityPolicyAccepted === 1,
    };
  }

  async completeStep(userId, stepName) {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.VarChar, userId)
      .input('step', sql.NVarChar, stepName)
      .query(`IF EXISTS (SELECT 1 FROM SetupWizardProgress WHERE UserId = @userId AND StepName = @step)
        UPDATE SetupWizardProgress SET Status = 'COMPLETED', CompletedAt = GETDATE() WHERE UserId = @userId AND StepName = @step
      ELSE
        INSERT INTO SetupWizardProgress (UserId, StepName, Status, CompletedAt) VALUES (@userId, @step, 'COMPLETED', GETDATE())`);

    if (stepName === 'change_password') {
      await pool.request().input('userId', sql.VarChar, userId)
        .query('UPDATE Users SET ForcePasswordReset = 0, IsFirstLogin = 1 WHERE Id = @userId');
    }
    if (stepName === 'accept_policies') {
      await pool.request().input('userId', sql.VarChar, userId)
        .query('UPDATE Users SET SecurityPolicyAccepted = 1, SecurityPolicyAcceptedAt = GETDATE() WHERE Id = @userId');
    }

    const progress = await this.getStatus(userId);
    return { success: true, ...progress };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, userId).query('SELECT Password FROM Users WHERE Id = @id');
    const user = result.recordset[0];
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.Password);
    if (!isValid) throw new Error('Current password is incorrect');

    const history = await pool.request().input('id', sql.VarChar, userId)
      .query('SELECT TOP 5 PasswordHash FROM PasswordHistory WHERE UserId = @id ORDER BY ChangedAt DESC');
    for (const row of history.recordset) {
      if (await bcrypt.compare(newPassword, row.PasswordHash)) {
        throw new Error('Cannot reuse last 5 passwords');
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.request().input('id', sql.VarChar, userId).input('pw', sql.NVarChar, hashed)
      .query('UPDATE Users SET Password = @pw, PasswordChangedAt = GETDATE(), PasswordExpiresAt = DATEADD(day, 90, GETDATE()), RefreshToken = NULL WHERE Id = @id');

    const histId = require('crypto').randomBytes(12).toString('hex');
    await pool.request().input('id', sql.VarChar, userId).input('hash', sql.NVarChar, user.Password).input('hid', sql.VarChar, histId)
      .query('INSERT INTO PasswordHistory (Id, UserId, PasswordHash, ChangedAt) VALUES (@hid, @id, @hash, GETDATE())');

    const tokenBlacklist = require('./tokenBlacklistService');
    await tokenBlacklist.blacklistUser(userId);

    return { success: true };
  }

  async completeWizard(userId) {
    const pool = await getPool();
    await pool.request().input('userId', sql.VarChar, userId)
      .query(`UPDATE Users SET IsFirstLogin = 0, SetupCompletedAt = GETDATE() WHERE Id = @userId`);
    return { success: true };
  }
}

module.exports = new SetupWizardService();
