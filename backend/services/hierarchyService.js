const { sql, getPool } = require('../database/db');

/**
 * Recursively find all subordinates of a user (SQL Version)
 * @param {string} userId - The user ID to find subordinates for
 * @returns {Promise<string[]>} - Array of subordinate user IDs
 */
exports.getSubordinateIds = async (userId) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`
                WITH Hierarchy AS (
                    SELECT UserId FROM UserSupervisors WHERE SupervisorId = @userId
                    UNION ALL
                    SELECT US.UserId FROM UserSupervisors US
                    JOIN Hierarchy H ON US.SupervisorId = H.UserId
                )
                SELECT DISTINCT UserId FROM Hierarchy
            `);
        
        return result.recordset.map(row => row.UserId);
    } catch (error) {
        console.error('getSubordinateIds error:', error);
        return [];
    }
};
