const aiTaskService = require('../services/aiTaskService');
const { sql, getPool, generateId } = require('../database/db');
const responseHandler = require('../utils/responseHandler');

/**
 * AI Task Controller - Intent-based Task Enrichment (SQL Version)
 */
class AITaskController {
  /**
   * Generates a fully enriched task from simple intent.
   * POST /api/tasks/ai-create
   */
  async createEnrichedTask(req, res) {
    try {
      const { intent, goalId } = req.body;
      const managerId = req.user?.Id || req.user?._id || req.user?.id;

      let goalContext = {};
      if (goalId) {
        const GoalProgressService = require('../services/GoalProgressService');
        const kr = await GoalProgressService.calculateGoalProgress(goalId);
        if (kr) {
          goalContext = {
            title: kr.Title,
            currentValue: kr.CurrentValue,
            targetValue: kr.TargetValue,
            gap: kr.TargetValue - kr.CurrentValue,
            metricType: kr.MetricType,
            healthStatus: kr.HealthStatus
          };
        }
      }

      const enriched = await aiTaskService.generateEnrichedTask(intent, goalContext);
      const pool = await getPool();
      const id = generateId();

      await pool.request()
        .input('Id', sql.VarChar, id)
        .input('Title', sql.NVarChar, enriched.title)
        .input('Description', sql.NVarChar, enriched.description)
        .input('Type', sql.NVarChar, enriched.type)
        .input('Priority', sql.NVarChar, enriched.priority)
        .input('Status', sql.NVarChar, 'PENDING')
        .input('CreatedBy', sql.VarChar, managerId)
        .input('KeyResultId', sql.VarChar, goalId || null)
        .input('IsAIGenerated', sql.Bit, 1)
        .input('AiReasoning', sql.NVarChar, enriched.aiReason)
        .input('DueDate', sql.DateTime, new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)))
        .query(`
          INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, CreatedBy, KeyResultId, IsAIGenerated, AiReasoning, DueDate, CreatedAt, UpdatedAt)
          VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @CreatedBy, @KeyResultId, @IsAIGenerated, @AiReasoning, @DueDate, GETDATE(), GETDATE())
        `);

      return responseHandler.success(res, { Id: id, ...enriched }, 'AI-Enriched task created successfully', 201);
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
      const managerId = req.user?.Id || req.user?._id || req.user?.id;

      if (!objectiveId) {
        return responseHandler.error(res, 'Objective ID is required', 400);
      }

      const GoalProgressService = require('../services/GoalProgressService');
      const kr = await GoalProgressService.calculateGoalProgress(objectiveId);

      if (!kr || kr.HealthStatus !== 'BEHIND') {
        return responseHandler.error(res, 'Goal is either not found or not in BEHIND status', 400);
      }

      const tasks = await aiTaskService.generateRecoveryTasks({
        title: kr.Title,
        currentValue: kr.CurrentValue,
        targetValue: kr.TargetValue,
        gap: kr.TargetValue - kr.CurrentValue,
        metricType: kr.MetricType
      });

      const pool = await getPool();
      const savedTasks = [];

      for (const t of tasks) {
        const id = generateId();
        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('Title', sql.NVarChar, t.title)
          .input('Description', sql.NVarChar, t.description)
          .input('Type', sql.NVarChar, 'RECOVERY')
          .input('Priority', sql.NVarChar, t.priority)
          .input('Status', sql.NVarChar, 'PENDING')
          .input('CreatedBy', sql.VarChar, managerId)
          .input('KeyResultId', sql.VarChar, objectiveId)
          .input('IsAIGenerated', sql.Bit, 1)
          .input('AiReasoning', sql.NVarChar, t.aiReason)
          .query(`
            INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, CreatedBy, KeyResultId, IsAIGenerated, AiReasoning, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @CreatedBy, @KeyResultId, @IsAIGenerated, @AiReasoning, GETDATE(), GETDATE())
          `);
        savedTasks.push({ Id: id, ...t });
      }

      return responseHandler.success(res, savedTasks, `Generated ${savedTasks.length} recovery tasks`, 201);
    } catch (error) {
      console.error('[AI Task Controller] Recovery Error:', error);
      return responseHandler.error(res, 'Failed to generate recovery tasks', 500, error);
    }
  }
}

module.exports = new AITaskController();
