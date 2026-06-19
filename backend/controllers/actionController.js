const { sql, getPool, generateId } = require('../database/db');
const { createNotification } = require('../controllers/notificationController');
const SocketService = require('../services/socketService');
const SystemLogService = require('../services/SystemLogService');
const hierarchyService = require('../services/hierarchyService');
const AIService = require('../services/AIService');
const WebhookService = require('../services/WebhookService');
const { buildInClause } = require('../utils/sqlHelpers');

// Expose getPool for route handlers
exports.getPool = getPool;

// Helper: Get ASIN title by ID
async function getAsinTitle(pool, asinId) {
    const r = await pool.request()
        .input('id', sql.VarChar, asinId)
        .query('SELECT AsinCode, Title FROM Asins WHERE Id = @id');
    return r.recordset[0];
}

// Helper: Get User name by ID
async function getUserName(pool, userId) {
    const r = await pool.request()
        .input('id', sql.VarChar, userId)
        .query('SELECT FirstName, LastName FROM Users WHERE Id = @id');
    const u = r.recordset[0];
    return u ? `${u.FirstName} ${u.LastName}` : 'Unknown';
}

// ============================================
// BULK CREATE FROM ANALYSIS
// ============================================
exports.bulkCreateFromAnalysis = async (req, res) => {
    try {
        console.log('[BULK_CREATE] User:', req.user?._id, 'Role:', req.user?.role?.name);
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const pool = await getPool();

        // Build ASIN filter
        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (req.body.asinIds && Array.isArray(req.body.asinIds) && req.body.asinIds.length > 0) {
            const ids = buildInClause(request, 'actionAsin', req.body.asinIds);
            whereClause += ` AND a.Id IN (${ids})`;
        }

        if (!isGlobalUser) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (assignedSellerIds.length === 0) {
                return res.status(403).json({ success: false, message: 'No sellers assigned to your account.' });
            }
            const sellerIds = buildInClause(request, 'sellerId', assignedSellerIds);
            whereClause += ` AND a.SellerId IN (${sellerIds})`;
        }

        // Fetch ASINs with seller info
        const asinsResult = await request
            .query(`
                SELECT a.*, s.Name as sellerName, s.Id as sellerId
                FROM Asins a
                JOIN Sellers s ON a.SellerId = s.Id
                ${whereClause}
            `);

        const asins = asinsResult.recordset;
        if (!asins || asins.length === 0) {
            return res.status(404).json({ success: false, message: 'No ASINs found to analyze.' });
        }

        console.log('[BULK_CREATE] Analyzing', asins.length, 'ASINs...');

        // Fetch settings
        const settingsResult = await pool.request().query('SELECT * FROM SystemSettings');
        const settings = {};
        settingsResult.recordset.forEach(s => { settings[s.Key] = s.Value; });

        const minLqsScore = Number(settings.minLqsScore) || 80;
        const minTitleLength = Number(settings.minTitleLength) || 100;
        const minImageCount = Number(settings.minImageCount) || 7;
        const minDescLength = Number(settings.minDescLength) || 500;

        // Group ASINs by seller and optimization type
        const bySellerType = {};
        asins.forEach(asin => {
            const sellerId = asin.sellerId || 'no-seller';
            const addToGroup = (type) => {
                const key = `${sellerId}|${type}`;
                if (!bySellerType[key]) {
                    bySellerType[key] = { type, asinIds: [], sellerId };
                }
                bySellerType[key].asinIds.push(asin.Id);
            };

            if (!asin.Title || (asin.Title && asin.Title.length < minTitleLength)) addToGroup('TITLE_OPTIMIZATION');
            if ((asin.imagesCount || 0) < minImageCount) addToGroup('IMAGE_OPTIMIZATION');
            if ((asin.LqsDetails && asin.LqsDetails.descriptionLength < minDescLength) || !asin.LqsDetails) addToGroup('DESCRIPTION_OPTIMIZATION');
            if (!asin.HasAplus) addToGroup('A_PLUS_CONTENT');
            if (asin.LQS && asin.LQS < minLqsScore) addToGroup('GENERAL_OPTIMIZATION');
        });

        const typeConfig = {
            TITLE_OPTIMIZATION: { title: 'Bulk Title Optimization', desc: (n) => `Titles are too short for ${n} ASINs.`, priority: 'HIGH', minutes: 30 },
            IMAGE_OPTIMIZATION: { title: 'Bulk Image Optimization', desc: (n) => `Add more images for ${n} ASINs (target: 7+).`, priority: 'MEDIUM', minutes: 45 },
            DESCRIPTION_OPTIMIZATION: { title: 'Bulk Description Update', desc: (n) => `Descriptions too short for ${n} ASINs.`, priority: 'MEDIUM', minutes: 40 },
            A_PLUS_CONTENT: { title: 'Bulk A+ Content Creation', desc: (n) => `No A+ Content for ${n} ASINs.`, priority: 'HIGH', minutes: 120 },
            GENERAL_OPTIMIZATION: { title: 'Bulk LQS Improvement', desc: (n) => `Low listing quality score for ${n} ASINs.`, priority: 'HIGH', minutes: 60 },
        };

        const createdActions = [];
        for (const [, group] of Object.entries(bySellerType)) {
            const cfg = typeConfig[group.type];
            if (!cfg) continue;

            const actionId = generateId();
            const asinsJson = JSON.stringify(group.asinIds);
            const timeTrackingJson = JSON.stringify({ timeLimit: cfg.minutes * group.asinIds.length });
            const autoGenJson = JSON.stringify({ isAuto: true, source: 'ASIN_ANALYSIS', confidence: 85 });

            await pool.request()
                .input('Id', sql.VarChar, actionId)
                .input('Type', sql.NVarChar, group.type)
                .input('Title', sql.NVarChar, cfg.title)
                .input('Description', sql.NVarChar, cfg.desc(group.asinIds.length))
                .input('Priority', sql.NVarChar, cfg.priority)
                .input('AsinsJson', sql.NVarChar, asinsJson)
                .input('SellerId', sql.VarChar, group.sellerId)
                .input('CreatedBy', sql.VarChar, req.user.Id || req.user._id)
                .input('AutoGenerated', sql.NVarChar, autoGenJson)
                .input('TimeTracking', sql.NVarChar, timeTrackingJson)
                .query(`
                    INSERT INTO Actions (Id, Type, Title, Description, Priority, Status, Asins, SellerId, CreatedBy, AutoGenerated, TimeTracking, CreatedAt, UpdatedAt)
                    VALUES (@Id, @Type, @Title, @Description, @Priority, 'PENDING', @AsinsJson, @SellerId, @CreatedBy, @AutoGenerated, @TimeTracking, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);

            // Fetch created action with details
            const actResult = await pool.request()
                .input('id', sql.VarChar, actionId)
                .query(`
                    SELECT a.*, u.FirstName + ' ' + u.LastName as createdByName, s.Name as sellerName
                    FROM Actions a
                    LEFT JOIN Users u ON a.CreatedBy = u.Id
                    LEFT JOIN Sellers s ON a.SellerId = s.Id
                    WHERE a.Id = @id
                `);
            createdActions.push(actResult.recordset[0]);
        }

        try { sendSseEvent('auto_created_bulk', createdActions); } catch (e) { console.warn('SSE emit failed:', e.message); }

        res.status(201).json({ success: true, data: createdActions, count: createdActions.length });
    } catch (error) {
        console.error('Error creating bulk actions:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// ============================================
// GET ALL ACTIONS
// ============================================
exports.getActions = async (req, res) => {
    try {
        const { status, priority, assignedTo, stage } = req.query;
        const pool = await getPool();
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        let whereClauses = [];

        if (status) whereClauses.push(`Status = '${status}'`);
        if (priority) whereClauses.push(`Priority = '${priority}'`);
        if (assignedTo) whereClauses.push(`AssignedTo = '${assignedTo}'`);

        // Data isolation for non-global users
        const filterReq = pool.request();
        if (!isGlobalUser) {
            const subordinateIds = await hierarchyService.getSubordinateIds(req.user.Id || req.user._id);
            const teamIds = [req.user.Id, ...subordinateIds];
            const teamList = buildInClause(filterReq, 'teamId', teamIds);
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            const sellerList = buildInClause(filterReq, 'sellerId', assignedSellerIds);

            whereClauses.push(`(
                AssignedTo IN (${teamList}) OR
                CreatedBy IN (${teamList}) OR
                (SellerId IN (${sellerList}) AND SellerId IS NOT NULL)
            )`);
        }

        const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        const actionsResult = await filterReq
            .query(`
                WITH FirstUserSeller AS (
                    SELECT SellerId, MIN(UserId) as UserId
                    FROM UserSellers
                    GROUP BY SellerId
                )
                SELECT a.*,
                       COALESCE(ua.FirstName, uas.FirstName) as assignedToFirstName,
                       COALESCE(ua.LastName, uas.LastName) as assignedToLastName,
                       COALESCE(ua.Email, uas.Email) as assignedToEmail,
                       COALESCE(a.AssignedTo, us.UserId) as resolvedAssignedTo,
                       uc.FirstName as createdByFirstName, uc.LastName as createdByLastName,
                       s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Actions a
                LEFT JOIN Users ua ON a.AssignedTo = ua.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                LEFT JOIN FirstUserSeller us ON a.SellerId = us.SellerId OR (a.SellerId IS NULL AND a.Asins IS NOT NULL AND EXISTS (
                    SELECT 1 FROM Asins asin 
                    WHERE asin.SellerId = us.SellerId 
                    AND a.Asins LIKE '%' + asin.Id + '%'
                ))
                LEFT JOIN Users uas ON us.UserId = uas.Id
                LEFT JOIN Users uc ON a.CreatedBy = uc.Id
                ${whereSql}
                ORDER BY a.CreatedAt DESC
            `);

        const actions = actionsResult.recordset.map(a => ({
            ...a,
            _id: a.Id,
            id: a.Id,
            title: a.Title || a.title,
            description: a.Description || a.description,
            status: a.Status || a.status,
            priority: a.Priority || a.priority,
            type: a.Type || a.type,
            assignedTo: (a.AssignedTo || a.resolvedAssignedTo) ? { 
                _id: a.AssignedTo || a.resolvedAssignedTo, 
                firstName: a.assignedToFirstName, 
                lastName: a.assignedToLastName, 
                email: a.assignedToEmail 
            } : null,
            createdBy: a.CreatedBy ? { _id: a.CreatedBy, firstName: a.createdByFirstName, lastName: a.createdByLastName } : null,
            sellerId: a.SellerId ? { _id: a.SellerId, name: a.sellerName, marketplace: a.sellerMarketplace } : null,
            asins: a.Asins ? JSON.parse(a.Asins || '[]') : [],
            stage: a.Stage ? JSON.parse(a.Stage || '{}') : { current: 'PENDING', history: [] },
            completion: a.Completion ? JSON.parse(a.Completion || '{}') : {},
            timeTracking: a.TimeTracking ? JSON.parse(a.TimeTracking || '{}') : {},
            recurring: a.Recurring ? JSON.parse(a.Recurring || '{}') : {},
            autoGenerated: a.AutoGenerated ? JSON.parse(a.AutoGenerated || '{}') : {}
        }));

        res.json({ success: true, data: actions });
    } catch (error) {
        console.error('GET /actions error:', error.message);
        res.status(200).json({ success: true, data: [], message: 'Database currently unavailable' });
    }
};

// ============================================
// GET ACTION BY ID
// ============================================
exports.getAction = async (req, res) => {
    try {
        const pool = await getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`
                WITH FirstUserSeller AS (
                    SELECT SellerId, MIN(UserId) as UserId
                    FROM UserSellers
                    GROUP BY SellerId
                )
                SELECT a.*,
                       COALESCE(ua.FirstName, uas.FirstName) as assignedToFirstName,
                       COALESCE(ua.LastName, uas.LastName) as assignedToLastName,
                       COALESCE(ua.Email, uas.Email) as assignedToEmail,
                       COALESCE(ua.Avatar, uas.Avatar) as assignedToAvatar,
                       COALESCE(ua.RoleId, uas.RoleId) as assignedToRole,
                       COALESCE(a.AssignedTo, us.UserId) as resolvedAssignedTo,
                       uc.FirstName as createdByFirstName, uc.LastName as createdByLastName, uc.Email as createdByEmail,
                       s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Actions a
                LEFT JOIN Users ua ON a.AssignedTo = ua.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                LEFT JOIN FirstUserSeller us ON a.SellerId = us.SellerId OR (a.SellerId IS NULL AND a.Asins IS NOT NULL AND EXISTS (
                    SELECT 1 FROM Asins asin 
                    WHERE asin.SellerId = us.SellerId 
                    AND a.Asins LIKE '%' + asin.Id + '%'
                ))
                LEFT JOIN Users uas ON us.UserId = uas.Id
                LEFT JOIN Users uc ON a.CreatedBy = uc.Id
                WHERE a.Id = @id
            `);

        if (actionResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const a = actionResult.recordset[0];
        const action = {
            ...a,
            _id: a.Id,
            assignedTo: (a.AssignedTo || a.resolvedAssignedTo) ? {
                _id: a.AssignedTo || a.resolvedAssignedTo,
                firstName: a.assignedToFirstName,
                lastName: a.assignedToLastName,
                email: a.assignedToEmail,
                avatar: a.assignedToAvatar,
                role: a.assignedToRole
            } : null,
            createdBy: a.CreatedBy ? {
                _id: a.CreatedBy,
                firstName: a.createdByFirstName,
                lastName: a.createdByLastName,
                email: a.createdByEmail
            } : null,
            sellerId: a.SellerId ? { _id: a.SellerId, name: a.sellerName, marketplace: a.sellerMarketplace } : null,
            asins: a.Asins ? JSON.parse(a.Asins || '[]').map(asinId => ({ _id: asinId })) : [],
            stage: a.Stage ? JSON.parse(a.Stage || '{}') : { current: 'PENDING', history: [] },
            completion: a.Completion ? JSON.parse(a.Completion || '{}') : {},
            timeTracking: a.TimeTracking ? JSON.parse(a.TimeTracking || '{}') : {},
            recurring: a.Recurring ? JSON.parse(a.Recurring || '{}') : {},
            autoGenerated: a.AutoGenerated ? JSON.parse(a.AutoGenerated || '{}') : {}
        };

        // Data isolation check
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            const isAssigned = action.assignedTo?._id === (req.user._id || req.user.Id).toString();
            const isCreator = action.createdBy?._id === (req.user._id || req.user.Id).toString();
            if (!isAssigned && !isCreator) {
                return res.status(403).json({ success: false, message: 'You do not have permission to view this task' });
            }
        }

        res.json({ success: true, data: action });
    } catch (error) {
        console.error('Get action error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ============================================
// CREATE ACTION
// ============================================
exports.createAction = async (req, res) => {
    try {
        const { goalSettings, ...rest } = req.body;
        const timeframe = parseInt(goalSettings?.timeframe) || 1;
        const pool = await getPool();
        const userId = req.user.Id || req.user._id;
        const createdActions = [];

        if (timeframe > 1 && goalSettings?.isGoalPrimary) {
            // Generate multiple tasks for the timeframe
            for (let i = 0; i < timeframe; i++) {
                const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
                const deadline = req.body.deadline ? new Date(req.body.deadline) : new Date();
                startDate.setMonth(startDate.getMonth() + i);
                deadline.setMonth(deadline.getMonth() + i);

                const actionId = generateId();
                const asinsJson = JSON.stringify(rest.asins || []);
                const timeTrackingJson = JSON.stringify({ startDate, deadline, timeLimit: (goalSettings?.minutes || 60) });
                const stageJson = JSON.stringify({ current: 'PENDING', history: [] });

                await pool.request()
                    .input('Id', sql.VarChar, actionId)
                    .input('Title', sql.NVarChar, `${rest.title} (Month ${i + 1}/${timeframe})`)
                    .input('Description', sql.NVarChar, rest.description || '')
                    .input('Type', sql.NVarChar, rest.type || 'TASK')
                    .input('Priority', sql.NVarChar, rest.priority || 'MEDIUM')
                    .input('Status', sql.NVarChar, 'PENDING')
                    .input('Asins', sql.NVarChar, asinsJson)
                    .input('SellerId', sql.VarChar, rest.sellerId || req.user.sellerId || null)
                    .input('AssignedTo', sql.VarChar, rest.assignedTo || null)
                    .input('CreatedBy', sql.VarChar, userId)
                    .input('DueDate', sql.DateTime2, deadline)
                    .input('Stage', sql.NVarChar, stageJson)
                    .input('TimeTracking', sql.NVarChar, timeTrackingJson)
                    .query(`
                        INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, Asins, SellerId, AssignedTo, CreatedBy, DueDate, Stage, TimeTracking, CreatedAt, UpdatedAt)
                        VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @Asins, @SellerId, @AssignedTo, @CreatedBy, @DueDate, @Stage, @TimeTracking, dbo.GetEnvDate(), dbo.GetEnvDate())
                    `);

                const actResult = await pool.request()
                    .input('id', sql.VarChar, actionId)
                    .query(`SELECT * FROM Actions WHERE Id = @id`);
                createdActions.push(actResult.recordset[0]);
            }

            await SystemLogService.log({
                type: 'CREATE',
                entityType: 'ACTION',
                entityTitle: `Goal-Based Actions: ${rest.title}`,
                user: userId,
                description: `Automatically generated ${timeframe} monthly tasks`
            });

            return res.status(201).json({ success: true, count: createdActions.length, data: createdActions[0], all: createdActions });
        } else {
            // Single action
            const actionId = generateId();
            const asinsJson = JSON.stringify(rest.asins || []);
            const timeTrackingJson = JSON.stringify({
                startDate: rest.startDate || new Date(),
                deadline: rest.deadline || null,
                timeLimit: rest.timeLimit || 60
            });
            const stageJson = JSON.stringify({ current: 'PENDING', history: [] });

            await pool.request()
                .input('Id', sql.VarChar, actionId)
                .input('Title', sql.NVarChar, rest.title)
                .input('Description', sql.NVarChar, rest.description || '')
                .input('Type', sql.NVarChar, rest.type || 'TASK')
                .input('Priority', sql.NVarChar, rest.priority || 'MEDIUM')
                .input('Status', sql.NVarChar, 'PENDING')
                .input('Asins', sql.NVarChar, asinsJson)
                .input('SellerId', sql.VarChar, rest.sellerId || req.user.sellerId || null)
                .input('AssignedTo', sql.VarChar, rest.assignedTo || null)
                .input('CreatedBy', sql.VarChar, userId)
                .input('DueDate', sql.DateTime2, rest.deadline || null)
                .input('Stage', sql.NVarChar, stageJson)
                .input('TimeTracking', sql.NVarChar, timeTrackingJson)
                .query(`
                    INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, Asins, SellerId, AssignedTo, CreatedBy, DueDate, Stage, TimeTracking, CreatedAt, UpdatedAt)
                    VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @Asins, @SellerId, @AssignedTo, @CreatedBy, @DueDate, @Stage, @TimeTracking, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);

            // Notification if assigned
            if (rest.assignedTo) {
                await createNotification(
                    rest.assignedTo,
                    'ACTION_ASSIGNED',
                    'Action',
                    actionId,
                    `You have been assigned a new action: ${rest.title}`
                );
            }

            // SSE
            const newAction = await pool.request()
                .input('id', sql.VarChar, actionId)
                .query(`SELECT * FROM Actions WHERE Id = @id`);
            try { sendSseEvent('created', newAction.recordset[0]); } catch (e) { console.warn('SSE emit failed:', e.message); }

            await SystemLogService.log({
                type: 'CREATE',
                entityType: 'ACTION',
                entityId: actionId,
                entityTitle: rest.title,
                user: userId,
                description: `Created new action: ${rest.title}`
            });

            // Pabbly / Webhook notification
            const webhookPayload = {
                id: actionId,
                title: rest.title,
                type: rest.type || 'TASK',
                priority: rest.priority || 'MEDIUM',
                status: 'PENDING',
                description: rest.description || '',
                deadline: rest.deadline || null,
                asinCount: (rest.asins || []).length,
                createdBy: { id: userId },
                dashboardUrl: `${process.env.FRONTEND_URL || 'https://data.brandcentral.in'}/tasks`,
            };
            WebhookService.fire('task.created', webhookPayload);
            if (rest.assignedTo) {
                WebhookService.fire('task.assigned', { ...webhookPayload, assignedTo: { id: rest.assignedTo } });
            }

            res.status(201).json({ success: true, data: newAction.recordset[0] });
        }
    } catch (error) {
        console.error('Error creating action:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// ============================================
// UPDATE ACTION
// ============================================
exports.updateAction = async (req, res) => {
    try {
        const pool = await getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);

        if (actionResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const action = actionResult.recordset[0];
        const userId = req.user.Id || req.user._id;
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const isCreator = action.CreatedBy === userId;
        const isAssigned = action.AssignedTo === userId;

        if (!isGlobalUser && !isCreator && !isAssigned) {
            return res.status(403).json({ success: false, message: 'You do not have permission to update this task' });
        }

        // Build dynamic update
        const updates = [];
        const request = pool.request();
        let paramIndex = 0;

        Object.entries(req.body).forEach(([key, value]) => {
            if (!['_id', 'Id', 'createdAt', 'updatedAt', 'createdBy'].includes(key)) {
                const paramName = `p${paramIndex++}`;
                let sqlValue = value;
                let sqlType = sql.NVarChar;

                if (key === 'asins' || key === 'Asins') {
                    sqlValue = JSON.stringify(value);
                    sqlType = sql.NVarChar;
                } else if (key === 'stage' || key === 'completion' || key === 'timeTracking' || key === 'recurring' || key === 'autoGenerated') {
                    sqlValue = JSON.stringify(value);
                    sqlType = sql.NVarChar;
                } else if (key === 'assignedTo' || key === 'sellerId') {
                    sqlValue = value ? (typeof value === 'object' ? value._id || value.Id || value : value) : null;
                    sqlType = sql.VarChar;
                } else {
                    sqlType = sql.NVarChar; // simplified
                }

                updates.push(`${key} = @${paramName}`);
                request.input(paramName, sqlType, sqlValue);
            }
        });

        if (updates.length > 0) {
            updates.push('UpdatedAt = dbo.GetEnvDate()');
            request.input('id', sql.VarChar, req.params.id);
            const updateSql = `UPDATE Actions SET ${updates.join(', ')} WHERE Id = @id`;
            await request.query(updateSql);
        }

        // Notify if assignment changed
        if (req.body.assignedTo && req.body.assignedTo !== req.user._id.toString()) {
            await createNotification(
                req.body.assignedTo,
                'ACTION_ASSIGNED',
                'Action',
                req.params.id,
                `You have been assigned an action: ${action.Title}`
            );
            // Pabbly webhook
            WebhookService.fire('task.assigned', {
                id: req.params.id,
                title: action.Title,
                priority: action.Priority,
                type: action.Type,
                assignedTo: { id: req.body.assignedTo },
                dashboardUrl: `${process.env.FRONTEND_URL || 'https://data.brandcentral.in'}/tasks`,
            });
        }
        // Fire task.started webhook if status changed to IN_PROGRESS
        if (req.body.status === 'IN_PROGRESS') {
            WebhookService.fire('task.started', {
                id: req.params.id,
                title: action.Title,
                priority: action.Priority,
                type: action.Type,
                startedBy: { id: userId },
                dashboardUrl: `${process.env.FRONTEND_URL || 'https://data.brandcentral.in'}/tasks`,
            });
        }
        // Fire task.completed webhook if status changed to COMPLETED
        if (req.body.status === 'COMPLETED') {
            WebhookService.fire('task.completed', {
                id: req.params.id,
                title: action.Title,
                priority: action.Priority,
                type: action.Type,
                completedBy: { id: userId },
                dashboardUrl: `${process.env.FRONTEND_URL || 'https://data.brandcentral.in'}/tasks`,
            });
        }

        // Log activity
        await SystemLogService.log({
            type: 'UPDATE',
            entityType: 'ACTION',
            entityId: req.params.id,
            entityTitle: action.Title,
            user: userId,
            description: `Updated action: ${action.Title}`
        });

        // Fetch updated action with populated data
        const updatedResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`
                SELECT a.*,
                       ua.FirstName as assignedToFirstName, ua.LastName as assignedToLastName, ua.Email as assignedToEmail,
                       uc.FirstName as createdByFirstName, uc.LastName as createdByLastName,
                       s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Actions a
                LEFT JOIN Users ua ON a.AssignedTo = ua.Id
                LEFT JOIN Users uc ON a.CreatedBy = uc.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                WHERE a.Id = @id
            `);

        const updated = updatedResult.recordset[0];
        const populatedAction = {
            ...updated,
            _id: updated.Id,
            assignedTo: updated.AssignedTo ? { _id: updated.AssignedTo, firstName: updated.assignedToFirstName, lastName: updated.assignedToLastName, email: updated.assignedToEmail } : null,
            createdBy: updated.CreatedBy ? { _id: updated.CreatedBy, firstName: updated.createdByFirstName, lastName: updated.createdByLastName } : null,
            sellerId: updated.SellerId ? { _id: updated.SellerId, name: updated.sellerName, marketplace: updated.sellerMarketplace } : null,
            asins: updated.Asins ? JSON.parse(updated.Asins || '[]') : [],
            stage: updated.Stage ? JSON.parse(updated.Stage || '{}') : { current: 'PENDING', history: [] },
            completion: updated.Completion ? JSON.parse(updated.Completion || '{}') : {},
            timeTracking: updated.TimeTracking ? JSON.parse(updated.TimeTracking || '{}') : {},
            recurring: updated.Recurring ? JSON.parse(updated.Recurring || '{}') : {},
            autoGenerated: updated.AutoGenerated ? JSON.parse(updated.AutoGenerated || '{}') : {}
        };

        try { sendSseEvent('updated', populatedAction); } catch (e) { console.warn('SSE emit failed:', e.message); }
        res.json({ success: true, data: populatedAction });
    } catch (error) {
        console.error('Update action error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete action (Admin only)
 */
exports.deleteAction = async (req, res) => {
    try {
        const pool = await getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const action = actionResult.recordset[0];

        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("DELETE FROM Actions WHERE Id = @id");

        await SystemLogService.log({
            type: 'DELETE',
            entityType: 'ACTION',
            entityId: action.Id,
            entityTitle: action.Title,
            user: req.user._id,
            description: `Deleted action: ${action.Title}`
        });

        // Pabbly webhook
        WebhookService.fire('task.deleted', {
            id: req.params.id,
            title: action.Title,
            type: action.Type,
            deletedBy: { id: req.user.Id || req.user._id },
        });

        try { sendSseEvent('deleted', { id: req.params.id }); } catch (e) { console.warn('SSE emit failed:', e.message); }

        res.json({ success: true, message: 'Action deleted' });
    } catch (error) {
        console.error('Delete action error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ============================================
// OTHER ENDPOINTS (simplified stubs for now)
// ============================================
exports.getTemplates = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM TaskTemplates ORDER BY Category, Title');
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Not yet implemented' });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const pool = await getPool();
        const id = generateId();
        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('Title', sql.NVarChar, req.body.title)
            .input('Description', sql.NVarChar, req.body.description || '')
            .input('Category', sql.NVarChar, req.body.category || 'GENERAL')
            .query(`INSERT INTO TaskTemplates (Id, Title, Description, Category, CreatedAt) VALUES (@Id, @Title, @Description, @Category, dbo.GetEnvDate())`);
        const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM TaskTemplates WHERE Id = @id');
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;
        const updates = [];
        const request = pool.request();
        let idx = 0;
        Object.entries(req.body).forEach(([k, v]) => {
            if (k !== '_id' && k !== 'id') {
                const p = `p${idx++}`;
                updates.push(`${k} = @${p}`);
                request.input(p, sql.NVarChar, v);
            }
        });
        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });
        updates.push('UpdatedAt = dbo.GetEnvDate()');
        request.input('id', sql.VarChar, id);
        await request.query(`UPDATE TaskTemplates SET ${updates.join(', ')} WHERE Id = @id`);
        const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM TaskTemplates WHERE Id = @id');
        if (!result.recordset[0]) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query('DELETE FROM TaskTemplates WHERE Id = @id');
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGoalTemplates = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM GoalTemplates ORDER BY Name');
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Not yet implemented' });
    }
};

exports.createGoalTemplate = async (req, res) => {
    try {
        const pool = await getPool();
        const id = generateId();
        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('Name', sql.NVarChar, req.body.name)
            .input('Description', sql.NVarChar, req.body.description || '')
            .input('CreatedBy', sql.VarChar, req.user.Id || req.user._id)
            .query(`INSERT INTO GoalTemplates (Id, Name, Description, CreatedBy, CreatedAt) VALUES (@Id, @Name, @Description, @CreatedBy, dbo.GetEnvDate())`);
        const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM GoalTemplates WHERE Id = @id');
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getActionInstructions = async (req, res) => {
    try {
        console.log('[DEBUG] getActionInstructions - req.params.id:', req.params.id);
        const pool = await getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query('SELECT * FROM Actions WHERE Id = @id');

        console.log('[DEBUG] getActionInstructions - found records:', actionResult.recordset.length);
        if (actionResult.recordset.length === 0) {
            console.log('[DEBUG] getActionInstructions - returning 404 for ID:', req.params.id);
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const action = actionResult.recordset[0];
        
        let instructions = '';
        try {
            // Call the AI Service to generate detailed instructions
            instructions = await AIService.generateTaskInstructions({
                title: action.Title,
                description: action.Description,
                type: action.Type
            });
        } catch (aiError) {
            console.warn('AI instruction generation failed, using fallback:', aiError.message);
            // Fallback to structured static instructions
            instructions = `
### Task Analysis
This task requires executing optimization procedures for: **${action.Title || 'Action Item'}**.
The target domain covers typical retail and listing performance parameters.

### Strategic Solution
1. **Initial Assessment**: Review existing performance metrics and ASIN histories associated with this task.
2. **Review Context**: Understand the optimization constraints: *"${action.Description || 'No description provided.'}"*
3. **Execution Plan**: 
   - Optimize listing fields (e.g. title lengths, image count, or quality descriptors) in accordance with the task type (**${action.Type || 'GENERAL_OPTIMIZATION'}**).
   - Ensure proper sync mapping with Amazon Seller Central / Ajio Vendor panel values.
4. **Verification**: Confirm changes take effect and align with our current inventory ruleset guidelines.

### Key Success Points
- Focus on accuracy during data synchronization.
- Maintain complete transaction history date-wise to ensure proper reporting analysis.
- Follow up on any low listing quality flags immediately.
            `.trim();
        }

        res.json({ success: true, data: instructions });
    } catch (error) {
        console.error('Error in getActionInstructions:', error);
        res.status(500).json({ success: false, message: 'Server error generating instructions' });
    }
};

module.exports = {
    getPool: getPool,
    bulkCreateFromAnalysis: exports.bulkCreateFromAnalysis,
    getActions: exports.getActions,
    getAction: exports.getAction,
    createAction: exports.createAction,
    updateAction: exports.updateAction,
    deleteAction: exports.deleteAction,
    getTemplates: exports.getTemplates,
    createTemplate: exports.createTemplate,
    updateTemplate: exports.updateTemplate,
    deleteTemplate: exports.deleteTemplate,
    getGoalTemplates: exports.getGoalTemplates,
    createGoalTemplate: exports.createGoalTemplate,
    // Additional endpoints
    startAction: exports.startAction,
    submitReview: exports.submitReview,
    reviewAction: exports.reviewAction,
    completeTask: exports.completeTask,
    uploadAudio: exports.uploadAudio,
    getActionHistory: exports.getActionHistory,
    getActionInstructions: exports.getActionInstructions
};
