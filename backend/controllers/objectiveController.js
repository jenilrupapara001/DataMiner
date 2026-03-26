const ObjectiveService = require('../services/ObjectiveService');
const Objective = require('../models/Objective');
const KeyResult = require('../models/KeyResult');

exports.createObjective = async (req, res) => {
    try {
        const objective = await ObjectiveService.createObjective(req.body, req.user);
        res.status(201).json(objective);
    } catch (error) {
        console.error('Error creating objective:', error);
        res.status(500).json({ message: 'Failed to create objective' });
    }
};

exports.getObjectives = async (req, res) => {
    try {
        const filter = {};
        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';

        // Refine isolation for non-admins
        if (!isAdmin) {
            const hierarchyService = require('../services/hierarchyService');
            const subordinateIds = await hierarchyService.getSubordinateIds(req.user._id);
            const teamIds = [req.user._id, ...subordinateIds];

            const Action = require('../models/Action');
            const KeyResult = require('../models/KeyResult');

            // 1. Objectives my team owns
            // 2. Objectives that have actions assigned to my team or created by my team
            const teamActions = await Action.find({
                $or: [
                    { assignedTo: { $in: teamIds } },
                    { createdBy: { $in: teamIds } }
                ]
            }).select('keyResultId');

            const teamKrIds = teamActions.map(a => a.keyResultId).filter(id => id);
            const teamKrs = await KeyResult.find({ _id: { $in: teamKrIds } }).select('objectiveId');
            const teamObjectiveIdsFromTasks = teamKrs.map(kr => kr.objectiveId).filter(id => id);

            // Fetch assigned sellers to restrict objectives by seller
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => s._id || s);

            filter.$and = [
                {
                    $or: [
                        { owners: { $in: teamIds } },
                        { _id: { $in: teamObjectiveIdsFromTasks } }
                    ]
                }
            ];

            if (assignedSellerIds.length > 0) {
                filter.$and.push({ sellerId: { $in: assignedSellerIds } });
            }
        }

        if (req.query.sellerId) filter.sellerId = req.query.sellerId;
        if (req.query.type) filter.type = req.query.type;

        const objectives = await ObjectiveService.getObjectivesHierarchy(filter, req.user);
        res.json(objectives);
    } catch (error) {
        console.error('Error fetching objectives:', error);
        res.status(200).json([]); // Return empty array to keep UI alive
    }
};

exports.createKeyResult = async (req, res) => {
    try {
        const kr = new KeyResult({
            ...req.body,
            owner: req.user._id
        });
        await kr.save();

        // Recalculate parent objective progress
        await ObjectiveService.refreshProgress(kr.objectiveId);

        res.status(201).json(kr);
    } catch (error) {
        console.error('Error creating Key Result:', error);
        res.status(500).json({ message: 'Failed to create Key Result' });
    }
};

exports.updateKeyResult = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const kr = await KeyResult.findById(id);
        if (!kr) return res.status(404).json({ message: 'Key Result not found' });

        const objective = await Objective.findById(kr.objectiveId);
        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin' && objective?.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You do not have permission to update this Key Result' });
        }

        const updatedKr = await KeyResult.findByIdAndUpdate(id, updates, { new: true });

        if (updatedKr) {
            await ObjectiveService.refreshProgress(updatedKr.objectiveId);
        }

        res.json(updatedKr);
    } catch (error) {
        console.error('Error updating Key Result:', error);
        res.status(500).json({ message: 'Failed to update Key Result' });
    }
};

exports.updateObjective = async (req, res) => {
    try {
        const { id } = req.params;

        const objective = await Objective.findById(id);
        if (!objective) return res.status(404).json({ message: 'Objective not found' });

        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin' && !objective.owners?.some(o => o.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: 'You do not have permission to update this objective' });
        }

        const updatedObjective = await ObjectiveService.updateObjective(id, req.body, req.user._id);
        res.json(updatedObjective);
    } catch (error) {
        console.error('Error updating objective:', error);
        res.status(500).json({ message: 'Failed to update objective' });
    }
};

