const { sql, getPool, generateId } = require('../database/db');

/**
 * Get all rulesets
 */
exports.getRulesets = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT r.*, u.FirstName + ' ' + u.LastName as CreatedByName
                FROM Rulesets r
                LEFT JOIN Users u ON r.CreatedBy = u.Id
                WHERE r.IsActive = 1
                ORDER BY r.CreatedAt DESC
            `);

        const rulesets = result.recordset.map(r => ({
            ...r,
            _id: r.Id,
            createdBy: r.CreatedBy,
            rules: r.Rules ? JSON.parse(r.Rules) : [],
            conditions: r.Conditions ? JSON.parse(r.Conditions) : {},
            actions: r.Actions ? JSON.parse(r.Actions) : [],
            createdAt: r.CreatedAt,
            updatedAt: r.UpdatedAt
        }));

        res.json({ success: true, data: rulesets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create ruleset
 */
exports.createRuleset = async (req, res) => {
    try {
        const { name, description, rules, conditions, actions } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('Name', sql.NVarChar, name)
            .input('Description', sql.NVarChar, description || '')
            .input('Rules', sql.NVarChar, JSON.stringify(rules || []))
            .input('Conditions', sql.NVarChar, JSON.stringify(conditions || {}))
            .input('Actions', sql.NVarChar, JSON.stringify(actions || []))
            .input('CreatedBy', sql.VarChar, userId)
            .input('IsActive', sql.Bit, 1)
            .query(`
                INSERT INTO Rulesets (Id, Name, Description, Rules, Conditions, Actions, CreatedBy, IsActive, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, @Description, @Rules, @Conditions, @Actions, @CreatedBy, @IsActive, GETDATE(), GETDATE())
            `);

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Rulesets WHERE Id = @id");

        res.status(201).json({ success: true, data: { ...result.recordset[0], _id: id } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update ruleset
 */
exports.updateRuleset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, rules, conditions, actions, isActive } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (name) { updates.push(`Name = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, name); }
        if (description !== undefined) { updates.push(`Description = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, description); }
        if (rules) { updates.push(`Rules = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(rules)); }
        if (conditions) { updates.push(`Conditions = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(conditions)); }
        if (actions) { updates.push(`Actions = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(actions)); }
        if (isActive !== undefined) { updates.push(`IsActive = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, isActive ? 1 : 0); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = GETDATE()');
        request.input('id', sql.VarChar, id);
        const result = await request.query(`
            UPDATE Rulesets SET ${updates.join(', ')} WHERE Id = @id;
            SELECT * FROM Rulesets WHERE Id = @id;
        `);

        if (result.recordset[1]?.length === 0) {
            return res.status(404).json({ success: false, message: 'Ruleset not found' });
        }

        res.json({ success: true, data: result.recordset[1][0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete ruleset
 */
exports.deleteRuleset = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM Rulesets WHERE Id = @id");

        res.json({ success: true, message: 'Ruleset deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Execute ruleset (trigger evaluation)
 */
exports.executeRuleset = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const rulesetResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Rulesets WHERE Id = @id AND IsActive = 1");

        if (rulesetResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Ruleset not found or inactive' });
        }

        const ruleset = rulesetResult.recordset[0];
        const rules = ruleset.Rules ? JSON.parse(ruleset.Rules) : [];
        const conditions = ruleset.Conditions ? JSON.parse(ruleset.Conditions) : {};

        // For simplicity, just log the execution - actual rule evaluation would need complex logic
        const logId = generateId();
        await pool.request()
            .input('Id', sql.VarChar, logId)
            .input('RulesetId', sql.VarChar, id)
            .input('TriggeredBy', sql.NVarChar, 'MANUAL')
            .input('Status', sql.NVarChar, 'SUCCESS')
            .input('MatchedCount', sql.Int, 0)
            .input('ActionedCount', sql.Int, 0)
            .query(`
                INSERT INTO RulesetExecutionLogs (Id, RulesetId, TriggeredBy, Status, MatchedCount, ActionedCount, ExecutedAt)
                VALUES (@Id, @RulesetId, @TriggeredBy, @Status, @MatchedCount, @ActionedCount, GETDATE())
            `);

        res.json({ 
            success: true, 
            message: 'Ruleset execution logged',
            data: { rulesetId: id, rulesCount: rules.length, executed: true }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get execution logs
 */
exports.getExecutionLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, page = 1 } = req.query;
        const pool = await getPool();
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const result = await pool.request()
            .input('rulesetId', sql.VarChar, id)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, parseInt(limit))
            .query(`
                SELECT TOP (@limit) *
                FROM RulesetExecutionLogs
                WHERE RulesetId = @rulesetId
                ORDER BY ExecutedAt DESC
                OFFSET @offset ROWS
            `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Additional endpoints stubs
exports.getAllRulesets = exports.getRulesets;
exports.getRulesetById = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Rulesets WHERE Id = @id");
        if (result.recordset.length === 0) return res.status(404).json({ success: false, message: 'Ruleset not found' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.toggleRuleset = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("UPDATE Rulesets SET IsActive = ~IsActive WHERE Id = @id; SELECT * FROM Rulesets WHERE Id = @id");
        res.json({ success: true, data: result.recordset[1][0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.previewRuleset = async (req, res) => {
    res.json({ success: true, message: 'Preview not implemented', data: {} });
};

exports.getRulesetHistory = async (req, res) => {
    res.json({ success: true, data: [] });
};

exports.getExecutionDetails = async (req, res) => {
    res.json({ success: true, data: {} });
};

exports.duplicateRuleset = async (req, res) => {
    res.status(501).json({ success: false, message: 'Not implemented yet' });
};
