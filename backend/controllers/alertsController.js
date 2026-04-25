const { sql, getPool, generateId } = require('../database/db');
const { createNotification } = require('../controllers/notificationController');

/**
 * Get alerts for current user
 */
exports.getAlerts = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const roleName = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const pool = await getPool();

        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (!isGlobalUser) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (assignedSellerIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
            whereClause += ` AND SellerId IN (${assignedSellerIds.map(id => `'${id}'`).join(',')})`;
        }

        const result = await request.query(`
            SELECT a.*, r.Name as RuleName, r.Type as RuleType,
                   asin.AsinCode, asin.Title as AsinTitle,
                   s.Name as SellerName
            FROM Alerts a
            LEFT JOIN AlertRules r ON a.RuleId = r.Id
            LEFT JOIN Asins asin ON a.AsinId = asin.Id
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ${whereClause}
            ORDER BY a.CreatedAt DESC
        `);

        const alerts = result.recordset.map(a => ({
            ...a,
            _id: a.Id,
            ruleId: a.RuleId,
            rule: a.RuleId ? { _id: a.RuleId, name: a.RuleName, type: a.RuleType } : null,
            asin: a.AsinId ? { _id: a.AsinId, asinCode: a.AsinCode, title: a.AsinTitle } : null,
            seller: a.SellerId ? { _id: a.SellerId, name: a.SellerName } : null,
            createdAt: a.CreatedAt,
            acknowledged: Boolean(a.Acknowledged),
            acknowledgedBy: a.AcknowledgedBy,
            acknowledgedAt: a.AcknowledgedAt
        }));

        res.json({ success: true, data: alerts });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get alert rules
 */
