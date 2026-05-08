const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Action = require('../models/Action');
const Asin = require('../models/Asin');
const TaskTemplate = require('../models/TaskTemplate');
const SystemSetting = require('../models/SystemSetting');
const { authenticate: protect, requireAnyPermission, requireRole } = require('../middleware/auth');
const { createNotification } = require('../controllers/notificationController');

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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /webm|mp3|wav|m4a|ogg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only audio files are allowed'));
    }
});

// --- Simple SSE (Server-Sent Events) clients list for realtime updates ---
const sseClients = [];

function sendSseEvent(eventName, data) {
    const payload = `data: ${JSON.stringify({ event: eventName, data })}\n\n`;
    sseClients.forEach(res => {
        try {
            res.write(payload);
        } catch (e) {
            // ignore write errors; cleanup happens on 'close'
        }
    });
}

// Bulk create categorized actions from analysis for all ASINs
router.post('/bulk-create-from-analysis', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        console.log('[BULK_CREATE] User:', req.user?._id, req.user?.email, 'Role:', req.user?.role?.name);

        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';

        // Build ASIN filter: admins see all, others see only their assigned sellers
        const filter = {};
        if (!isAdmin) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => s._id || s);
            if (assignedSellerIds.length === 0) {
                return res.status(403).json({ success: false, message: 'No sellers assigned to your account.' });
            }
            filter.seller = { $in: assignedSellerIds };
        }

        const asins = await Asin.find(filter).populate('seller', '_id name').lean();
        if (!asins || asins.length === 0) {
            return res.status(404).json({ success: false, message: 'No ASINs found to analyze.' });
        }

        console.log('[BULK_CREATE] Analyzing', asins.length, 'ASINs...');

        // Fetch settings for dynamic thresholds
        const settingsDocs = await SystemSetting.find().lean();
        const settings = {};
        settingsDocs.forEach(s => { settings[s.key] = s.value; });

        const minLqsScore = Number(settings.minLqsScore) || 80;
        const minTitleLength = Number(settings.minTitleLength) || 100;
        const minImageCount = Number(settings.minImageCount) || 7;
        const minDescLength = Number(settings.minDescLength) || 500;

        // Group ASINs by seller and optimization type
        const bySellerType = {}; // key: `${sellerId}|${type}`

        asins.forEach(asin => {
            const sellerId = asin.seller?._id?.toString() || asin.seller?.toString() || 'no-seller';
            const sellerObjectId = asin.seller?._id || asin.seller;

            const addToGroup = (type) => {
                const key = `${sellerId}|${type}`;
                if (!bySellerType[key]) {
                    bySellerType[key] = { type, asinIds: [], sellerId: sellerObjectId };
                }
                bySellerType[key].asinIds.push(asin._id);
            };

            if (!asin.title || asin.title.length < minTitleLength) addToGroup('TITLE_OPTIMIZATION');
            if ((asin.imagesCount || 0) < minImageCount) addToGroup('IMAGE_OPTIMIZATION');
            if ((asin.descLength || 0) < minDescLength) addToGroup('DESCRIPTION_OPTIMIZATION');
            if (!asin.hasAplus) addToGroup('A_PLUS_CONTENT');
            if (asin.lqs && asin.lqs < minLqsScore) addToGroup('GENERAL_OPTIMIZATION');
        });

        const typeConfig = {
            TITLE_OPTIMIZATION: { title: 'Bulk Title Optimization', desc: (n) => `Titles are too short for ${n} ASINs.`, priority: 'HIGH', minutes: 30 },
            IMAGE_OPTIMIZATION: { title: 'Bulk Image Optimization', desc: (n) => `Add more images for ${n} ASINs (target: 7+).`, priority: 'MEDIUM', minutes: 45 },
            DESCRIPTION_OPTIMIZATION: { title: 'Bulk Description Update', desc: (n) => `Descriptions too short for ${n} ASINs.`, priority: 'MEDIUM', minutes: 40 },
            A_PLUS_CONTENT: { title: 'Bulk A+ Content Creation', desc: (n) => `No A+ Content for ${n} ASINs.`, priority: 'HIGH', minutes: 120 },
            GENERAL_OPTIMIZATION: { title: 'Bulk LQS Improvement', desc: (n) => `Low listing quality score for ${n} ASINs.`, priority: 'HIGH', minutes: 60 },
        };

        const suggestedActions = [];

        for (const [, group] of Object.entries(bySellerType)) {
            const cfg = typeConfig[group.type];
            if (!cfg) continue;
            const n = group.asinIds.length;
            const actionDoc = {
                type: group.type,
                title: cfg.title,
                description: cfg.desc(n),
                priority: cfg.priority,
                asins: group.asinIds,
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', confidence: 85 },
                timeTracking: { timeLimit: cfg.minutes * n }
            };
            // Only assign sellerId if one exists (not for admins viewing all sellers)
            if (group.sellerId && group.sellerId !== 'no-seller') {
                actionDoc.sellerId = group.sellerId;
            }
            suggestedActions.push(actionDoc);
        }

        if (suggestedActions.length === 0) {
            return res.status(200).json({ success: true, message: 'All ASINs look good! No optimization actions needed.', data: [], count: 0 });
        }

        const createdActions = await Action.insertMany(suggestedActions);
        try { sendSseEvent('auto_created_bulk', createdActions); } catch (e) { console.error('SSE notify failed', e); }

        res.status(201).json({
            success: true,
            data: createdActions,
            count: createdActions.length
        });
    } catch (error) {
        console.error('Error creating bulk actions from analysis:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message, stack: error.stack });
    }
});

