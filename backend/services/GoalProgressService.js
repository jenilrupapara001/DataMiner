const KeyResult = require('../models/KeyResult');
const Objective = require('../models/Objective');
const DataAggregationEngine = require('./dataAggregationEngine');
const aiTaskService = require('./aiTaskService');

/**
 * Goal Progress Service - The Strategic Execution Core
 * 
 * Performs real-time goal tracking, health analysis, and 
 * autonomous recovery triggers for the growth engine.
 */
class GoalProgressService {
    /**
     * Recalculates goal achievement and triggers recovery logic if behind.
     */
    async calculateGoalProgress(krId) {
        try {
            const kr = await KeyResult.findById(krId).populate('objectiveId');
            if (!kr) throw new Error('Key Result not found');

            const objective = kr.objectiveId;
            if (!objective) throw new Error('Parent objective not found');

            const asins = kr.resolvedAsins && kr.resolvedAsins.length > 0 
                ? kr.resolvedAsins 
                : await this.getObjectiveAsins(objective);

            if (asins.length === 0) return kr;

            // 1. Fetch live data from aggregation engine
            const performance = await DataAggregationEngine.aggregatePerformance(
                asins, 
                objective.startDate, 
                objective.endDate
            );

            // 2. Map metric type to performance value
            let currentValue = 0;
            switch (kr.metricType) {
                case 'GMS': currentValue = performance.gms; break;
                case 'ORDERS': currentValue = performance.orders; break;
                case 'ACOS': currentValue = performance.acos; break;
                case 'CONVERSION_RATE': currentValue = performance.conversionRate; break;
                default: currentValue = kr.currentValue || 0;
            }

            // 3. Compute Progress Metrics
            const now = new Date();
            const start = new Date(objective.startDate);
            const end = new Date(objective.endDate);
            const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
            const daysElapsed = Math.max(1, (Math.min(now, end) - start) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(1, (end - now) / (1000 * 60 * 60 * 24));

            const achievementPercent = kr.targetValue > 0 ? (currentValue / kr.targetValue) * 100 : 0;
            const gap = Math.max(0, kr.targetValue - currentValue);
            
            const currentDailyRate = currentValue / daysElapsed;
            const projectedValue = currentDailyRate * totalDays;
            const dailyRunRateRequired = daysRemaining > 0 ? gap / daysRemaining : 0;

            // 4. Determine Health Status
            let healthStatus = 'ON_TRACK';
            if (projectedValue < kr.targetValue * 0.85) {
                healthStatus = 'BEHIND';
            } else if (projectedValue > kr.targetValue * 1.15) {
                healthStatus = 'AHEAD';
            }

            // 5. Update Key Result
            kr.currentValue = currentValue;
            kr.achievementPercent = achievementPercent;
            kr.projectedValue = projectedValue;
            kr.dailyRunRateRequired = dailyRunRateRequired;
            kr.healthStatus = healthStatus;
            kr.resolvedAsins = asins;
            
            // Sync status field for legacy compatibility
            if (achievementPercent >= 100) kr.status = 'COMPLETED';
            else if (healthStatus === 'BEHIND') kr.status = 'BEHIND';
            else kr.status = 'IN_PROGRESS';

            await kr.save();

            // 6. CLOSED LOOP: Trigger Recovery if Behind
            if (healthStatus === 'BEHIND' && kr.status !== 'COMPLETED') {
                await this.triggerRecoveryFlow(kr);
            }

            // Also refresh parent objective progress
            const ObjectiveService = require('./ObjectiveService');
            await ObjectiveService.refreshProgress(objective._id);

            return kr;
        } catch (error) {
            console.error('[GoalProgressService] Error:', error);
            throw error;
        }
    }

    /**
     * Resolves ASINs for an objective if not explicitly set in Key Result.
     */
    async getObjectiveAsins(objective) {
        if (!objective.sellerId) return [];
        const Asin = require('../models/Asin');
        const asins = await Asin.find({ seller: objective.sellerId }).select('asinCode');
        return asins.map(a => a.asinCode);
    }

    /**
     * Trigger AI to generate recovery tasks when a goal is off-track.
     */
    async triggerRecoveryFlow(kr) {
        try {
            console.log(`[Closed-Loop] Goal "${kr.title}" is BEHIND. Triggering AI Recovery...`);
            
            // Check if we already generated recovery tasks recently to avoid spam
            const Action = require('../models/Action');
            const recentRecovery = await Action.findOne({
                keyResultId: kr._id,
                'autoGenerated.source': 'RECOVERY_ENGINE',
                createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
            });

            if (recentRecovery) {
                console.log(`[Closed-Loop] Skip: Recovery tasks already generated today for "${kr.title}".`);
                return;
            }

            // Use AI Task Service to generate a recovery plan
            // In a real scenario, this would call AI with the gap/health context
            // For now, we'll mark the goal for recovery and wait for user trigger or implement handleRecovery in Service
            return true;
        } catch (err) {
            console.error('[GoalProgressService] Recovery Flow Error:', err);
        }
    }
}

module.exports = new GoalProgressService();
