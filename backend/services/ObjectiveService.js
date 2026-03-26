const Objective = require('../models/Objective');
const KeyResult = require('../models/KeyResult');
const Action = require('../models/Action');

class ObjectiveService {

    /**
     * Create a new Objective.
     * If type is MONTHLY, it can optionally generate 4 Weekly Key Results/Sub-Objectives.
     */
    async createObjective(data, user) {
        const { title, type, startDate, endDate, sellerId, autoGenerateWeekly } = data;

        // Support owners array; fall back to creating user
        const owners = data.owners && data.owners.length > 0
            ? data.owners
            : [user._id];

        const objective = new Objective({
            ...data,
            owners,
            createdBy: user._id,
            status: 'NOT_STARTED'
        });

        // Ensure dates are actual Date objects
        if (startDate) objective.startDate = new Date(startDate);
        if (endDate) objective.endDate = new Date(endDate);

        await objective.save();

        // System Log
        try {
            const SystemLogService = require('./SystemLogService');
            await SystemLogService.log({
                type: 'CREATE',
                entityType: 'OBJECTIVE',
                entityId: objective._id,
                entityTitle: objective.title,
                user: user._id,
                description: `Created new objective: ${objective.title}`
            });
        } catch (err) {
            console.error('[ObjectiveService] Logging failed:', err);
        }

        if (type === 'MONTHLY' && autoGenerateWeekly) {
            await this.generateWeeklyBreakdown(objective, user);
        }

        return objective;
    }

    /**
     * Automatically generate 4 Weekly Key Results for a Monthly Objective.
     */
    async generateWeeklyBreakdown(parentObjective, user) {
        const start = new Date(parentObjective.startDate);
        const end = new Date(parentObjective.endDate);

        // Create 4 Weekly KRs
        const weeks = [1, 2, 3, 4];
        const promises = weeks.map(async (weekNum) => {
            const weekStart = new Date(start);
            weekStart.setDate(start.getDate() + (weekNum - 1) * 7);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            // Cap at month end
            const actualEnd = weekEnd > end ? end : weekEnd;

            const kr = new KeyResult({
                title: `Week ${weekNum}: Execution Phase`,
                objectiveId: parentObjective._id,
                metric: 'Tasks Completed',
                targetValue: 100, // Default percentage
                currentValue: 0,
                unit: '%',
                owner: user._id,
                status: 'NOT_STARTED'
            });

            const savedKR = await kr.save();

            // Create default tasks for this week
            const tasks = [
                { title: `Week ${weekNum} Planning`, type: 'GENERAL_OPTIMIZATION', priority: 'HIGH' },
                { title: `Week ${weekNum} Execution`, type: 'GENERAL_OPTIMIZATION', priority: 'MEDIUM' },
                { title: `Week ${weekNum} Review`, type: 'REVIEW_MANAGEMENT', priority: 'MEDIUM' }
            ];

            const taskPromises = tasks.map(t => {
                return new Action({
                    title: t.title,
                    type: t.type,
                    description: `Auto-generated task for Week ${weekNum}`,
                    priority: t.priority,
                    status: 'PENDING',
                    createdBy: user._id,
                    assignedTo: user._id,
                    asin: null, // General task
                    keyResultId: savedKR._id,
                    sellerId: parentObjective.sellerId,
                    timeTracking: {
                        deadline: weekEnd // Set deadline to end of that week
                    }
                }).save();
            });

            return Promise.all(taskPromises);
        });

        await Promise.all(promises);
    }