exports.deleteObjective = async (req, res) => {
    try {
        const { id } = req.params;

        const objective = await Objective.findById(id);
        if (!objective) return res.status(404).json({ message: 'Objective not found' });

        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin' && !objective.owners?.some(o => o.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: 'You do not have permission to delete this objective' });
        }

        await ObjectiveService.deleteObjective(id, req.user._id);
        res.json({ message: 'Objective deleted successfully' });
    } catch (error) {
        console.error('Error deleting objective:', error);
        res.status(500).json({ message: 'Failed to delete objective' });
    }
};

exports.deleteKeyResult = async (req, res) => {
    try {
        const { id } = req.params;

        const kr = await KeyResult.findById(id);
        if (!kr) return res.status(404).json({ message: 'Key Result not found' });

        const objective = await Objective.findById(kr.objectiveId);
        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin' && objective?.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You do not have permission to delete this Key Result' });
        }

        await ObjectiveService.deleteKeyResult(id, req.user._id);
        res.json({ message: 'Key Result deleted successfully' });
    } catch (error) {
        console.error('Error deleting Key Result:', error);
        res.status(500).json({ message: 'Failed to delete Key Result' });
    }
};

exports.syncKeyResult = async (req, res) => {
    try {
        const { id } = req.params;
        const GoalProgressService = require('../services/GoalProgressService');
        const kr = await GoalProgressService.calculateGoalProgress(id);
        res.json({ success: true, data: kr });
    } catch (error) {
        console.error('Error syncing Key Result:', error);
        res.status(500).json({ message: error.message || 'Failed to sync Key Result' });
    }
};

exports.deleteAction = async (req, res) => {
    try {
        const { id } = req.params;
        const Action = require('../models/Action');

        const action = await Action.findById(id);
        if (!action) return res.status(404).json({ message: 'Action not found' });

        const userRole = req.user.role?.name || req.user.role;
        const isAdmin = userRole === 'admin';
        const isOwner = action.createdBy?.toString() === req.user._id.toString() ||
            action.assignedTo?.toString() === req.user._id.toString();

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'You do not have permission to delete this action' });
        }

        await Action.findByIdAndDelete(id);

        // Log activity
        try {
            const SystemLogService = require('../services/SystemLogService');
            await SystemLogService.log({
                type: 'DELETE',
                entityType: 'ACTION',
                entityId: id,
                entityTitle: action.title,
                user: req.user._id,
                description: `Deleted action: ${action.title}`
            });
        } catch (logErr) {
            console.error('[objectiveController] Log failed:', logErr);
        }

        res.json({ message: 'Action deleted successfully' });
    } catch (error) {
        console.error('Error deleting action:', error);
        res.status(500).json({ message: 'Failed to delete action' });
    }
};

// Admin: Delete ALL objectives, key results, and actions
exports.deleteAllObjectives = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        if (userRole !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const Action = require('../models/Action');

        const [objResult, krResult, actionResult] = await Promise.all([
            Objective.deleteMany({}),
            KeyResult.deleteMany({}),
            Action.deleteMany({})
        ]);

        console.log(`[Admin] Bulk deleted: ${objResult.deletedCount} objectives, ${krResult.deletedCount} KRs, ${actionResult.deletedCount} actions`);

        res.json({
            success: true,
            message: `Deleted ${objResult.deletedCount} objectives, ${krResult.deletedCount} key results, and ${actionResult.deletedCount} actions`,
            deletedCounts: {
                objectives: objResult.deletedCount,
                keyResults: krResult.deletedCount,
                actions: actionResult.deletedCount
            }
        });
    } catch (error) {
        console.error('Error deleting all objectives:', error);
        res.status(500).json({ message: 'Failed to delete all objectives' });
    }
};
