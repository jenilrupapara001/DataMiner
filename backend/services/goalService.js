const { sql, getPool, generateId } = require('../database/db');

/**
 * Goal Service - GMS Goal Tracking Engine (SQL Version)
 * Strategic logic for brand-wide revenue targeting and performance status.
 */
class GoalService {
  
  /**
   * Create a new tracking goal
   */
  async createGoal(goalData) {
    try {
      const pool = await getPool();
      const id = generateId();
      
      await pool.request()
        .input('Id', sql.VarChar, id)
        .input('Title', sql.NVarChar, goalData.title)
        .input('Description', sql.NVarChar, goalData.description)
        .input('OwnerId', sql.VarChar, goalData.ownerId || goalData.brandId)
        .input('StartDate', sql.DateTime, new Date(goalData.startDate))
        .input('EndDate', sql.DateTime, new Date(goalData.endDate))
        .input('Status', sql.NVarChar, 'pending')
        .input('Progress', sql.Float, 0)
        .query(`
          INSERT INTO Goals (Id, Title, Description, OwnerId, StartDate, EndDate, Status, Progress, CreatedAt, UpdatedAt)
          VALUES (@Id, @Title, @Description, @OwnerId, @StartDate, @EndDate, @Status, @Progress, GETDATE(), GETDATE())
        `);
      
      return await this.calculateProgress(id);
    } catch (error) {
      console.error('[GoalService] createGoal error:', error);
      throw error;
    }
  }

  /**
   * Calculate real-time progress
   */
  async calculateProgress(goalId) {
    try {
      const pool = await getPool();
      const goalResult = await pool.request()
        .input('id', sql.VarChar, goalId)
        .query("SELECT * FROM Goals WHERE Id = @id");
      
      const goal = goalResult.recordset[0];
      if (!goal) throw new Error('Goal not found');

      // For brand-wide goals, we aggregate revenue for all ASINs of the owner (Seller)
      const stats = await pool.request()
        .input('ownerId', sql.VarChar, goal.OwnerId)
        .input('start', sql.DateTime, goal.StartDate)
        .input('end', sql.DateTime, goal.EndDate)
        .query(`
          SELECT SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as totalAchieved
          FROM AdsPerformance
          WHERE Asin IN (SELECT AsinCode FROM Asins WHERE SellerId = @ownerId)
          AND Date >= @start AND Date <= @end
        `);

      const achieved = stats.recordset[0]?.totalAchieved || 0;
      
      // Since SQL Goals doesn't have TargetValue column (it's in KeyResults), 
      // we might need to fetch it from a linked KeyResult or assume a field exists.
      // For now, we'll just update Progress if we can determine target.
      
      // Let's check if there's a TargetValue in any linked KeyResult
      const krResult = await pool.request()
        .input('goalId', sql.VarChar, goalId)
        .query(`
          SELECT SUM(TargetValue) as TotalTarget, SUM(CurrentValue) as TotalCurrent
          FROM KeyResults 
          WHERE ObjectiveId IN (SELECT Id FROM Objectives WHERE GoalId = @goalId)
        `);
      
      let progress = 0;
      if (krResult.recordset[0]?.TotalTarget > 0) {
        progress = (krResult.recordset[0].TotalCurrent / krResult.recordset[0].TotalTarget) * 100;
      }

      await pool.request()
        .input('id', sql.VarChar, goalId)
        .input('progress', sql.Float, progress)
        .input('status', sql.NVarChar, progress >= 100 ? 'achieved' : progress >= 80 ? 'on_track' : 'behind')
        .query(`
          UPDATE Goals 
          SET Progress = @progress, Status = @status, UpdatedAt = GETDATE()
          WHERE Id = @id
        `);

      return { ...goal, Progress: progress, Status: progress >= 100 ? 'achieved' : progress >= 80 ? 'on_track' : 'behind' };
    } catch (error) {
      console.error('[GoalService] calculateProgress error:', error);
      throw error;
    }
  }

  /**
   * List goals for a specific brand/owner
   */
  async getGoalsByBrand(brandId) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('brandId', sql.VarChar, brandId)
        .query("SELECT * FROM Goals WHERE OwnerId = @brandId ORDER BY CreatedAt DESC");
      return result.recordset;
    } catch (error) {
      console.error('[GoalService] getGoalsByBrand error:', error);
      return [];
    }
  }
}

module.exports = new GoalService();
