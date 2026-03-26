const aiGoalService = require('../services/aiGoalService');
const growthService = require('../services/growthService');
const Goal = require('../models/Goal');
const Action = require('../models/Action');
const responseHandler = require('../utils/responseHandler');

/**
 * AI Goal Controller - Strategic Intent Ingestion
 */
class AIGoalController {
  /**
   * Generates a preview of goal metrics from text intent.
   * POST /api/goals/ai-preview
   */
  async getPreview(req, res) {
    try {
      const { intent } = req.body;
      if (!intent) return responseHandler.error(res, 'Intent is required', 400);

      const preview = await aiGoalService.generatePreview(intent);
      return responseHandler.success(res, preview, 'AI Goal preview generated successfully');
    } catch (error) {
      console.error('[AI Goal Controller] Preview Error:', error);
      return responseHandler.error(res, 'Failed to generate goal preview', 500, error);
    }
  }

  /**
   * Atomically creates a Goal and its AI-generated execution plan.
   * POST /api/goals/ai-create
   */
  async createFullStrategy(req, res) {
    try {
      const { title, metricType, targetValue, startDate, endDate, scopeType, scopeIds, managerId } = req.body;

      // 1. Resolve ASINs for the goal
      const resolvedAsins = await growthService.resolveAsins(scopeType, scopeIds);

      // 2. Create the Goal
      const goal = new Goal({
        title, metricType, targetValue, startDate, endDate,
        scopeType, scopeIds, resolvedAsins, managerId,
        healthStatus: 'pending'
      });
      await goal.save();

      // 3. Generate the 4-week execution plan via AI
      const plan = await aiGoalService.generatePlan(goal);
      
      const createdTasks = [];
      
      // 4. Persistence of plan tasks
      for (const weekData of plan) {
        for (const taskData of weekData.tasks) {
          const task = new Action({
            ...taskData,
            goalId: goal._id,
            scopeType: goal.scopeType,
            scopeIds: goal.scopeIds,
            resolvedAsins: goal.resolvedAsins,
            createdBy: managerId,
            deadline: new Date(new Date(goal.startDate).getTime() + (weekData.week * 7 * 24 * 60 * 60 * 1000)),
            isAIGenerated: true,
            aiReasoning: `Strategy for Week ${weekData.week} of '${goal.title}'`
          });
          await task.save();
          createdTasks.push(task);
        }
      }

      // 5. Initial sync of achievement
      await growthService.syncGoalPerformance(goal._id);

      return responseHandler.success(res, { goal, plan: createdTasks }, 'Strategic Goal and AI Execution Plan created successfully', 201);
    } catch (error) {
      console.error('[AI Goal Controller] Creation Error:', error);
      return responseHandler.error(res, 'Failed to create AI-driven strategy', 500, error);
    }
  }
}

module.exports = new AIGoalController();
