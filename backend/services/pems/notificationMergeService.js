/**
 * PEMS Notification Merge Service
 * Combines regular notifications with PEMS task notifications
 */
const { sql, getPool } = require('../../database/db');

async function getMergedNotifications(userId, limit = 20) {
  const pool = await getPool();

  // Get PEMS notifications
  const pemsResult = await pool.request()
    .input('userId', sql.VarChar, userId)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        Id, TaskInstanceId as ReferenceId, UserId, Type, Title, Message, IsRead, CreatedAt,
        'PEMS' as Source
      FROM PemsNotifications
      WHERE UserId = @userId
      ORDER BY CreatedAt DESC
    `);

  return pemsResult.recordset || [];
}

module.exports = { getMergedNotifications };