// Get all actions (filtered by user/role permissions potentially)
router.get('/', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const { status, priority, assignedTo, stage } = req.query;
        const filter = {};

        // Enforce data isolation for non-admins
        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin') {
            const hierarchyService = require('../services/hierarchyService');
            const subordinateIds = await hierarchyService.getSubordinateIds(req.user._id);
            const teamIds = [req.user._id, ...subordinateIds];

            filter.$or = [
                { assignedTo: { $in: teamIds } },
                { createdBy: { $in: teamIds } }
            ];

            // Also keep seller filter if applicable
            if (req.user.sellerId) {
                filter.sellerId = req.user.sellerId;
            }
        }

        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (stage) filter['stage.current'] = stage;

        const actions = await Action.find(filter)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName')
            .populate('asins', 'asinCode title')
            .populate('sellerId', 'name marketplace')
            .populate('completion.completedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json({ success: true, data: actions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all task templates
router.get('/templates', protect, async (req, res) => {
    try {
        const templates = await TaskTemplate.find({}).sort({ category: 1, title: 1 });
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('[ActionRoutes] Failed to fetch templates:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create task template
router.post('/templates', protect, requireAnyPermission(['actions_manage']), async (req, res) => {
    try {
        const template = await TaskTemplate.create(req.body);
        res.status(201).json({ success: true, data: template });
    } catch (error) {
        console.error('[ActionRoutes] Failed to create template:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Update task template
router.put('/templates/:id', protect, requireAnyPermission(['actions_manage']), async (req, res) => {
    try {
        const template = await TaskTemplate.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, data: template });
    } catch (error) {
        console.error('[ActionRoutes] Failed to update template:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Delete task template
router.delete('/templates/:id', protect, requireAnyPermission(['actions_manage']), async (req, res) => {
    try {
        const template = await TaskTemplate.findByIdAndDelete(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error('[ActionRoutes] Failed to delete template:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// SSE stream for realtime action updates
router.get('/stream', protect, async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    // Send initial ping
    res.write('data: "connected"\n\n');

    sseClients.push(res);

    req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
    });
});

// Get action by ID
router.get('/:id', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName')
            .populate('asins')
            .populate('sellerId')
            .populate('completion.completedBy', 'firstName lastName');

        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        // Data isolation: non-admins can only see tasks they are assigned to or created
        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin') {
            const isAssigned = action.assignedTo?.toString() === req.user._id.toString() ||
                (action.assignedTo?._id && action.assignedTo._id.toString() === req.user._id.toString());
            const isCreator = action.createdBy?.toString() === req.user._id.toString() ||
                (action.createdBy?._id && action.createdBy._id.toString() === req.user._id.toString());

            if (!isAssigned && !isCreator) {
                return res.status(403).json({ success: false, message: 'You do not have permission to view this task' });
            }
        }

        res.json({ success: true, data: action });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

const { sendTaskAssignmentEmail } = require('../services/emailService');

// Create action
router.post('/', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const actionData = {
            ...req.body,
            createdBy: req.user._id,
            sellerId: req.user.sellerId // Add sellerId from user
        };
        const action = await Action.create(actionData);

        // Notify SSE clients
        try { sendSseEvent('created', action); } catch (e) { console.error('SSE notify failed', e); }

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'CREATE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `Created new action: ${action.title}`
        });

        // Send email if assigned
        if (action.assignedTo) {
            try {
                const User = require('../models/User'); // Import dynamically to avoid circular dependency
                const assignee = await User.findById(action.assignedTo);

                // Trigger Notification
                await createNotification(
                    action.assignedTo,
                    'ACTION_ASSIGNED',
                    'Action',
                    action._id,
                    `You have been assigned a new action: ${action.title}`
                );

                if (assignee && assignee.email) {
                    await sendTaskAssignmentEmail(assignee, action);
                }
            } catch (e) {
                console.error('Failed to send assignment/notification:', e);
            }
        }

        res.status(201).json({ success: true, data: action });
    } catch (error) {
        console.error('Error creating action:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Update action
router.put('/:id', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        // Check permissions: Admin, Creator, or Assigned User
        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';
        const isCreator = action.createdBy?.toString() === req.user._id.toString();
        const isAssigned = action.assignedTo?.toString() === req.user._id.toString();

        if (!isAdmin && !isCreator && !isAssigned) {
            return res.status(403).json({ success: false, message: 'You do not have permission to update this task' });
        }

        const updatedAction = await Action.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'UPDATE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `Updated action details and/or status: ${action.title}`
        });

        // Check if assignment changed (logic requires fetching old action first, but for now we'll notify if assignedTo is present in body)
        if (req.body.assignedTo && req.body.assignedTo !== req.user._id.toString()) {
            await createNotification(
                req.body.assignedTo,
                'ACTION_ASSIGNED',
                'Action',
                action._id,
                `You have been assigned an action: ${action.title}`
            );
        }

        await action.populate('assignedTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('asins', 'asinCode title')
            .populate('sellerId', 'name marketplace');

        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        // Notify SSE clients
        try { sendSseEvent('updated', action); } catch (e) { console.error('SSE notify failed', e); }

        res.json({ success: true, data: action });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Start action
router.post('/:id/start', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

        // Check permissions: Admin or Assigned User
        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';
        const isAssigned = action.assignedTo?.toString() === req.user._id.toString();

        if (!isAdmin && !isAssigned) {
            return res.status(403).json({ success: false, message: 'Only the assigned user or an administrator can start this task' });
        }

        action.startTask();
        await action.save();

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `Started action: ${action.title}`
        });

        const populated = await Action.findById(action._id)
            .populate('assignedTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('asins', 'asinCode title')
            .populate('sellerId', 'name marketplace');

        try { sendSseEvent('updated', populated); } catch (e) { }
        res.json({ success: true, data: populated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit action for review
router.post('/:id/submit-review', protect, upload.single('audio'), requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

        // Check permissions: Admin or Assigned User
        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';
        const isAssigned = action.assignedTo?.toString() === req.user._id.toString();

        if (!isAdmin && !isAssigned) {
            return res.status(403).json({ success: false, message: 'Only the assigned user or an administrator can submit this task for review' });
        }

        const submissionData = {
            remarks: req.body.remarks,
            submittedBy: req.user._id,
            audioUrl: req.file ? `/uploads/audio/${req.file.filename}` : undefined,
            audioTranscript: req.body.audioTranscript
        };

        action.submitForReview(submissionData);
        await action.save();

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `Submitted action for review: ${action.title}`
        });

        // Notify creator (Manager)
        await createNotification(
            action.createdBy,
            'ACTION_ASSIGNED', // Reusing type or creating new?
            'Action',
            action._id,
            `Action ready for review: ${action.title}`
        );

        const populated = await Action.findById(action._id)
            .populate('assignedTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('asins', 'asinCode title');

        try { sendSseEvent('updated', populated); } catch (e) { }
        res.json({ success: true, data: populated });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Review action (Manager only)
router.post('/:id/review-action', protect, requireRole('admin'), async (req, res) => {
    try {
        const { decision, comments } = req.body;
        const action = await Action.findById(req.params.id);
        if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

        action.reviewTask(req.user._id, decision, comments);
        await action.save();

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `${decision === 'APPROVE' ? 'Approved' : 'Rejected'} action: ${action.title}`
        });

        // Notify assignee
        if (action.assignedTo) {
            await createNotification(
                action.assignedTo,
                decision === 'REJECT' ? 'ALERT' : 'ACTION_ASSIGNED',
                'Action',
                action._id,
                decision === 'REJECT'
                    ? `❌ TASK REJECTED: ${action.title}. Please review feedback and restart.`
                    : `✅ TASK APPROVED: ${action.title}`
            );
        }

        const populated = await Action.findById(action._id)
            .populate('assignedTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('asins', 'asinCode title')
            .populate('sellerId', 'name marketplace');

        try { sendSseEvent('updated', populated); } catch (e) { }
        res.json({ success: true, data: populated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Legacy Delete action (already exists below)
router.delete('/:id', protect, requireAnyPermission(['actions_delete', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        await Action.findByIdAndDelete(req.params.id);

        // Log activity
        const SystemLogService = require('../services/SystemLogService');
        await SystemLogService.log({
            type: 'DELETE',
            entityType: 'ACTION',
            entityId: action._id,
            entityTitle: action.title,
            user: req.user._id,
            description: `Deleted action: ${action.title}`
        });

        // Delete associated audio file if exists
        if (action.completion?.audioUrl) {
            try {
                await fs.unlink(action.completion.audioUrl);
            } catch (e) {
                console.error('Failed to delete audio file:', e);
            }
        }

        // Notify SSE clients
        try { sendSseEvent('deleted', { id: req.params.id }); } catch (e) { console.error('SSE notify failed', e); }

        res.json({ success: true, message: 'Action deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Bulk delete ALL actions (admin only - for cleanup)
router.delete('/bulk-delete-all', protect, requireRole('admin'), async (req, res) => {
    try {
        const result = await Action.deleteMany({});
        console.log(`[Admin] Bulk deleted ${result.deletedCount} actions`);

        try { sendSseEvent('bulk_deleted', { count: result.deletedCount }); } catch (e) { }

        res.json({ success: true, message: `Deleted ${result.deletedCount} actions`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error bulk deleting actions:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Bulk create actions
router.post('/bulk', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const actionsData = req.body.map(a => ({ ...a, createdBy: req.user._id }));
        const createdActions = await Action.insertMany(actionsData);

        // Notify SSE clients
        try { sendSseEvent('bulk_created', createdActions); } catch (e) { console.error('SSE notify failed', e); }

        res.status(201).json({ success: true, data: createdActions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================================
// NEW WORKFLOW ENDPOINTS
// ============================================================================

// Start task
router.post('/:id/start', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        action.startTask();
        await action.save();

        const populatedAction = await Action.findById(action._id)
            .populate('assignedTo', 'firstName lastName')
            .populate('asins', 'asinCode title');

        // Notify SSE clients
        try { sendSseEvent('task_started', populatedAction); } catch (e) { console.error('SSE notify failed', e); }

        res.json({ success: true, data: populatedAction });
    } catch (error) {
        console.error('Error starting task:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Complete task
router.post('/:id/complete', protect, requireAnyPermission(['actions_edit', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const completionData = {
            ...req.body,
            completedBy: req.user._id
        };

        if (typeof action.completeTask !== 'function') {
            throw new Error('Internal Model Error: completeTask method missing');
        }

        action.completeTask(completionData);

        await action.save();

        // If recurring is enabled, create next occurrence
        if (action.recurring?.enabled && action.recurring.nextOccurrence) {
            const nextAction = await Action.createRecurringInstance(action);
            await nextAction.save();
        }

        const populatedAction = await Action.findById(action._id)
            .populate('assignedTo', 'firstName lastName')
            .populate('asins', 'asinCode title')
            .populate('completion.completedBy', 'firstName lastName');

        // Notify SSE clients
        try {
            sendSseEvent('task_completed', populatedAction);
        } catch (e) {
            console.error('Error sending SSE event:', e);
        }

        res.status(200).json({ success: true, data: populatedAction });
    } catch (error) {
        console.error('[DEBUG] Error completing task:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Upload audio for completion
router.post('/:id/upload-audio', protect, requireAnyPermission(['actions_edit', 'actions_manage']), upload.single('audio'), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No audio file provided' });
        }

        // Update action with audio URL
        action.completion = action.completion || {};
        action.completion.audioUrl = req.file.path;

        // If transcript is provided in the request body, save it
        if (req.body.transcript) {
            action.completion.audioTranscript = req.body.transcript;
        }

        await action.save();

        res.json({
            success: true,
            data: {
                audioUrl: req.file.path,
                filename: req.file.filename
            }
        });
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Get action history (stage transitions)
router.get('/:id/history', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const action = await Action.findById(req.params.id);
        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        res.json({
            success: true,
            data: {
                stageHistory: action.stage?.history || [],
                timeTracking: action.timeTracking,
                completion: action.completion
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Analyze ASIN and create suggested actions
router.post('/analyze-asin/:asinId', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const asin = await Asin.findById(req.params.asinId);
        if (!asin) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        const suggestedActions = [];

        // Title optimization check
        if (!asin.title || asin.title.length < 100) {
            suggestedActions.push({
                type: 'TITLE_OPTIMIZATION',
                title: `Optimize title for ${asin.asinCode}`,
                description: 'Title is too short or missing. Optimize with relevant keywords.',
                priority: 'HIGH',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { currentTitleLength: asin.title?.length || 0 },
                    confidence: 85
                },
                timeTracking: { timeLimit: 30 }
            });
        }

        // Image optimization check
        if (!asin.imageCount || asin.imageCount < 7) {
            suggestedActions.push({
                type: 'IMAGE_OPTIMIZATION',
                title: `Add more images for ${asin.asinCode}`,
                description: `Current images: ${asin.imageCount || 0}. Add high-quality images (target: 7+).`,
                priority: 'MEDIUM',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { currentImageCount: asin.imageCount || 0 },
                    confidence: 90
                },
                timeTracking: { timeLimit: 45 }
            });
        }

        // Description optimization check
        if (!asin.descLength || asin.descLength < 500) {
            suggestedActions.push({
                type: 'DESCRIPTION_OPTIMIZATION',
                title: `Improve description for ${asin.asinCode}`,
                description: 'Description is too short. Add detailed product information.',
                priority: 'MEDIUM',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { currentDescLength: asin.descLength || 0 },
                    confidence: 80
                },
                timeTracking: { timeLimit: 40 }
            });
        }

        // A+ Content check
        if (!asin.hasAplus) {
            suggestedActions.push({
                type: 'A_PLUS_CONTENT',
                title: `Create A+ Content for ${asin.asinCode}`,
                description: 'No A+ Content detected. Create enhanced brand content.',
                priority: 'HIGH',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { hasAplus: false },
                    confidence: 95
                },
                timeTracking: { timeLimit: 120 }
            });
        }

        // Pricing strategy check (if price is too low or too high compared to category average)
        if (asin.currentPrice && (asin.currentPrice < 10 || asin.currentPrice > 100)) {
            suggestedActions.push({
                type: 'PRICING_STRATEGY',
                title: `Review pricing for ${asin.asinCode}`,
                description: `Current price: $${asin.currentPrice}. Review pricing strategy.`,
                priority: 'MEDIUM',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { currentPrice: asin.currentPrice },
                    confidence: 70
                },
                timeTracking: { timeLimit: 20 }
            });
        }

        // LQS score check
        if (asin.lqs && asin.lqs < 70) {
            suggestedActions.push({
                type: 'GENERAL_OPTIMIZATION',
                title: `Improve LQS score for ${asin.asinCode}`,
                description: `Current LQS: ${asin.lqs}. Focus on overall listing quality.`,
                priority: 'HIGH',
                asin: asin._id,
                createdBy: req.user._id,
                autoGenerated: {
                    isAuto: true,
                    source: 'ASIN_ANALYSIS',
                    analysisData: { currentLQS: asin.lqs },
                    confidence: 85
                },
                timeTracking: { timeLimit: 60 }
            });
        }

        res.json({
            success: true,
            data: {
                asin: asin.asinCode,
                suggestedActions,
                count: suggestedActions.length
            }
        });
    } catch (error) {
        console.error('Error analyzing ASIN:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Create actions from ASIN analysis
router.post('/create-from-analysis/:asinId', protect, requireAnyPermission(['actions_create', 'actions_manage']), async (req, res) => {
    try {
        const asin = await Asin.findById(req.params.asinId);
        if (!asin) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        // Fetch dynamic thresholds from settings (with defaults)
        const settingsDocs = await SystemSetting.find().lean();
        const settings = {};
        settingsDocs.forEach(s => { settings[s.key] = s.value; });

        const minLqsScore = Number(settings.minLqsScore) || 80;
        const minTitleLen = Number(settings.minTitleLength) || 100;
        const minImages = Number(settings.minImageCount) || 7;
        const minDescLen = Number(settings.minDescLength) || 500;

        const suggestedActions = [];

        // LQS check (most important)
        if (asin.lqs && asin.lqs < minLqsScore) {
            suggestedActions.push({
                type: 'GENERAL_OPTIMIZATION',
                title: `Improve LQS for ${asin.asinCode}`,
                description: `Current LQS is ${asin.lqs} (target: ${minLqsScore}+). Work on title, images, description, and A+ content.`,
                priority: 'HIGH',
                asins: [asin._id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { lqs: asin.lqs }, confidence: 90 },
                timeTracking: { timeLimit: 60 }
            });
        }

        // Title check
        if (!asin.title || asin.title.length < minTitleLen) {
            suggestedActions.push({
                type: 'TITLE_OPTIMIZATION',
                title: `Optimize title for ${asin.asinCode}`,
                description: `Title is ${asin.title?.length || 0} chars (target: ${minTitleLen}+). Add relevant keywords.`,
                priority: 'HIGH',
                asins: [asin._id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { currentTitleLength: asin.title?.length || 0 }, confidence: 85 },
                timeTracking: { timeLimit: 30 }
            });
        }

        // Image check
        if ((asin.imagesCount || 0) < minImages) {
            suggestedActions.push({
                type: 'IMAGE_OPTIMIZATION',
                title: `Add more images for ${asin.asinCode}`,
                description: `Current images: ${asin.imagesCount || 0} (target: ${minImages}+). Add high-quality product images.`,
                priority: 'MEDIUM',
                asins: [asin._id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { currentImageCount: asin.imagesCount || 0 }, confidence: 90 },
                timeTracking: { timeLimit: 45 }
            });
        }

        // Description check
        if ((asin.descLength || 0) < minDescLen) {
            suggestedActions.push({
                type: 'DESCRIPTION_OPTIMIZATION',
                title: `Update description for ${asin.asinCode}`,
                description: `Description is ${asin.descLength || 0} chars (target: ${minDescLen}+). Add detailed product information.`,
                priority: 'MEDIUM',
                asins: [asin._id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', analysisData: { currentDescLength: asin.descLength || 0 }, confidence: 85 },
                timeTracking: { timeLimit: 40 }
            });
        }

        // A+ content check
        if (!asin.hasAplus) {
            suggestedActions.push({
                type: 'A_PLUS_CONTENT',
                title: `Create A+ Content for ${asin.asinCode}`,
                description: 'No A+ Content detected. Create enhanced brand content to improve conversion.',
                priority: 'HIGH',
                asins: [asin._id],
                createdBy: req.user._id,
                autoGenerated: { isAuto: true, source: 'ASIN_ANALYSIS', confidence: 80 },
                timeTracking: { timeLimit: 120 }
            });
        }

        if (suggestedActions.length === 0) {
            return res.status(200).json({ success: true, message: `${asin.asinCode} looks great! No optimization actions needed.`, data: [], count: 0 });
        }

        // Set sellerId only if it exists on the ASIN
        if (asin.seller) {
            suggestedActions.forEach(a => { a.sellerId = asin.seller; });
        }

        const createdActions = await Action.insertMany(suggestedActions);
        try { sendSseEvent('auto_created', createdActions); } catch (e) { /* ignore */ }

        res.status(201).json({ success: true, data: createdActions, count: createdActions.length });
    } catch (error) {
        console.error('Error creating actions from analysis:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get overdue actions
router.get('/reports/overdue', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const overdueActions = await Action.find({
            'timeTracking.isOverdue': true,
            status: { $ne: 'COMPLETED' }
        })
            .populate('assignedTo', 'firstName lastName email')
            .populate('asins', 'asinCode title')
            .sort({ 'timeTracking.startedAt': 1 });

        res.json({ success: true, data: overdueActions, count: overdueActions.length });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get actions grouped by stage
router.get('/reports/by-stage', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        const stages = await Action.aggregate([
            {
                $group: {
                    _id: '$stage.current',
                    count: { $sum: 1 },
                    actions: { $push: '$$ROOT' }
                }
            }
        ]);

        res.json({ success: true, data: stages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Goal Achievement Analysis Report
router.get('/reports/goal-achievement', protect, requireAnyPermission(['actions_view', 'actions_manage']), async (req, res) => {
    try {
        // Fetch all completed actions with time tracking
        const actions = await Action.find({
            status: 'COMPLETED',
            'timeTracking.startedAt': { $exists: true },
            'timeTracking.completedAt': { $exists: true }
        }).populate('assignedTo', 'firstName lastName');

        const metrics = actions.map(a => {
            const start = new Date(a.timeTracking.startedAt);
            const end = new Date(a.timeTracking.completedAt);
            const plannedStart = a.timeTracking.startDate ? new Date(a.timeTracking.startDate) : null;
            const plannedEnd = a.timeTracking.deadline ? new Date(a.timeTracking.deadline) : null;

            const actualDuration = Math.round((end - start) / (1000 * 60 * 60)); // hours
            const plannedDuration = (plannedEnd && plannedStart) ? Math.round((plannedEnd - plannedStart) / (1000 * 60 * 60)) : null;

            return {
                id: a._id,
                title: a.title,
                assignee: a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : 'Unassigned',
                actualDuration,
                plannedDuration,
                isOverdue: a.timeTracking.isOverdue,
                startedAt: a.timeTracking.startedAt,
                completedAt: a.timeTracking.completedAt,
                variance: plannedDuration ? actualDuration - plannedDuration : null
            };
        });

        // Summary Statistics
        const summary = {
            totalCompleted: actions.length,
            onTime: actions.filter(a => !a.timeTracking.isOverdue).length,
            overdue: actions.filter(a => a.timeTracking.isOverdue).length,
            avgDuration: metrics.length ? Math.round(metrics.reduce((acc, m) => acc + m.actualDuration, 0) / metrics.length) : 0
        };

        res.json({ success: true, data: { metrics, summary } });
    } catch (error) {
        console.error('Goal achievement report error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add message to action
router.post('/:id/messages', protect, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: 'Message content is required' });
        }

        const action = await Action.findById(req.params.id);

        if (!action) {
            return res.status(404).json({ success: false, message: 'Action not found' });
        }

        const newMessage = {
            sender: req.user._id,
            content,
            createdAt: new Date()
        };

        // Parse content for mentions (format: @Username) and create notifications
        // Note: This is a simple regex. For ID-based mentions, client sends @Name, we need to map names to IDs or client should send IDs.
        // Assuming client sends plain text for now, we'll implement a basic name lookup or rely on ID if client sends specialized format.
        // BETTER APPROACH: Client sends plain text. We scan for User objects passed to this context? 
        // For now, let's just look for user mentions if we can match names, OR strictly if we had IDs.
        // Alternative: The ActionChat component sends specific mention metadata.
        // SIMPLIFICATION: If content contains @User, we try to find that user.

        // Regex to find @names
        const mentionRegex = /@(\w+)/g;
        let match;
        const User = require('../models/User');

        while ((match = mentionRegex.exec(content)) !== null) {
            const mentionedName = match[1];
            // Case-insensitive search for user
            const mentionedUser = await User.findOne({
                $or: [
                    { firstName: { $regex: new RegExp('^' + mentionedName + '$', 'i') } },
                    { name: { $regex: new RegExp('^' + mentionedName + '$', 'i') } }
                ]
            });

            if (mentionedUser && mentionedUser._id.toString() !== req.user._id.toString()) {
                // 1. Create Notification
                await createNotification(
                    mentionedUser._id,
                    'CHAT_MENTION',
                    'Action',
                    action._id,
                    `${req.user.firstName || 'A user'} mentioned you in action: ${action.title}`
                );

                // 2. Create Direct Message (Cross-post)
                const Message = require('../models/Message');
                const directMessageContent = `Mentioned you in task #[${action.title}](task: ${action._id}) [Status: ${action.status}]: \n\n"${content}"`;

                const directMessage = await Message.create({
                    sender: req.user._id,
                    recipient: mentionedUser._id,
                    content: directMessageContent,
                    actionId: action._id,
                    read: false
                });

                // 3. Emit Socket event for the direct message
                const io = req.app.get('io');
                if (io) {
                    const populatedDirectMessage = await Message.findById(directMessage._id)
                        .populate('sender', 'firstName lastName avatar')
                        .populate('recipient', 'firstName lastName avatar');

                    io.to(mentionedUser._id.toString()).emit('private-message', populatedDirectMessage);
                }
            }
        }

        action.messages = action.messages || [];
        action.messages.push(newMessage);
        await action.save();

        // Populate sender details for the response
        await action.populate('messages.sender', 'name email firstName lastName role');

        const savedMessage = action.messages[action.messages.length - 1];

        // Notify Socket.io clients about the update
        const io = req.app.get('io');
        if (io) {
            io.emit(`action - message - ${action._id}`, savedMessage);
            // Also notify that the action was updated
            io.emit('action_updated', action);
        }

        // Keep SSE for backward compatibility if needed, or remove it
        try { sendSseEvent('updated', action); } catch (e) { console.error('SSE notify failed', e); }

        res.status(201).json({ success: true, data: savedMessage });
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

module.exports = router;
