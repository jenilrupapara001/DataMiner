const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const actionController = require('../controllers/actionController');
const { authenticate: protect, requireAnyPermission, requireRole } = require('../middleware/auth');
const { createNotification } = require('../controllers/notificationController');
const SystemLogService = require('../services/SystemLogService');

// Configure multer for audio file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/audio');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `action-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /webm|mp3|wav|m4a|ogg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only audio files are allowed'));
    }
});

// --- Simple SSE clients list ---
const sseClients = [];

function sendSseEvent(eventName, data) {
    const payload = `data: ${JSON.stringify({ event: eventName, data })}\n\n`;
    sseClients.forEach(res => {
        try { res.write(payload); } catch (e) {}
    });
}

// Action routes
router.get('/', protect, requireAnyPermission(['actions_view', 'actions_manage']), actionController.getActions);
router.get('/:id', protect, actionController.getAction);
router.post('/', protect, requireAnyPermission(['actions_create', 'actions_manage']), actionController.createAction);
router.put('/:id', protect, actionController.updateAction);
router.delete('/:id', protect, requireRole('admin'), actionController.deleteAction);

// Task Templates
router.get('/templates', protect, actionController.getTemplates);
router.post('/templates', protect, requireAnyPermission(['actions_manage']), actionController.createTemplate);
router.put('/templates/:id', protect, requireAnyPermission(['actions_manage']), actionController.updateTemplate);
router.delete('/templates/:id', protect, requireAnyPermission(['actions_manage']), actionController.deleteTemplate);

// Goal Templates
router.get('/goal-templates', protect, actionController.getGoalTemplates);
router.post('/goal-templates', protect, requireAnyPermission(['actions_manage']), actionController.createGoalTemplate);

// Bulk creation from analysis
router.post('/bulk-create-from-analysis', protect, requireAnyPermission(['actions_create', 'actions_manage']), actionController.bulkCreateFromAnalysis);
router.post('/bulk', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const actionsData = req.body.map(a => ({ ...a, createdBy: req.user._id }));
        const result = await actionController.createAction(req, res);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// SSE stream
router.get('/stream', protect, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    res.write('data: "connected"\n\n');
    sseClients.push(res);
    req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
    });
});

