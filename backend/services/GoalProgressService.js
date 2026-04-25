const { sql, getPool } = require('../database/db');
const DataAggregationEngine = require('./dataAggregationEngine');

/**
 * Goal Progress Service - The Strategic Execution Core (SQL Version)
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
            const pool = await getPool();
            
            // 1. Fetch Key Result and parent Objective
            const krResult = await pool.request()
                .input('krId', sql.VarChar, krId)
                .query(`
                    SELECT kr.*, obj.StartDate as ObjectiveStartDate, obj.EndDate as ObjectiveEndDate, obj.SellerId
                    FROM KeyResults kr
                    LEFT JOIN Objectives obj ON kr.ObjectiveId = obj.Id
                    WHERE kr.Id = @krId
                `);
            
            const kr = krResult.recordset[0];
            if (!kr) throw new Error('Key Result not found');

            const asins = kr.ResolvedAsins ? JSON.parse(kr.ResolvedAsins) : await this.getObjectiveAsins(kr.ObjectiveId, kr.SellerId);

            if (!asins || asins.length === 0) return kr;

            // 2. Fetch live data from aggregation engine
            const performance = await DataAggregationEngine.aggregatePerformance(
                asins, 
                kr.ObjectiveStartDate, 
                kr.ObjectiveEndDate
            );

            // 3. Map metric type to performance value
            let currentValue = 0;
            switch (kr.MetricType) {
                case 'GMS': currentValue = performance.gms; break;
                case 'ORDERS': currentValue = performance.orders; break;
                case 'ACOS': currentValue = performance.acos; break;
                case 'CONVERSION_RATE': currentValue = performance.conversionRate; break;
                default: currentValue = kr.CurrentValue || 0;
            }

            // 4. Compute Progress Metrics
            const now = new Date();
            const start = new Date(kr.ObjectiveStartDate);
            const end = new Date(kr.ObjectiveEndDate);
            const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
            const daysElapsed = Math.max(1, (Math.min(now, end) - start) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(1, (end - now) / (1000 * 60 * 60 * 24));

            const achievementPercent = kr.TargetValue > 0 ? (currentValue / kr.TargetValue) * 100 : 0;
            const gap = Math.max(0, kr.TargetValue - currentValue);
            
            const currentDailyRate = currentValue / daysElapsed;
            const projectedValue = currentDailyRate * totalDays;
            const dailyRunRateRequired = daysRemaining > 0 ? gap / daysRemaining : 0;

            // 5. Determine Health Status
            let healthStatus = 'ON_TRACK';
            if (projectedValue < kr.TargetValue * 0.85) {
                healthStatus = 'BEHIND';
            } else if (projectedValue > kr.TargetValue * 1.15) {
                healthStatus = 'AHEAD';
            }

            // 6. Update Key Result in SQL
            let status = kr.Status;
            if (achievementPercent >= 100) status = 'COMPLETED';
            else if (healthStatus === 'BEHIND') status = 'BEHIND';
            else status = 'IN_PROGRESS';

            await pool.request()
                .input('krId', sql.VarChar, krId)
                .input('currentValue', sql.Decimal(18, 2), currentValue)
                .input('achievementPercent', sql.Decimal(18, 4), achievementPercent)
                .input('projectedValue', sql.Decimal(18, 4), projectedValue)
                .input('dailyRunRateRequired', sql.Decimal(18, 4), dailyRunRateRequired)
                .input('healthStatus', sql.NVarChar, healthStatus)
                .input('status', sql.NVarChar, status)
                .input('resolvedAsins', sql.NVarChar, JSON.stringify(asins))
                .query(`
                    UPDATE KeyResults SET
                        CurrentValue = @currentValue,
                        AchievementPercent = @achievementPercent,
                        ProjectedValue = @projectedValue,
                        DailyRunRateRequired = @dailyRunRateRequired,
                        HealthStatus = @healthStatus,
                        Status = @status,
                        ResolvedAsins = @resolvedAsins,
                        UpdatedAt = GETDATE()
                    WHERE Id = @krId
                `);

            // 7. CLOSED LOOP: Trigger Recovery if Behind
            if (healthStatus === 'BEHIND' && status !== 'COMPLETED') {
                await this.triggerRecoveryFlow({ ...kr, Id: krId, Title: kr.Title, Status: status });
            }

            // Also refresh parent objective progress
            const ObjectiveService = require('./ObjectiveService');
            await ObjectiveService.refreshProgress(kr.ObjectiveId);

            return { ...kr, CurrentValue: currentValue, AchievementPercent: achievementPercent, HealthStatus: healthStatus, Status: status };
        } catch (error) {
            console.error('[GoalProgressService] Error:', error);
            throw error;
        }
    }

    /**
     * Resolves ASINs for an objective if not explicitly set in Key Result.
     */
    async getObjectiveAsins(objectiveId, sellerId) {
        if (!sellerId) return [];
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query(`SELECT AsinCode FROM Asins WHERE SellerId = @sellerId`);
            
            return result.recordset.map(a => a.AsinCode);
        } catch (error) {
            console.error('[GoalProgressService] getObjectiveAsins Error:', error);
            return [];
        }
    }

    /**
     * Trigger AI to generate recovery tasks when a goal is off-track.
     */
    async triggerRecoveryFlow(kr) {
        try {
            console.log(`[Closed-Loop] Goal "${kr.Title}" is BEHIND. Triggering AI Recovery...`);
            
            const pool = await getPool();
            
            // Check if we already generated recovery tasks recently to avoid spam
            const recentRecoveryResult = await pool.request()
                .input('krId', sql.VarChar, kr.Id)
                .query(`
                    SELECT TOP 1 Id FROM Actions
                    WHERE KeyResultId = @krId
                    AND AutoGeneratedSource = 'RECOVERY_ENGINE'
                    AND CreatedAt > DATEADD(day, -1, GETDATE())
                `);

            if (recentRecoveryResult.recordset.length > 0) {
                console.log(`[Closed-Loop] Skip: Recovery tasks already generated today for "${kr.Title}".`);
                return;
            }

            // Use AI Task Service to generate a recovery plan
            // (This logic would be implemented in aiTaskService)
            return true;
        } catch (err) {
            console.error('[GoalProgressService] Recovery Flow Error:', err);
        }
    }
}

module.exports = new GoalProgressService();
