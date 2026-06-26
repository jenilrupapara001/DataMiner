const { sql, getPool } = require('../database/db');

exports.getLogs = async (req, res) => {
    try {
        const pool = await getPool();
        const {
            page = 1,
            limit = 50,
            type = '',
            severity = '',
            search = '',
            entityType = '',
            startDate = '',
            endDate = '',
            hideNoise = 'true'
        } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 50, 500);
        const offset = (pageNum - 1) * limitNum;

        let whereClauses = [];
        const request = pool.request();
        let paramIdx = 0;

        // Severity filter — hide low-importance noise by default
        if (hideNoise === 'true') {
            whereClauses.push(`(l.Severity IN ('HIGH', 'CRITICAL') OR (l.Type IN ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT', 'LIVE_SYNC', 'LIVE_SYNC_TEST', 'SYSTEM_ERROR', 'AUTH_FAILURE', 'AUTH_SUCCESS', 'AUTH_LOGOUT', 'TARGET_UPDATE', 'TARGET_IMPORT', 'TARGET_DELETE', 'AUTOMATION_TASK') AND l.Type IS NOT NULL AND (l.Description IS NOT NULL AND l.Description != '')))`);
        } else if (severity) {
            const p = `sev${paramIdx++}`;
            request.input(p, sql.NVarChar, severity);
            whereClauses.push(`l.Severity = @${p}`);
        }

        // Type filter — when a specific type is selected, use ONLY that type
        if (type && type !== 'ALL') {
            const p = `typ${paramIdx++}`;
            request.input(p, sql.NVarChar, type);
            whereClauses.push(`l.Type = @${p}`);
        }

        // Entity type filter
        if (entityType) {
            const p = `ent${paramIdx++}`;
            request.input(p, sql.NVarChar, entityType);
            whereClauses.push(`l.EntityType = @${p}`);
        }

        // Search in description, entityTitle
        if (search) {
            const p = `srch${paramIdx++}`;
            request.input(p, sql.NVarChar, `%${search}%`);
            whereClauses.push(`(l.Description LIKE @${p} OR l.EntityTitle LIKE @${p})`);
        }

        // Date range
        if (startDate) {
            const p = `sd${paramIdx++}`;
            request.input(p, sql.DateTime2, new Date(startDate));
            whereClauses.push(`l.CreatedAt >= @${p}`);
        }
        if (endDate) {
            const p = `ed${paramIdx++}`;
            const d = new Date(endDate);
            d.setHours(23, 59, 59, 999);
            request.input(p, sql.DateTime2, d);
            whereClauses.push(`l.CreatedAt <= @${p}`);
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count total
        const countResult = await request.query(`SELECT COUNT(*) as total FROM SystemLogs l ${whereSQL}`);
        const total = countResult.recordset[0]?.total || 0;

        // Fetch paginated logs with user info
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limitNum);

        const result = await request.query(`
            SELECT l.Id, l.Type, l.Severity, l.EntityType, l.EntityId, l.EntityTitle,
                   l.UserId, l.Description, l.Metadata, l.CreatedAt,
                   u.FirstName, u.LastName, u.Email
            FROM SystemLogs l
            LEFT JOIN Users u ON l.UserId = u.Id
            ${whereSQL}
            ORDER BY l.CreatedAt DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        const logs = result.recordset.map(log => ({
            _id: log.Id,
            type: log.Type,
            severity: log.Severity || 'INFO',
            entityType: log.EntityType,
            entityId: log.EntityId,
            entityTitle: log.EntityTitle,
            description: log.Description,
            metadata: log.Metadata,
            createdAt: log.CreatedAt,
            user: {
                Id: log.UserId,
                firstName: log.FirstName,
                lastName: log.LastName,
                email: log.Email
            }
        }));

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }
};
