const aiTaskService = require('../services/aiTaskService');
const growthService = require('../services/growthService');
const Action = require('../models/Action');
const responseHandler = require('../utils/responseHandler');

/**
 * AI Task Controller - Intent-based Task Enrichment
 */
class AITaskController {
  /**
   * Generates a fully enriched task from simple intent.
   * POST /api/tasks/ai-create
   */
  async createEnrichedTask(req, res) {
    try {
      const { intent, goalId } = req.body;
      const managerId = req.user?._id || req.user?.id;

      // 1. Fetch Goal Context if available
      let goalContext = {};
      if (goalId) {
        const KeyResult = require('../models/KeyResult');
        const GoalProgressService = require('../services/GoalProgressService');
        // Always recalculate to get latest context
        const kr = await GoalProgressService.calculateGoalProgress(goalId);
        if (kr) {
          goalContext = {
            title: kr.title,
            currentValue: kr.currentValue,
            targetValue: kr.targetValue,
            gap: kr.targetValue - kr.currentValue,
            metricType: kr.metricType,
            healthStatus: kr.healthStatus
          };
        }
      }

      // 2. Generate task details via AI with context
      const enriched = await aiTaskService.generateEnrichedTask(intent, goalContext);

      // 3. Create the task
      const task = new Action({
        ...enriched,
        keyResultId: goalId || null,
        createdBy: managerId,
        deadline: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)), // Default 3 days
        aiGenerated: true
      });

      await task.save();

      return responseHandler.success(res, task, 'AI-Enriched task created successfully', 201);
    } catch (error) {
      console.error('[AI Task Controller] Error:', error);
      return responseHandler.error(res, 'Failed to generate AI-enriched task', 500, error);
    }
  }

  /**
   * Generates recovery tasks for a "BEHIND" goal.
   * POST /api/ai/generate-recovery-tasks
   */
  async generateRecoveryTasks(req, res) {
    try {
      const { objectiveId } = req.body;
      const managerId = req.user?._id || req.user?.id;

      if (!objectiveId) {
        return responseHandler.error(res, 'Objective ID is required', 400);
      }

      // 1. Fetch Goal Context
      const GoalProgressService = require('../services/GoalProgressService');
      const kr = await GoalProgressService.calculateGoalProgress(objectiveId);

      if (!kr || kr.healthStatus !== 'BEHIND') {
        return responseHandler.error(res, 'Goal is either not found or not in BEHIND status', 400);
      }

      // 2. Generate Recovery Tasks via Service
      const tasks = await aiTaskService.generateRecoveryTasks(kr);

      // 3. Save tasks to DB
      const savedTasks = await Promise.all(tasks.map(t => {
        const action = new Action({
          ...t,
          keyResultId: kr._id,
          createdBy: managerId,
          aiGenerated: true
        });
        return action.save();
      }));

      return responseHandler.success(res, savedTasks, `Generated ${savedTasks.length} recovery tasks`, 201);
    } catch (error) {
      console.error('[AI Task Controller] Recovery Error:', error);
      return responseHandler.error(res, 'Failed to generate recovery tasks', 500, error);
    }
  }
}

module.exports = new AITaskController();
