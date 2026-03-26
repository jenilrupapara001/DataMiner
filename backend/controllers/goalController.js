const goalService = require('../services/goalService');

/**
 * Goal Controller - SaaS Strategic Tracking API
 * Handles goal lifecycle and progress reporting.
 */
class GoalController {

  /**
   * POST /api/goals
   * Creates a new revenue goal and automatically calculates initial progress
   */
  async createGoal(req, res) {
    try {
      const { name, brandId, targetRevenue, startDate, endDate } = req.body;

      if (!name || !brandId || !targetRevenue || !startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters: name, brandId, targetRevenue, startDate, endDate' 
        });
      }

      const goal = await goalService.createGoal({
        name,
        brandId,
        targetRevenue,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      res.status(201).json({
        success: true,
        data: goal
      });
    } catch (error) {
      console.error('[GoalController] Create Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/goals/:id/progress
   * Recalculates and returns the latest progress status for a specific goal
   */
  async getProgress(req, res) {
    try {
      const { id } = req.params;
      const goal = await goalService.calculateProgress(id);
      
      res.status(200).json({
        success: true,
        data: goal
      });
    } catch (error) {
      console.error('[GoalController] Progress Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/goals
   * Lists all goals
   */
  async getGoals(req, res) {
    try {
      const goals = await goalService.getGoalsByBrand(null); // Passing null to get all
      res.status(200).json({ success: true, data: goals || [] });
    } catch (error) {
      console.error('[GoalController] List Error:', error);
      res.status(200).json({ success: true, data: [], message: 'Database currently unavailable' });
    }
  }

  /**
   * GET /api/goals/brand/:brandId
   * Lists all goals for a specific seller/brand
   */
  async getBrandGoals(req, res) {
    try {
      const { brandId } = req.params;
      const goals = await goalService.getGoalsByBrand(brandId);
      
      res.status(200).json({
        success: true,
        data: goals || []
      });
    } catch (error) {
      console.error('[GoalController] List Error:', error);
      res.status(200).json({ success: true, data: [], message: 'Database currently unavailable' });
    }
  }
}

module.exports = new GoalController();