// Bulk delete all (admin only)
router.delete('/bulk-delete-all', protect, requireRole('admin'), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const result = await pool.request().query("DELETE FROM Actions; SELECT @@ROWCOUNT as deletedCount");
        const count = result.recordset[0]?.deletedCount || 0;
        try { sendSseEvent('bulk_deleted', { count }); } catch (e) {}
        res.json({ success: true, message: `Deleted ${count} actions`, deletedCount: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Workflow endpoints
router.post('/:id/start', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id AND Status != 'COMPLETED'");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const userId = req.user.Id || req.user._id;
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const isAssigned = action.AssignedTo === userId;

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, message: 'Only the assigned user or an administrator can start this task' });
        }

        const stageHistory = action.Stage ? JSON.parse(action.Stage) : { current: 'PENDING', history: [] };
        stageHistory.history = stageHistory.history || [];
        stageHistory.history.push({ from: stageHistory.current, to: 'IN_PROGRESS', changedBy: userId, changedAt: new Date() });
        stageHistory.current = 'IN_PROGRESS';

        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
            .input('TimeTracking', sql.NVarChar, JSON.stringify({ ...JSON.parse(action.TimeTracking || '{}'), startedAt: new Date() }))
            .query(`UPDATE Actions SET Stage = @Stage, TimeTracking = @TimeTracking, UpdatedAt = GETDATE() WHERE Id = @id`);

        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: req.params.id,
            entityTitle: action.Title,
            user: userId,
            description: `Started action: ${action.Title}`
        });

        const updated = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);
        try { sendSseEvent('updated', updated.recordset[0]); } catch (e) {}
        res.json({ success: true, data: updated.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/submit-review', protect, requireAnyPermission(['actions_edit', 'actions_manage']), upload.single('audio'), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const userId = req.user.Id || req.user._id;
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const isAssigned = action.AssignedTo === userId;

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, message: 'Only the assigned user or an administrator can submit this task for review' });
        }

        const completion = {
            remarks: req.body.remarks,
            audioUrl: req.file ? `/uploads/audio/${req.file.filename}` : null,
            audioTranscript: req.body.audioTranscript || null,
            completedBy: userId,
            completedAt: new Date()
        };

        const stageHistory = action.Stage ? JSON.parse(action.Stage) : { current: 'PENDING', history: [] };
        stageHistory.history = stageHistory.history || [];
        stageHistory.history.push({ from: stageHistory.current, to: 'SUBMITTED', changedBy: userId, changedAt: new Date() });
        stageHistory.current = 'SUBMITTED';

        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .input('Completion', sql.NVarChar, JSON.stringify(completion))
            .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
            .input('Status', sql.NVarChar, 'COMPLETED')
            .query(`UPDATE Actions SET Completion = @Completion, Stage = @Stage, Status = @Status, UpdatedAt = GETDATE() WHERE Id = @id`);

        // Goal recalculation if linked
        if (action.KeyResultId) {
            try {
                const GoalProgressService = require('../services/GoalProgressService');
                await GoalProgressService.calculateGoalProgress(action.KeyResultId);
            } catch (err) {
                console.error('[Growth-Engine] Goal Sync failed:', err);
            }
        }

        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: action.Id,
            entityTitle: action.Title,
            user: userId,
            description: `Submitted action for review: ${action.Title}`
        });

        // Notify creator
        if (action.CreatedBy) {
            await createNotification(
                action.CreatedBy,
                'ACTION_ASSIGNED',
                'Action',
                action.Id,
                `Action ready for review: ${action.Title}`
            );
        }

        const updated = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);
        try { sendSseEvent('updated', updated.recordset[0]); } catch (e) {}
        res.json({ success: true, data: updated.recordset[0] });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/review-action', protect, requireRole('admin', 'operational_manager'), async (req, res) => {
    try {
        const { decision, comments } = req.body;
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const userId = req.user.Id || req.user._id;

        const stageHistory = action.Stage ? JSON.parse(action.Stage) : { current: 'PENDING', history: [] };
        stageHistory.history = stageHistory.history || [];

        if (decision === 'APPROVE') {
            stageHistory.history.push({ from: stageHistory.current, to: 'COMPLETED', changedBy: userId, changedAt: new Date(), comment: comments });
            stageHistory.current = 'COMPLETED';

            // Recurring action: create next occurrence
            if (action.Recurring && JSON.parse(action.Recurring).enabled) {
                // Logic for creating recurring instance would go here
            }

            await pool.request()
                .input('id', sql.VarChar, req.params.id)
                .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
                .input('Status', sql.NVarChar, 'COMPLETED')
                .query(`UPDATE Actions SET Stage = @Stage, Status = @Status, UpdatedAt = GETDATE() WHERE Id = @id`);

            // Goal progress update if linked
            if (action.KeyResultId) {
                try {
                    const GoalProgressService = require('../services/GoalProgressService');
                    await GoalProgressService.calculateGoalProgress(action.KeyResultId);
                } catch (err) { console.error('[Growth-Engine] Goal Sync failed:', err); }
            }
        } else {
            stageHistory.history.push({ from: stageHistory.current, to: 'PENDING', changedBy: userId, changedAt: new Date(), comment: comments });
            stageHistory.current = 'PENDING';
            await pool.request()
                .input('id', sql.VarChar, req.params.id)
                .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
                .query(`UPDATE Actions SET Stage = @Stage, Status = 'PENDING', UpdatedAt = GETDATE() WHERE Id = @id`);
        }

        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: action.Id,
            entityTitle: action.Title,
            user: userId,
            description: `${decision === 'APPROVE' ? 'Approved' : 'Rejected'} action: ${action.Title}`
        });

        if (action.AssignedTo) {
            await createNotification(
                action.AssignedTo,
                decision === 'REJECT' ? 'ALERT' : 'ACTION_ASSIGNED',
                'Action',
                action.Id,
                decision === 'REJECT'
                    ? `❌ TASK REJECTED: ${action.Title}. Please review feedback and restart.`
                    : `✅ TASK APPROVED: ${action.Title}`
            );
        }

        const updated = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);
        try { sendSseEvent('updated', updated.recordset[0]); } catch (e) {}
        res.json({ success: true, data: updated.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
    try {
        const pool = await actionController.getPool();
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

        try { sendSseEvent('deleted', { id: req.params.id }); } catch (e) {}
        res.json({ success: true, message: 'Action deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// ANALYSIS ENDPOINTS
// ============================================

router.post('/analyze-asin/:asinId', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    // Uses asinController logic pattern - query ASIN from DB and analyze
    try {
        const pool = await actionController.getPool();
        const asinResult = await pool.request()
            .input('id', sql.VarChar, req.params.asinId)
            .query(`
                SELECT a.*, s.Id as sellerId
                FROM Asins a
                JOIN Sellers s ON a.SellerId = s.Id
                WHERE a.Id = @id
            `);

        if (asinResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'ASIN not found' });

        const asin = asinResult.recordset[0];
        const suggestedActions = [];

        // LQS check
        if (asin.LQS && asin.LQS < 70) {
            suggestedActions.push({
                type: 'GENERAL_OPTIMIZATION',
                title: `Improve LQS for ${asin.AsinCode}`,
                description: `Current LQS: ${asin.LQS}. Focus on overall listing quality.`,
                priority: 'HIGH',
                asin: asin.Id,
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { currentLQS: asin.LQS }, confidence: 85 },
                timeTracking: { timeLimit: 60 }
            });
        }

        // Title check
        if (!asin.Title || asin.Title.length < 100) {
            suggestedActions.push({
                type: 'TITLE_OPTIMIZATION',
                title: `Optimize title for ${asin.AsinCode}`,
                description: `Title is ${asin.Title?.length || 0} chars (target: 100+).`,
                priority: 'HIGH',
                asin: asin.Id,
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { currentTitleLength: asin.Title?.length || 0 }, confidence: 85 },
                timeTracking: { timeLimit: 30 }
            });
        }

        // ...additional checks similar

        res.json({ success: true, data: { asin: asin.AsinCode, suggestedActions, count: suggestedActions.length } });
    } catch (error) {
        console.error('Error analyzing ASIN:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/create-from-analysis/:asinId', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const asinResult = await pool.request()
            .input('id', sql.VarChar, req.params.asinId)
            .query(`SELECT * FROM Asins WHERE Id = @id`);

        if (asinResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'ASIN not found' });

        const asin = asinResult.recordset[0];
        const settingsResult = await pool.request().query('SELECT * FROM SystemSettings');
        const settings = {}; settingsResult.recordset.forEach(s => settings[s.Key] = s.Value);
        const minLqsScore = Number(settings.minLqsScore) || 80;
        const minTitleLen = Number(settings.minTitleLength) || 100;
        const minImages = Number(settings.minImageCount) || 7;
        const minDescLen = Number(settings.minDescLength) || 500;

        const suggestedActions = [];

        if (asin.LQS && asin.LQS < minLqsScore) {
            suggestedActions.push({
                type: 'GENERAL_OPTIMIZATION',
                title: `Improve LQS for ${asin.AsinCode}`,
                description: `Current LQS is ${asin.LQS} (target: ${minLqsScore}+).`,
                priority: 'HIGH',
                asins: [asin.Id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { lqs: asin.LQS }, confidence: 90 },
                timeTracking: { timeLimit: 60 }
            });
        }

        // Other checks...

        if (suggestedActions.length === 0) {
            return res.status(200).json({ success: true, message: `${asin.AsinCode} looks great!`, data: [], count: 0 });
        }

        const createdActions = [];
        for (const actionData of suggestedActions) {
            const id = generateId();
            await pool.request()
                .input('Id', sql.VarChar, id)
                .input('Title', sql.NVarChar, actionData.title)
                .input('Description', sql.NVarChar, actionData.description)
                .input('Type', sql.NVarChar, actionData.type)
                .input('Priority', sql.NVarChar, actionData.priority)
                .input('Status', sql.NVarChar, 'PENDING')
                .input('Asins', sql.NVarChar, JSON.stringify(actionData.asins))
                .input('SellerId', sql.VarChar, asin.SellerId)
                .input('CreatedBy', sql.VarChar, req.user._id)
                .input('AutoGenerated', sql.NVarChar, JSON.stringify(actionData.autoGenerated))
                .input('TimeTracking', sql.NVarChar, JSON.stringify(actionData.timeTracking))
                .query(`
                    INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, Asins, SellerId, CreatedBy, AutoGenerated, TimeTracking, CreatedAt, UpdatedAt)
                    VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @Asins, @SellerId, @CreatedBy, @AutoGenerated, @TimeTracking, GETDATE(), GETDATE())
                `);
            createdActions.push(await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM Actions WHERE Id = @id'));
        }

        try { sendSseEvent('auto_created', createdActions); } catch (e) {}
        res.status(201).json({ success: true, data: createdActions, count: createdActions.length });
    } catch (error) {
        console.error('Error creating actions:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Remaining endpoints (completeTask, uploadAudio, etc.) would follow similar pattern
// For now, we'll add basic implementations

router.post('/:id/complete', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const userId = req.user.Id || req.user._id;

        const completion = {
            remarks: req.body.remarks,
            completedBy: userId,
            completedAt: new Date()
        };

        const stageHistory = action.Stage ? JSON.parse(action.Stage) : { current: 'PENDING', history: [] };
        stageHistory.current = 'COMPLETED';
        stageHistory.history.push({ from: 'IN_PROGRESS', to: 'COMPLETED', changedBy: userId, changedAt: new Date() });

        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .input('Completion', sql.NVarChar, JSON.stringify(completion))
            .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
            .input('Status', sql.NVarChar, 'COMPLETED')
            .query(`UPDATE Actions SET Completion = @Completion, Stage = @Stage, Status = @Status, UpdatedAt = GETDATE() WHERE Id = @id`);

        if (action.Recurring && JSON.parse(action.Recurring).enabled) {
            // Create next occurrence logic
        }

        const updated = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);

        try { sendSseEvent('task_completed', updated.recordset[0]); } catch (e) {}
        res.json({ success: true, data: updated.recordset[0] });
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/upload-audio', protect, requireAnyPermission(['actions_edit', 'actions_manage']), upload.single('audio'), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT * FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const completion = action.Completion ? JSON.parse(action.Completion) : {};
        completion.audioUrl = `/uploads/audio/${req.file.filename}`;
        if (req.body.transcript) completion.audioTranscript = req.body.transcript;

        await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .input('Completion', sql.NVarChar, JSON.stringify(completion))
            .query(`UPDATE Actions SET Completion = @Completion, UpdatedAt = GETDATE() WHERE Id = @id`);

        res.json({ success: true, data: { audioUrl: completion.audioUrl, filename: req.file.filename } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Additional endpoints (history, reports) would be implemented similarly
// For now, return basic structure

router.get('/:id/history', protect, async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const actionResult = await pool.request()
            .input('id', sql.VarChar, req.params.id)
            .query("SELECT Stage, TimeTracking, Completion FROM Actions WHERE Id = @id");

        if (actionResult.recordset.length === 0) return res.status(404).json({ success: false, message: 'Action not found' });

        const action = actionResult.recordset[0];
        const stage = action.Stage ? JSON.parse(action.Stage) : { current: 'PENDING', history: [] };
        const timeTracking = action.TimeTracking ? JSON.parse(action.TimeTracking) : {};
        const completion = action.Completion ? JSON.parse(action.Completion) : {};

        res.json({ success: true, data: { stageHistory: stage.history || [], timeTracking, completion } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Overdue actions
router.get('/reports/overdue', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const result = await pool.request()
            .query(`
                SELECT a.*, ua.FirstName, ua.LastName, ua.Email
                FROM Actions a
                LEFT JOIN Users ua ON a.AssignedTo = ua.Id
                WHERE a.Status != 'COMPLETED'
                  AND a.DueDate IS NOT NULL
                  AND a.DueDate < GETDATE()
            `);

        const actions = result.recordset.map(a => ({
            ...a,
            _id: a.Id,
            assignedTo: a.AssignedTo ? { _id: a.AssignedTo, firstName: a.FirstName, lastName: a.LastName, email: a.Email } : null,
            asins: a.Asins ? JSON.parse(a.Asins || '[]') : []
        }));

        res.json({ success: true, data: actions, count: actions.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// By-stage report
router.get('/reports/by-stage', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const pool = await actionController.getPool();
        const result = await pool.request()
            .query(`
                SELECT ISNULL(JSON_VALUE(Stage, '$.current'), 'PENDING') as stage, COUNT(*) as count
                FROM Actions
                GROUP BY JSON_VALUE(Stage, '$.current')
            `);

        const stages = result.recordset.map(r => ({
            _id: r.stage,
            count: r.count,
            actions: []
        }));

        res.json({ success: true, data: stages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
