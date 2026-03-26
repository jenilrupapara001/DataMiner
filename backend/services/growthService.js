const Goal = require('../models/Goal');
const Action = require('../models/Action'); // Using Action as the Task model
const Brand = require('../models/Brand');
const aggregationEngine = require('./dataAggregationEngine');

/**
 * Growth Service - The Orchestration Hub
 * 
 * Manages the strategic execution loop between Goals and Tasks, 
 * ensuring performance data is synchronized and actionable.
 */
class GrowthService {
  /**
   * Resolves a flexible scope (Brand/ASIN) into a flattened list of ASINs.
   */
  async resolveAsins(scopeType, scopeIds) {
    if (scopeType === 'ASIN') return scopeIds;
    
    if (scopeType === 'BRAND') {
      const brands = await Brand.find({ _id: { $in: scopeIds } });
      const asins = brands.reduce((acc, brand) => [...acc, ...brand.asinList], []);
      return [...new Set(asins)]; // Unique list
    }
    
    return [];
  }

  /**
   * Recalculates goal performance metrics in real-time.
   */
  async syncGoalPerformance(goalId) {
    try {
      const goal = await Goal.findById(goalId);
      if (!goal) throw new Error('Goal not found');

      const now = new Date();
      
      // 1. Fetch performance from Aggregation Engine
      const performance = await aggregationEngine.aggregatePerformance(
        goal.resolvedAsins, 
        goal.startDate, 
        now < goal.endDate ? now : goal.endDate
      );

      // 2. Map metric to goal currentValue
      const metricMap = {
        'GMS': 'gms',
        'ACOS': 'acos',
        'ROI': 'roi',
        'PROFIT': 'profit',
        'CONVERSION_RATE': 'conversionRate',
        'ORDER_COUNT': 'orders'
      };

      const metricKey = metricMap[goal.metricType] || 'gms';
      goal.currentValue = performance[metricKey] || 0;

      // 3. Trigger recalculation (Gap, RR, Health)
      goal.calculateProgress();
      
      // 4. Calculate Projection (Linear Trend)
      const totalDays = Math.ceil((goal.endDate - goal.startDate) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((now - goal.startDate) / (1000 * 60 * 60 * 24));
      
      if (daysElapsed > 0) {
        goal.projectedValue = (goal.currentValue / daysElapsed) * totalDays;
      }

      goal.lastCalculatedAt = now;
      await goal.save();

      return goal;
    } catch (error) {
      console.error('[Growth Service] Sync Error:', error);
      throw error;
    }
  }

  /**
   * Links a task to a goal and initializes its scope.
   */
  async linkTaskToGoal(taskId, goalId) {
    const task = await Action.findById(taskId);
    const goal = await Goal.findById(goalId);

    if (task && goal) {
      task.goalId = goalId;
      task.scopeType = goal.scopeType;
      task.scopeIds = goal.scopeIds;
      task.resolvedAsins = goal.resolvedAsins;
      await task.save();
    }
    
    return task;
  }
}

module.exports = new GrowthService();