exports.getAlertRules = async (req, res) => {
    try {
        const roleName = req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const pool = await getPool();

        let whereClause = isGlobalUser ? '' : "WHERE (SellerId IS NULL OR SellerId NOT LIKE '%') OR SellerId IN (SELECT SellerId FROM UserSellers WHERE UserId = @userId)";
        const request = pool.request();
        if (!isGlobalUser) {
            request.input('userId', sql.VarChar, req.user.Id || req.user._id);
        }

        const result = await request.query(`
            SELECT ar.*, u.FirstName + ' ' + u.LastName as CreatedByName, s.Name as SellerName
            FROM AlertRules ar
            LEFT JOIN Users u ON ar.CreatedBy = u.Id
            LEFT JOIN Sellers s ON ar.SellerId = s.Id
            ${whereClause}
            ORDER BY ar.CreatedAt DESC
        `);

        const rules = result.recordset.map(r => ({
            ...r,
            _id: r.Id,
            creator: r.CreatedBy,
            createdAt: r.CreatedAt,
            updatedAt: r.UpdatedAt,
            condition: r.Condition ? JSON.parse(r.Condition) : {},
            actions: r.Actions ? JSON.parse(r.Actions) : []
        }));

        res.json({ success: true, data: rules });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create alert rule
 */
exports.createAlertRule = async (req, res) => {
    try {
        const { name, type, condition, actions, sellerId } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('Name', sql.NVarChar, name)
            .input('Type', sql.NVarChar, type)
            .input('Condition', sql.NVarChar, JSON.stringify(condition || {}))
            .input('Actions', sql.NVarChar, JSON.stringify(actions || []))
            .input('SellerId', sql.VarChar, sellerId || null)
            .input('IsActive', sql.Bit, 1)
            .input('CreatedBy', sql.VarChar, userId)
            .query(`
                INSERT INTO AlertRules (Id, Name, Type, Condition, Actions, SellerId, IsActive, CreatedBy, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, @Type, @Condition, @Actions, @SellerId, @IsActive, @CreatedBy, GETDATE(), GETDATE())
            `);

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM AlertRules WHERE Id = @id");

        const rule = result.recordset[0];
        res.status(201).json({
            success: true,
            data: { ...rule, _id: rule.Id, createdAt: rule.CreatedAt, updatedAt: rule.UpdatedAt }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update alert rule
 */
exports.updateAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, condition, actions, sellerId, isActive } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (name) { updates.push(`Name = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, name); }
        if (type) { updates.push(`Type = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, type); }
        if (condition) { updates.push(`Condition = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(condition)); }
        if (actions) { updates.push(`Actions = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(actions)); }
        if (sellerId !== undefined) { updates.push(`SellerId = @p${idx++}`); request.input(`p${idx-1}`, sql.VarChar, sellerId || null); }
        if (isActive !== undefined) { updates.push(`IsActive = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, isActive ? 1 : 0); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = GETDATE()');
        request.input('id', sql.VarChar, id);
        const result = await request.query(`
            UPDATE AlertRules SET ${updates.join(', ')} WHERE Id = @id;
            SELECT * FROM AlertRules WHERE Id = @id;
        `);

        if (result.recordset[1]?.length === 0) {
            return res.status(404).json({ success: false, message: 'Rule not found' });
        }

        const rule = result.recordset[1][0];
        res.json({ success: true, data: { ...rule, _id: rule.Id } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete alert rule
 */
exports.deleteAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM AlertRules WHERE Id = @id");

        res.json({ success: true, message: 'Alert rule deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Acknowledge alert
 */
exports.acknowledgeAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { acknowledgedBy } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        // Check if alert belongs to user's sellers (if not admin)
        const roleName = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

        if (!isGlobalUser) {
            const alertResult = await pool.request()
                .input('id', sql.VarChar, id)
                .query("SELECT SellerId FROM Alerts WHERE Id = @id");

            if (alertResult.recordset.length === 0) return res.status(404).json({ error: 'Alert not found' });

            const sellerId = alertResult.recordset[0].SellerId;
            const assignedSellers = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (!assignedSellers.includes(sellerId)) {
                return res.status(403).json({ error: 'Unauthorized to acknowledge this alert' });
            }
        }

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('ackBy', sql.NVarChar, acknowledgedBy || req.user.name || 'unknown')
            .query(`
                UPDATE Alerts 
                SET Acknowledged = 1, AcknowledgedBy = @ackBy, AcknowledgedAt = GETDATE()
                WHERE Id = @id
            `);

        res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Acknowledge all alerts
 */
exports.acknowledgeAllAlerts = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const roleName = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const pool = await getPool();

        let updateSql = "UPDATE Alerts SET Acknowledged = 1, AcknowledgedBy = @ackBy, AcknowledgedAt = GETDATE() WHERE Acknowledged = 0";
        const request = pool.request().input('ackBy', sql.NVarChar, req.user.name || 'unknown');

        if (!isGlobalUser) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (assignedSellerIds.length === 0) return res.json({ success: true, count: 0 });
            updateSql += ` AND SellerId IN (${assignedSellerIds.map(id => `'${id}'`).join(',')})`;
        }

        const result = await request.query(updateSql);
        const count = result.rowsAffected[0];

        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get unread alert count
 */
exports.getUnreadAlertCount = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const roleName = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const pool = await getPool();

        let whereClause = 'WHERE Acknowledged = 0';
        const request = pool.request();

        if (!isGlobalUser) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (assignedSellerIds.length === 0) return res.json({ success: true, count: 0 });
            whereClause += ` AND SellerId IN (${assignedSellerIds.map(id => `'${id}'`).join(',')})`;
        }

        const result = await request.query(`SELECT COUNT(*) as count FROM Alerts ${whereClause}`);
        res.json({ success: true, count: result.recordset[0].count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create an alert (internal use)
 */
exports.createAlert = async (alertData) => {
    try {
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('SellerId', sql.VarChar, alertData.sellerId)
            .input('AsinId', sql.VarChar, alertData.asinId || null)
            .input('Type', sql.NVarChar, alertData.type)
            .input('Severity', sql.NVarChar, alertData.severity || 'MEDIUM')
            .input('Title', sql.NVarChar, alertData.title)
            .input('Message', sql.NVarChar, alertData.message)
            .input('RuleId', sql.VarChar, alertData.ruleId || null)
            .query(`
                INSERT INTO Alerts (Id, SellerId, AsinId, Type, Severity, Title, Message, RuleId, CreatedAt)
                VALUES (@Id, @SellerId, @AsinId, @Type, @Severity, @Title, @Message, @RuleId, GETDATE())
            `);

        // Notify users?
        if (alertData.recipients) {
            for (const recipientId of alertData.recipients) {
                await createNotification(
                    recipientId,
                    'ALERT',
                    'Alert',
                    id,
                    `Alert: ${alertData.title}`
                );
            }
        }

        return { id, ...alertData };
    } catch (error) {
        console.error('Error creating alert:', error.message);
        throw error;
    }
};

// Stub for rule execution functions (would need ruleExecutionController conversion)
exports.executeRule = async (req, res) => res.json({ success: true, message: 'Not implemented' });
exports.executeAllRules = async (req, res) => res.json({ success: true, message: 'Not implemented' });
exports.toggleAlertRule = async (req, res) => res.json({ success: true, message: 'Not implemented' });
exports.getAlertRuleById = async (req, res) => res.json({ success: true, message: 'Not implemented' });
