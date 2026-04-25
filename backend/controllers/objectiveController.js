const { sql, getPool, generateId } = require('../database/db');

/**
 * Get objectives with hierarchy
 */
exports.getObjectives = async (req, res) => {
    try {
        const { sellerId, type } = req.query;
        const userId = req.user.Id || req.user._id;
        const roleName = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const pool = await getPool();

        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (sellerId) {
            whereClause += " AND SellerId = @sellerId";
            request.input('sellerId', sql.VarChar, sellerId);
        }
        if (type) {
            whereClause += " AND Type = @type";
            request.input('type', sql.NVarChar, type);
        }

        if (!isGlobalUser) {
            // Non-global: objectives owned by user's team OR linked to team's actions
            const hierarchyService = require('../services/hierarchyService');
            const subordinateIds = await hierarchyService.getSubordinateIds(userId);
            const teamIds = [userId, ...subordinateIds];
            const teamList = teamIds.map(id => `'${id}'`).join(',');

            // Also filter by assigned sellers
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            let accessFilter = '';
            if (assignedSellerIds.length > 0) {
                accessFilter = ` OR (SellerId IN (${assignedSellerIds.map(id => `'${id}'`).join(',')}) AND SellerId IS NOT NULL)`;
            }

            whereClause += ` AND (OwnerId IN (${teamList}) ${accessFilter})`;
        }

        const objectivesResult = await request.query(`
            SELECT o.*, u.FirstName + ' ' + u.LastName as OwnerName, s.Name as SellerName
            FROM Objectives o
            LEFT JOIN Users u ON o.OwnerId = u.Id
            LEFT JOIN Sellers s ON o.SellerId = s.Id
            ${whereClause}
            ORDER BY o.CreatedAt DESC
        `);

        // For each objective, fetch its key results
        const objectives = await Promise.all(objectivesResult.recordset.map(async (obj) => {
            const krsResult = await pool.request()
                .input('objectiveId', sql.VarChar, obj.Id)
                .query(`
                    SELECT * FROM KeyResults WHERE ObjectiveId = @objectiveId ORDER BY CreatedAt ASC
                `);

            const keyResults = krsResult.recordset.map(kr => ({
                ...kr,
                _id: kr.Id,
                objectiveId: kr.ObjectiveId,
                owner: kr.OwnerId,
                createdAt: kr.CreatedAt,
                updatedAt: kr.UpdatedAt
            }));

            return {
                ...obj,
                _id: obj.Id,
                owner: obj.OwnerId ? { _id: obj.OwnerId, name: obj.OwnerName } : null,
                seller: obj.SellerId ? { _id: obj.SellerId, name: obj.SellerName } : null,
                keyResults,
                startDate: obj.StartDate,
                endDate: obj.EndDate,
                status: obj.Status,
                progress: obj.Progress || 0,
                createdAt: obj.CreatedAt,
                updatedAt: obj.UpdatedAt
            };
        }));

        res.json({ success: true, data: objectives });
    } catch (error) {
        console.error('Error fetching objectives:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create new objective
 */
exports.createObjective = async (req, res) => {
    try {
        const { title, description, startDate, endDate, sellerId, ownerIds, keyResults } = req.body;
        const pool = await getPool();
        const objectiveId = generateId();
        const createdBy = req.user.Id || req.user._id;

        // Insert objective
        await pool.request()
            .input('Id', sql.VarChar, objectiveId)
            .input('Title', sql.NVarChar, title)
            .input('Description', sql.NVarChar, description || '')
            .input('StartDate', sql.Date, startDate || null)
            .input('EndDate', sql.Date, endDate || null)
            .input('SellerId', sql.VarChar, sellerId || null)
            .input('CreatedBy', sql.VarChar, createdBy)
            .query(`
                INSERT INTO Objectives (Id, Title, Description, StartDate, EndDate, SellerId, OwnerId, CreatedAt, UpdatedAt)
                VALUES (@Id, @Title, @Description, @StartDate, @EndDate, @SellerId, @CreatedBy, GETDATE(), GETDATE())
            `);

        // Insert key results if any
        if (keyResults && Array.isArray(keyResults)) {
            for (const kr of keyResults) {
                const krId = generateId();
                await pool.request()
                    .input('Id', sql.VarChar, krId)
                    .input('ObjectiveId', sql.VarChar, objectiveId)
                    .input('Title', sql.NVarChar, kr.title)
                    .input('Description', sql.NVarChar, kr.description || '')
                    .input('OwnerId', sql.VarChar, kr.owner || createdBy)
                    .input('TargetValue', sql.Decimal, kr.targetValue || 0)
                    .input('Unit', sql.NVarChar, kr.unit || '')
                    .query(`
                        INSERT INTO KeyResults (Id, ObjectiveId, Title, Description, OwnerId, TargetValue, Unit, CurrentValue, CreatedAt, UpdatedAt)
                        VALUES (@Id, @ObjectiveId, @Title, @Description, @OwnerId, @TargetValue, @Unit, 0, GETDATE(), GETDATE())
                    `);
            }
        }

        // Recalculate progress
        await recalcObjectiveProgress(objectiveId);

        const result = await pool.request()
            .input('id', sql.VarChar, objectiveId)
            .query("SELECT * FROM Objectives WHERE Id = @id");

        res.status(201).json({ success: true, data: { ...result.recordset[0], _id: objectiveId } });
    } catch (error) {
        console.error('Error creating objective:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateObjective = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startDate, endDate, status } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (title) { updates.push(`Title = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, title); }
        if (description !== undefined) { updates.push(`Description = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, description); }
        if (startDate) { updates.push(`StartDate = @p${idx++}`); request.input(`p${idx-1}`, sql.Date, startDate); }
        if (endDate) { updates.push(`EndDate = @p${idx++}`); request.input(`p${idx-1}`, sql.Date, endDate); }
        if (status) { updates.push(`Status = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, status); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = GETDATE()');
        request.input('id', sql.VarChar, id);
        const result = await request.query(`
            UPDATE Objectives SET ${updates.join(', ')} WHERE Id = @id;
            SELECT * FROM Objectives WHERE Id = @id;
        `);

        if (result.recordset[1]?.length === 0) return res.status(404).json({ success: false, message: 'Objective not found' });

        res.json({ success: true, data: result.recordset[1][0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteObjective = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        await pool.request().input('id', sql.VarChar, id).query("DELETE FROM Objectives WHERE Id = @id");
        res.json({ success: true, message: 'Objective deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete all objectives (admin only - cascade delete)
 */
exports.deleteAllObjectives = async (req, res) => {
    try {
        const pool = await getPool();
        // Delete in order: KeyResults -> Actions -> Objectives (due to FK constraints, might need to disable or handle)
        // For simplicity, just delete objectives (cascade should handle KRs)
        const result = await pool.request().query("DELETE FROM Objectives; SELECT @@ROWCOUNT as deletedCount");
        const count = result.recordset[0]?.deletedCount || 0;
        res.json({ success: true, message: `Deleted ${count} objectives`, deletedCount: count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createKeyResult = async (req, res) => {
    try {
        const { objectiveId, title, description, owner, targetValue, unit } = req.body;
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('ObjectiveId', sql.VarChar, objectiveId)
            .input('Title', sql.NVarChar, title)
            .input('Description', sql.NVarChar, description || '')
            .input('OwnerId', sql.VarChar, owner || req.user._id)
            .input('TargetValue', sql.Decimal, targetValue || 0)
            .input('Unit', sql.NVarChar, unit || '')
            .query(`
                INSERT INTO KeyResults (Id, ObjectiveId, Title, Description, OwnerId, TargetValue, Unit, CurrentValue, CreatedAt, UpdatedAt)
                VALUES (@Id, @ObjectiveId, @Title, @Description, @OwnerId, @TargetValue, @Unit, 0, GETDATE(), GETDATE())
            `);

        // Recalculate objective progress
        await recalcObjectiveProgress(objectiveId);

        const result = await pool.request().input('id', sql.VarChar, id).query("SELECT * FROM KeyResults WHERE Id = @id");
        res.status(201).json({ success: true, data: { ...result.recordset[0], _id: id } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateKeyResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, currentValue, targetValue } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (title) { updates.push(`Title = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, title); }
        if (description !== undefined) { updates.push(`Description = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, description); }
        if (currentValue !== undefined) { updates.push(`CurrentValue = @p${idx++}`); request.input(`p${idx-1}`, sql.Decimal, currentValue); }
        if (targetValue !== undefined) { updates.push(`TargetValue = @p${idx++}`); request.input(`p${idx-1}`, sql.Decimal, targetValue); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = GETDATE()');
        request.input('id', sql.VarChar, id);
        const result = await request.query(`
            UPDATE KeyResults SET ${updates.join(', ')} WHERE Id = @id;
            SELECT * FROM KeyResults WHERE Id = @id;
        `);

        if (result.recordset[1]?.length === 0) return res.status(404).json({ success: false, message: 'Key result not found' });

        const kr = result.recordset[1][0];
        // Recalculate parent objective progress
        await recalcObjectiveProgress(kr.ObjectiveId);

        res.json({ success: true, data: kr });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteKeyResult = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const krResult = await pool.request().input('id', sql.VarChar, id).query("SELECT ObjectiveId FROM KeyResults WHERE Id = @id");
        const objectiveId = krResult.recordset[0]?.ObjectiveId;

        await pool.request().input('id', sql.VarChar, id).query("DELETE FROM KeyResults WHERE Id = @id");

        if (objectiveId) await recalcObjectiveProgress(objectiveId);

        res.json({ success: true, message: 'Key result deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.syncKeyResult = async (req, res) => {
    try {
        const { id } = req.params;
        await recalcObjectiveProgress(id);
        res.json({ success: true, message: 'Synced' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Recalculate objective progress based on key results
 */
async function recalcObjectiveProgress(objectiveId) {
    const pool = await getPool();
    const krs = await pool.request()
        .input('objId', sql.VarChar, objectiveId)
        .query("SELECT CurrentValue, TargetValue FROM KeyResults WHERE ObjectiveId = @objId AND TargetValue > 0");

    if (krs.recordset.length === 0) return;

    const totalProgress = krs.recordset.reduce((sum, kr) => {
        const progress = (kr.CurrentValue / kr.TargetValue) * 100;
        return sum + Math.min(progress, 100);
    }, 0);

    const overall = Math.round(totalProgress / krs.recordset.length);

    await pool.request()
        .input('id', sql.VarChar, objectiveId)
        .input('progress', sql.Decimal(5,2), overall)
        .query("UPDATE Objectives SET Progress = @progress, UpdatedAt = GETDATE() WHERE Id = @id");
}

// Additional stubs
exports.deleteAction = async (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
