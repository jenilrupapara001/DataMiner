const { sql, getPool } = require('../database/db');
const aggregationEngine = require('./dataAggregationEngine');

/**
 * Growth Service - The Orchestration Hub (SQL Version)
 */
class GrowthService {
  /**
   * Resolves a flexible scope (Brand/ASIN) into a flattened list of ASINs.
   */
  async resolveAsins(scopeType, scopeIds) {
    if (scopeType === 'ASIN') return scopeIds;
    
    if (scopeType === 'BRAND') {
      try {
        const pool = await getPool();
        const request = pool.request();
        
        // Use a parameterized IN clause for scopeIds
        const result = await request.query(`
          SELECT AsinCode 
          FROM Asins 
          WHERE SellerId IN (${scopeIds.map((_, i) => `@id${i}`).join(',')})
        `);
        
        scopeIds.forEach((id, i) => {
          request.input(`id${i}`, sql.VarChar, id);
        });

        const finalResult = await request.query(`
          SELECT AsinCode 
          FROM Asins 
          WHERE SellerId IN (${scopeIds.map((_, i) => `@id${i}`).join(',')})
        `);

        return finalResult.recordset.map(r => r.AsinCode);
      } catch (err) {
        console.error('[GrowthService] resolveAsins error:', err);
        return [];
      }
    }
    
    return [];
  }

  /**
   * Recalculates goal performance metrics in real-time.
   */
  async syncGoalPerformance(goalId) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('id', sql.VarChar, goalId)
        .query("SELECT * FROM Goals WHERE Id = @id");
      
      const goal = result.recordset[0];
      if (!goal) throw new Error('Goal not found');

      // Resolve ASINs (Assuming OwnerId is SellerId for BRAND scope)
      const asinCodes = await this.resolveAsins('BRAND', [goal.OwnerId]);
      if (asinCodes.length === 0) return goal;

      const now = new Date();
      const performance = await aggregationEngine.aggregatePerformance(
        asinCodes, 
        goal.StartDate, 
        now < goal.EndDate ? now : goal.EndDate
      );

      // Map metric - In SQL version, we might store MetricType in Goals table
      // For now, assume GMS as default
      const currentValue = performance.gms || 0;
      
      // Update Progress and Status
      // (Logic moved from calculateProgress method of the model)
      // Progress calculation depends on TargetValue which is in KeyResults
      
      await pool.request()
        .input('id', sql.VarChar, goalId)
        .input('progress', sql.Float, (currentValue / 100000) * 100) // Dummy target for now
        .query("UPDATE Goals SET Progress = @progress, UpdatedAt = GETDATE() WHERE Id = @id");

      return { ...goal, Progress: (currentValue / 100000) * 100 };
    } catch (error) {
      console.error('[Growth Service] Sync Error:', error);
      throw error;
    }
  }

  /**
   * Links a task to a goal and initializes its scope.
   */
  async linkTaskToGoal(taskId, goalId) {
    try {
      const pool = await getPool();
      await pool.request()
        .input('taskId', sql.VarChar, taskId)
        .input('goalId', sql.VarChar, goalId)
        .query("UPDATE Actions SET GoalId = @goalId, UpdatedAt = GETDATE() WHERE Id = @taskId");
      
      return { Id: taskId, GoalId: goalId };
    } catch (err) {
      console.error('[GrowthService] linkTaskToGoal error:', err);
      return null;
    }
  }
}

module.exports = new GrowthService();