    /**
     * Get objectives with their full hierarchy (Key Results -> Actions)
     */
    async getObjectivesHierarchy(filter = {}, user = null) {
        const objectives = await Objective.find(filter)
            .populate('owners', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .lean();

        const userRole = user?.role?.name || user?.role;
        const isAdmin = userRole === 'admin';

        // Populate Key Results for each Objective
        const populatedObjectives = await Promise.all(objectives.map(async (obj) => {
            const krs = await KeyResult.find({ objectiveId: obj._id })
                .populate('owner', 'firstName lastName email')
                .lean();

            // Populate Actions for each Key Result
            const populatedKRs = await Promise.all(krs.map(async (kr) => {
                const actionQuery = { keyResultId: kr._id };

                // Apply data isolation for actions if not admin and not objective owner
                const isOwner = obj.owners && obj.owners.some(oid => oid.toString() === user._id.toString());
                if (user && !isAdmin && !isOwner) {
                    actionQuery.$or = [
                        { assignedTo: user._id },
                        { createdBy: user._id }
                    ];
                }

                const actions = await Action.find(actionQuery)
                    .populate('assignedTo', 'firstName lastName email')
                    .populate('createdBy', 'firstName lastName')
                    .populate('asins', 'asinCode title')
                    .populate('sellerId', 'name marketplace')
                    .sort({ 'priority': 1 })
                    .lean();

                return { ...kr, actions };
            }));

            return { ...obj, keyResults: populatedKRs };
        }));

        return populatedObjectives;
    }

    /**
     * Update progress of an Objective based on its Key Results
     */
    async refreshProgress(objectiveId) {
        const objective = await Objective.findById(objectiveId);
        if (!objective) return;

        const newProgress = await objective.calculateProgress();
        return newProgress;
    }


    /**
     * Update an Objective
     */
    async updateObjective(id, data, userId) {
        const objective = await Objective.findByIdAndUpdate(id, data, { new: true });

        // Log activity
        const SystemLogService = require('./SystemLogService');
        await SystemLogService.log({
            type: 'UPDATE',
            entityType: 'OBJECTIVE',
            entityId: id,
            entityTitle: objective?.title,
            user: userId,
            description: `Updated objective: ${objective?.title}`
        });

        return objective;
    }

    /**
     * Delete an Objective and its hierarchy (Key Results and Actions)
     */
    async deleteObjective(id, userId) {
        const objective = await Objective.findById(id);
        const krs = await KeyResult.find({ objectiveId: id });
        for (const kr of krs) {
            await this.deleteKeyResult(kr._id, userId);
        }
        const deleted = await Objective.findByIdAndDelete(id);

        // Log activity
        const SystemLogService = require('./SystemLogService');
        await SystemLogService.log({
            type: 'DELETE',
            entityType: 'OBJECTIVE',
            entityId: id,
            entityTitle: objective?.title,
            user: userId,
            description: `Deleted objective and its associated key results: ${objective?.title}`
        });

        return deleted;
    }

    /**
     * Synchronize progress for a specific Key Result (e.g. GMS tracking)
     */
    async syncKeyResultProgress(krId) {
        const kr = await KeyResult.findById(krId);
        if (!kr) throw new Error('Key Result not found');

        const objective = await Objective.findById(kr.objectiveId);
        if (!objective) throw new Error('Parent Objective not found');

        if (kr.metric === 'GMS' && objective.sellerId) {
            const currentGms = await this.calculateCurrentGms(objective.sellerId, objective.startDate, objective.endDate);
            kr.currentValue = currentGms;
            await kr.save();

            // Refresh parent objective progress
            await this.refreshProgress(objective._id);
            return kr;
        }

        return kr;
    }

    /**
     * Helper to calculate GMS for a seller in a given date range using MonthlyPerformance
     */
    async calculateCurrentGms(sellerId, startDate, endDate) {
        const Asin = require('../models/Asin');
        const MonthlyPerformance = require('../models/MonthlyPerformance');

        // 1. Find all ASINs for this seller
        const asins = await Asin.find({ seller: sellerId }).select('asinCode');
        const asinCodes = asins.map(a => a.asinCode);

        if (asinCodes.length === 0) return 0;

        // 2. Aggregate MonthlyPerformance revenue for these ASINs
        // Note: MonthlyPerformance is usually recorded on the 1st of each month
        const start = new Date(startDate);
        const end = new Date(endDate);

        const results = await MonthlyPerformance.aggregate([
            {
                $match: {
                    asin: { $in: asinCodes },
                    month: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$ordered_revenue" }
                }
            }
        ]);

        return results.length > 0 ? results[0].totalRevenue : 0;
    }

    /**
     * Delete a Key Result and its associated Actions
     */
    async deleteKeyResult(id, userId) {
        const kr = await KeyResult.findById(id);
        if (kr) {
            const objectiveId = kr.objectiveId;
            await Action.deleteMany({ keyResultId: id });
            await KeyResult.findByIdAndDelete(id);

            // Log activity
            const SystemLogService = require('./SystemLogService');
            await SystemLogService.log({
                type: 'DELETE',
                entityType: 'KR',
                entityId: id,
                entityTitle: kr?.title,
                user: userId,
                description: `Deleted key result: ${kr?.title}`
            });

            // Refresh parent progress
            await this.refreshProgress(objectiveId);
        }
        return true;
    }
}

module.exports = new ObjectiveService();
