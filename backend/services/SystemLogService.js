const { sql, getPool, generateId } = require('../database/db');

class SystemLogService {
    async log({ type, entityType, entityId, entityTitle, user, description, metadata }) {
        try {
            const pool = await getPool();
            const id = generateId();
            const userId = user?.Id || user?._id || user;

            await pool.request()
                .input('Id', sql.VarChar, id)
                .input('Type', sql.NVarChar, type)
                .input('EntityType', sql.NVarChar, entityType)
                .input('EntityId', sql.VarChar, entityId)
                .input('EntityTitle', sql.NVarChar, entityTitle)
                .input('UserId', sql.VarChar, userId)
                .input('Description', sql.NVarChar, description)
                .input('Metadata', sql.NVarChar, metadata ? JSON.stringify(metadata) : null)
                .query(`
                    INSERT INTO SystemLogs (Id, Type, EntityType, EntityId, EntityTitle, UserId, Description, Metadata, CreatedAt)
                    VALUES (@Id, @Type, @EntityType, @EntityId, @EntityTitle, @UserId, @Description, @Metadata, dbo.GetEnvDate())
                `);

            // Emit log event through SocketService in real-time
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    io.emit('new_system_log', {
                        Id: id,
                        Type: type,
                        EntityType: entityType,
                        EntityId: entityId,
                        EntityTitle: entityTitle,
                        UserId: userId,
                        Description: description,
                        CreatedAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.warn('[SystemLogService] Failed to emit socket event:', err.message);
            }

            return { Id: id };
        } catch (error) {
            console.error('[SystemLogService] Failed to create log:', error);
        }
    }

    async getLogs(filter = {}, limit = 100) {
        try {
            const pool = await getPool();
            const result = await pool.request()
                .query(`
                    SELECT TOP ${limit} l.*, u.FirstName, u.LastName, u.Email
                    FROM SystemLogs l
                    LEFT JOIN Users u ON l.UserId = u.Id
                    ORDER BY l.CreatedAt DESC
                `);

            return result.recordset.map(log => ({
                ...log,
                user: {
                    Id: log.UserId,
                    firstName: log.FirstName,
                    lastName: log.LastName,
                    email: log.Email
                }
            }));
        } catch (error) {
            console.error('[SystemLogService] Failed to fetch logs:', error);
            return [];
        }
    }
}

module.exports = new SystemLogService();
