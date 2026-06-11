const { sql, getPool, generateId } = require('../database/db');

const normalizeRuleset = (r) => {
    if (!r) return null;
    return {
        _id: r.Id,
        id: r.Id,
        name: r.Name,
        description: r.Description,
        rules: r.Rules ? JSON.parse(r.Rules) : [],
        conditions: r.Conditions ? JSON.parse(r.Conditions) : {},
        actions: r.Actions ? JSON.parse(r.Actions) : [],
        createdBy: r.CreatedBy,
        createdByName: r.CreatedByName,
        isActive: r.IsActive === true || r.IsActive === 1,
        type: r.Type,
        sellerId: r.SellerId,
        usingDataFrom: r.UsingDataFrom,
        excludeDays: r.ExcludeDays,
        isAutomated: r.IsAutomated === true || r.IsAutomated === 1,
        runFrequency: r.RunFrequency,
        runTime: r.RunTime,
        scope: r.Scope ? JSON.parse(r.Scope) : { applyTo: 'all' },
        conflictResolution: r.ConflictResolution,
        emailOnRun: r.EmailOnRun === true || r.EmailOnRun === 1,
        emailOnAction: r.EmailOnAction === true || r.EmailOnAction === 1,
        emailAddress: r.EmailAddress,
        lastRunAt: r.LastRunAt,
        totalRunCount: r.TotalRunCount || 0,
        lastRunSummary: r.LastRunSummary ? JSON.parse(r.LastRunSummary) : null,
        createdAt: r.CreatedAt,
        updatedAt: r.UpdatedAt
    };
};

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
                ORDER BY r.CreatedAt DESC
            `);

        const rulesets = result.recordset.map(normalizeRuleset);
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
        const { 
            name, description, rules, conditions, actions,
            type, sellerId, usingDataFrom, excludeDays, isAutomated,
            runFrequency, runTime, scope, conflictResolution,
            emailOnRun, emailOnAction, emailAddress
        } = req.body;
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
            .input('Type', sql.VarChar, type || 'ASIN')
            .input('SellerId', sql.VarChar, sellerId || null)
            .input('UsingDataFrom', sql.VarChar, usingDataFrom || 'Last 14 days')
            .input('ExcludeDays', sql.VarChar, excludeDays || 'Latest day')
            .input('IsAutomated', sql.Bit, isAutomated ? 1 : 0)
            .input('RunFrequency', sql.VarChar, runFrequency || 'Daily')
            .input('RunTime', sql.VarChar, runTime || '08 AM')
            .input('Scope', sql.NVarChar, JSON.stringify(scope || { applyTo: 'all' }))
            .input('ConflictResolution', sql.VarChar, conflictResolution || 'first')
            .input('EmailOnRun', sql.Bit, emailOnRun ? 1 : 0)
            .input('EmailOnAction', sql.Bit, emailOnAction ? 1 : 0)
            .input('EmailAddress', sql.NVarChar, emailAddress || null)
            .query(`
                INSERT INTO Rulesets (
                    Id, Name, Description, Rules, Conditions, Actions, CreatedBy, IsActive, CreatedAt, UpdatedAt,
                    Type, SellerId, UsingDataFrom, ExcludeDays, IsAutomated, RunFrequency, RunTime, Scope,
                    ConflictResolution, EmailOnRun, EmailOnAction, EmailAddress
                )
                VALUES (
                    @Id, @Name, @Description, @Rules, @Conditions, @Actions, @CreatedBy, @IsActive, dbo.GetEnvDate(), dbo.GetEnvDate(),
                    @Type, @SellerId, @UsingDataFrom, @ExcludeDays, @IsAutomated, @RunFrequency, @RunTime, @Scope,
                    @ConflictResolution, @EmailOnRun, @EmailOnAction, @EmailAddress
                )
            `);

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Rulesets WHERE Id = @id");

        const r = result.recordset[0];
        const ruleset = normalizeRuleset(r);

        res.status(201).json({ success: true, data: ruleset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRuleset = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, description, rules, conditions, actions, isActive,
            type, sellerId, usingDataFrom, excludeDays, isAutomated,
            runFrequency, runTime, scope, conflictResolution,
            emailOnRun, emailOnAction, emailAddress
        } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (name !== undefined) { updates.push(`Name = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, name); }
        if (description !== undefined) { updates.push(`Description = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, description); }
        if (rules !== undefined) { updates.push(`Rules = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(rules)); }
        if (conditions !== undefined) { updates.push(`Conditions = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(conditions)); }
        if (actions !== undefined) { updates.push(`Actions = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(actions)); }
        if (isActive !== undefined) { updates.push(`IsActive = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, isActive ? 1 : 0); }
        if (type !== undefined) { updates.push(`Type = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, type); }
        if (sellerId !== undefined) { updates.push(`SellerId = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, sellerId); }
        if (usingDataFrom !== undefined) { updates.push(`UsingDataFrom = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, usingDataFrom); }
        if (excludeDays !== undefined) { updates.push(`ExcludeDays = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, excludeDays); }
        if (isAutomated !== undefined) { updates.push(`IsAutomated = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, isAutomated ? 1 : 0); }
        if (runFrequency !== undefined) { updates.push(`RunFrequency = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, runFrequency); }
        if (runTime !== undefined) { updates.push(`RunTime = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, runTime); }
        if (scope !== undefined) { updates.push(`Scope = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(scope)); }
        if (conflictResolution !== undefined) { updates.push(`ConflictResolution = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, conflictResolution); }
        if (emailOnRun !== undefined) { updates.push(`EmailOnRun = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, emailOnRun ? 1 : 0); }
        if (emailOnAction !== undefined) { updates.push(`EmailOnAction = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, emailOnAction ? 1 : 0); }
        if (emailAddress !== undefined) { updates.push(`EmailAddress = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, emailAddress); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = dbo.GetEnvDate()');
        request.input('id', sql.VarChar, id);
        const result = await request.query(`
            UPDATE Rulesets SET ${updates.join(', ')} WHERE Id = @id;
            SELECT * FROM Rulesets WHERE Id = @id;
        `);

        const records = result.recordsets && result.recordsets.length > 1 
            ? result.recordsets[1] 
            : result.recordset;

        const r = records && records[0];
        if (!r) {
            return res.status(404).json({ success: false, message: 'Ruleset not found' });
        }

        const ruleset = normalizeRuleset(r);
        res.json({ success: true, data: ruleset });
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
        const { selectedAsins } = req.body;
        const { evaluateRuleset } = require('../services/rulesetEngineService');

        const result = await evaluateRuleset(id, {
            selectedAsins,
            triggeredBy: 'manual'
        });

        res.json({ 
            success: true, 
            message: 'Ruleset executed successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Execute all active rulesets for selected ASINs
 */
exports.executeAllRulesetsForAsins = async (req, res) => {
    try {
        const { selectedAsins } = req.body;
        if (!selectedAsins || !Array.isArray(selectedAsins) || selectedAsins.length === 0) {
            return res.status(400).json({ success: false, message: 'No ASINs specified' });
        }

        const pool = await getPool();
        const activeRulesetsResult = await pool.request()
            .query("SELECT Id, Name FROM Rulesets WHERE IsActive = 1");

        const rulesets = activeRulesetsResult.recordset;
        const results = [];

        const { evaluateRuleset } = require('../services/rulesetEngineService');

        for (const ruleset of rulesets) {
            try {
                const runResult = await evaluateRuleset(ruleset.Id, {
                    selectedAsins,
                    triggeredBy: 'manual'
                });
                results.push({
                    rulesetId: ruleset.Id,
                    name: ruleset.Name,
                    success: true,
                    summary: runResult.summary
                });
            } catch (err) {
                results.push({
                    rulesetId: ruleset.Id,
                    name: ruleset.Name,
                    success: false,
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            message: `Evaluated ${rulesets.length} active rulesets on ${selectedAsins.length} ASINs`,
            data: results
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
        const r = result.recordset[0];
        if (!r) return res.status(404).json({ success: false, message: 'Ruleset not found' });
        
        const ruleset = normalizeRuleset(r);
        res.json({ success: true, data: ruleset });
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
        
        const records = result.recordsets && result.recordsets.length > 1 
            ? result.recordsets[1] 
            : result.recordset;

        const r = records && records[0];
        if (!r) {
            return res.status(404).json({ success: false, message: 'Ruleset not found' });
        }

        res.json({ success: true, data: normalizeRuleset(r) });
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
    try {
        const { id } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const getResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Rulesets WHERE Id = @id");

        if (getResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Ruleset not found' });
        }

        const orig = getResult.recordset[0];
        const newId = generateId();

        await pool.request()
            .input('Id', sql.VarChar, newId)
            .input('Name', sql.NVarChar, `${orig.Name} (Copy)`)
            .input('Description', sql.NVarChar, orig.Description || '')
            .input('Rules', sql.NVarChar, orig.Rules)
            .input('Conditions', sql.NVarChar, orig.Conditions)
            .input('Actions', sql.NVarChar, orig.Actions)
            .input('CreatedBy', sql.VarChar, userId)
            .input('IsActive', sql.Bit, 1)
            .input('Type', sql.VarChar, orig.Type)
            .input('SellerId', sql.VarChar, orig.SellerId)
            .input('UsingDataFrom', sql.VarChar, orig.UsingDataFrom)
            .input('ExcludeDays', sql.VarChar, orig.ExcludeDays)
            .input('IsAutomated', sql.Bit, 0)
            .input('RunFrequency', sql.VarChar, orig.RunFrequency)
            .input('RunTime', sql.VarChar, orig.RunTime)
            .input('Scope', sql.NVarChar, orig.Scope)
            .input('ConflictResolution', sql.VarChar, orig.ConflictResolution)
            .input('EmailOnRun', sql.Bit, orig.EmailOnRun)
            .input('EmailOnAction', sql.Bit, orig.EmailOnAction)
            .input('EmailAddress', sql.NVarChar, orig.EmailAddress)
            .query(`
                INSERT INTO Rulesets (
                    Id, Name, Description, Rules, Conditions, Actions, CreatedBy, IsActive, CreatedAt, UpdatedAt,
                    Type, SellerId, UsingDataFrom, ExcludeDays, IsAutomated, RunFrequency, RunTime, Scope,
                    ConflictResolution, EmailOnRun, EmailOnAction, EmailAddress
                )
                VALUES (
                    @Id, @Name, @Description, @Rules, @Conditions, @Actions, @CreatedBy, @IsActive, dbo.GetEnvDate(), dbo.GetEnvDate(),
                    @Type, @SellerId, @UsingDataFrom, @ExcludeDays, @IsAutomated, @RunFrequency, @RunTime, @Scope,
                    @ConflictResolution, @EmailOnRun, @EmailOnAction, @EmailAddress
                )
            `);

        const newResult = await pool.request()
            .input('newId', sql.VarChar, newId)
            .query("SELECT * FROM Rulesets WHERE Id = @newId");

        const r = newResult.recordset[0];
        const duplicatedRuleset = normalizeRuleset(r);

        res.status(201).json({ success: true, data: duplicatedRuleset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
