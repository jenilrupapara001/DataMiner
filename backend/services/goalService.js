const Goal = require('../models/Goal');
const Asin = require('../models/Asin');
const RevenueSummary = require('../models/RevenueSummary');

/**
 * Goal Service - GMS Goal Tracking Engine
 * Strategic logic for brand-wide revenue targeting and performance status.
 */
class GoalService {
  
  /**
   * Create a new tracking goal and trigger initial setup
   */
  async createGoal(goalData) {
    const goal = new Goal(goalData);
    await goal.save();
    
    // Auto-link context
    await this.attachAsins(goal._id);
    return await this.calculateProgress(goal._id);
  }

  /**
   * Auto-link ASINs belonging to the brand (Seller)
   */
  async attachAsins(goalId) {
    const goal = await Goal.findById(goalId);
    if (!goal) throw new Error('Goal not found');

    // Find all ASINs mapped to this brand/seller
    const asins = await Asin.find({ seller: goal.brandId }).select('asinCode');
    const asinCodes = asins.map(a => a.asinCode);

    goal.asinList = asinCodes;
    await goal.save();
    return goal;
  }

  /**
   * Calculate real-time progress based on Unified Revenue Engine data
   */
  async calculateProgress(goalId) {
    const goal = await Goal.findById(goalId);
    if (!goal) throw new Error('Goal not found');

    if (!goal.asinList || goal.asinList.length === 0) {
      goal.achievedRevenue = 0;
      goal.updateStatus();
      await goal.save();
      return goal;
    }

    // Aggregate total revenue for the linked ASINs within the goal timeframe
    const stats = await RevenueSummary.aggregate([
      {
        $match: {
          asin: { $in: goal.asinList },
          date: { $gte: goal.startDate, $lte: goal.endDate },
          period: 'daily'
        }
      },
      {
        $group: {
          _id: null,
          totalAchieved: { $sum: '$totalRevenue' }
        }
      }
    ]);

    const achieved = stats.length > 0 ? stats[0].totalAchieved : 0;
    
    goal.achievedRevenue = achieved;
    goal.lastCalculatedAt = new Date();
    
    // Status Logic: ahead (>110%), ontrack (80–110%), behind (<80%)
    goal.updateStatus();
    
    await goal.save();
    return goal;
  }

  /**
   * List goals for a specific brand
   */
  async getGoalsByBrand(brandId) {
    const filter = brandId ? { brandId } : {};
    return await Goal.find(filter).sort({ createdAt: -1 });
  }
}

module.exports = new GoalService();
