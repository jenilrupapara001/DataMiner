const { sql, getPool, generateId } = require('../database/db');

/**
 * Log a tag change
 */
async function logTagChange(asinId, previousTags, newTags, userId, userName, source = 'manual', notes = '') {
    try {
        const pool = await getPool();
        const id = generateId();

        const prev = Array.isArray(previousTags) ? previousTags : [];
        const next = Array.isArray(newTags) ? newTags : [];
        
        // Calculate added and removed tags
        const addedTags = next.filter(t => !prev.includes(t));
        const removedTags = prev.filter(t => !next.includes(t));
        
        // Determine action type
        let action = 'update';
        if (addedTags.length > 0 && removedTags.length === 0) action = 'add';
        else if (removedTags.length > 0 && addedTags.length === 0) action = 'remove';

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('asinId', sql.VarChar, asinId)
            .input('userId', sql.VarChar, userId || null)
            .input('userName', sql.NVarChar, userName || 'System')
            .input('previousTags', sql.NVarChar, JSON.stringify(prev))
            .input('newTags', sql.NVarChar, JSON.stringify(next))
            .input('addedTags', sql.NVarChar, JSON.stringify(addedTags))
            .input('removedTags', sql.NVarChar, JSON.stringify(removedTags))
            .input('action', sql.NVarChar, action)
            .input('source', sql.NVarChar, source)
            .input('notes', sql.NVarChar, notes)
            .query(`
                INSERT INTO TagsHistory (Id, AsinId, UserId, UserName, PreviousTags, NewTags, AddedTags, RemovedTags, Action, Source, Notes, CreatedAt)
                VALUES (@id, @asinId, @userId, @userName, @previousTags, @newTags, @addedTags, @removedTags, @action, @source, @notes, GETDATE())
            `);
        
        return id;
    } catch (error) {
        console.error('Failed to log tag change:', error.message);
        // Don't throw — logging failure shouldn't break the main operation
        return null;
    }
}

/**
 * Get complete tags history for an ASIN
 * GET /api/asins/:asinId/tags-history
 */
exports.getTagsHistory = async (req, res) => {
    try {
        const { asinId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const pool = await getPool();

        // Check ASIN exists
        const asinResult = await pool.request()
            .input('id', sql.VarChar, asinId)
            .query('SELECT AsinCode, Tags FROM Asins WHERE Id = @id');

        if (asinResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        const asin = asinResult.recordset[0];

        // Count total history entries
        const countResult = await pool.request()
            .input('asinId', sql.VarChar, asinId)
            .query('SELECT COUNT(*) as total FROM TagsHistory WHERE AsinId = @asinId');
        const total = countResult.recordset[0].total;

        // Fetch history with pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const historyResult = await pool.request()
            .input('asinId', sql.VarChar, asinId)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, parseInt(limit))
            .query(`
                SELECT * FROM TagsHistory 
                WHERE AsinId = @asinId 
                ORDER BY CreatedAt DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        // Parse JSON fields
        const history = historyResult.recordset.map(row => ({
            _id: row.Id,
            id: row.Id,
            action: row.Action,
            source: row.Source,
            userName: row.UserName,
            previousTags: (() => { try { return JSON.parse(row.PreviousTags || '[]'); } catch { return []; } })(),
            newTags: (() => { try { return JSON.parse(row.NewTags || '[]'); } catch { return []; } })(),
            addedTags: (() => { try { return JSON.parse(row.AddedTags || '[]'); } catch { return []; } })(),
            removedTags: (() => { try { return JSON.parse(row.RemovedTags || '[]'); } catch { return []; } })(),
            notes: row.Notes,
            createdAt: row.CreatedAt
        }));

        // Get current tags
        let currentTags = [];
        try { currentTags = JSON.parse(asin.Tags || '[]'); } catch { currentTags = []; }

        res.json({
            success: true,
            data: {
                asinCode: asin.AsinCode,
                currentTags,
                history,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('getTagsHistory Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get tags summary for an ASIN (latest changes only)
 * GET /api/asins/:asinId/tags-summary
 */
exports.getTagsSummary = async (req, res) => {
    try {
        const { asinId } = req.params;
        const pool = await getPool();

        // Get ASIN current tags
        const asinResult = await pool.request()
            .input('id', sql.VarChar, asinId)
            .query('SELECT AsinCode, Tags FROM Asins WHERE Id = @id');

        if (asinResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        const asin = asinResult.recordset[0];
        let currentTags = [];
        try { currentTags = JSON.parse(asin.Tags || '[]'); } catch { currentTags = []; }

        // Get last 5 changes
        const historyResult = await pool.request()
            .input('asinId', sql.VarChar, asinId)
            .query(`
                SELECT TOP 5 Id, Action, AddedTags, RemovedTags, UserName, CreatedAt, Source
                FROM TagsHistory 
                WHERE AsinId = @asinId 
                ORDER BY CreatedAt DESC
            `);

        const recentChanges = historyResult.recordset.map(row => ({
            action: row.Action,
            source: row.Source,
            userName: row.UserName,
            addedTags: (() => { try { return JSON.parse(row.AddedTags || '[]'); } catch { return []; } })(),
            removedTags: (() => { try { return JSON.parse(row.RemovedTags || '[]'); } catch { return []; } })(),
            createdAt: row.CreatedAt
        }));

        // Get total change count
        const countResult = await pool.request()
            .input('asinId', sql.VarChar, asinId)
            .query('SELECT COUNT(*) as total FROM TagsHistory WHERE AsinId = @asinId');

        res.json({
            success: true,
            data: {
                asinCode: asin.AsinCode,
                currentTags,
                totalChanges: countResult.recordset[0].total,
                recentChanges,
                lastUpdated: recentChanges.length > 0 ? recentChanges[0].createdAt : null
            }
        });
    } catch (error) {
        console.error('getTagsSummary Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Export the logging function for use in other controllers
exports.logTagChange = logTagChange;
