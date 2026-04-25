const aiGoalService = require('../services/aiGoalService');
const growthService = require('../services/growthService');
const { sql, getPool, generateId } = require('../database/db');
const responseHandler = require('../utils/responseHandler');

/**
 * AI Goal Controller - Strategic Intent Ingestion (SQL Version)
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
      const pool = await getPool();

      // 1. Resolve ASINs for the goal
      const resolvedAsins = await growthService.resolveAsins(scopeType, scopeIds);

      // 2. Create the Goal in SQL
      const goalId = generateId();
      await pool.request()
        .input('id', sql.VarChar, goalId)
        .input('title', sql.NVarChar, title)
        .input('ownerId', sql.VarChar, managerId)
        .input('startDate', sql.DateTime, new Date(startDate))
        .input('endDate', sql.DateTime, new Date(endDate))
        .input('status', sql.NVarChar, 'PENDING')
        .input('progress', sql.Decimal(5, 2), 0)
        .query(`
          INSERT INTO Goals (Id, Title, OwnerId, StartDate, EndDate, Status, Progress, CreatedAt, UpdatedAt)
          VALUES (@id, @title, @ownerId, @startDate, @endDate, @status, @progress, GETDATE(), GETDATE())
        `);

      const goal = {
        id: goalId,
        title,
        metricType,
        targetValue,
        startDate,
        endDate,
        scopeType,
        scopeIds,
        resolvedAsins,
        managerId
      };

      // 3. Generate the 4-week execution plan via AI
      const plan = await aiGoalService.generatePlan(goal);
      
      const createdTasks = [];
      
      // 4. Persistence of plan tasks
      for (const weekData of plan) {
        for (const taskData of weekData.tasks) {
          const taskId = generateId();
          const deadline = new Date(new Date(goal.startDate).getTime() + (weekData.week * 7 * 24 * 60 * 60 * 1000));
          
          await pool.request()
            .input('id', sql.VarChar, taskId)
            .input('title', sql.NVarChar, taskData.title)
            .input('description', sql.NVarChar, taskData.description)
            .input('status', sql.NVarChar, 'PENDING')
            .input('priority', sql.NVarChar, taskData.priority || 'MEDIUM')
            .input('type', sql.NVarChar, taskData.type || 'GENERAL')
            .input('createdBy', sql.VarChar, managerId)
            .input('goalId', sql.VarChar, goalId)
            .input('dueDate', sql.DateTime, deadline)
            .input('isAIGenerated', sql.Bit, 1)
            .input('aiReasoning', sql.NVarChar, `Strategy for Week ${weekData.week} of '${goal.title}'`)
            .input('resolvedAsins', sql.NVarChar, JSON.stringify(resolvedAsins))
            .query(`
              INSERT INTO Actions (
                Id, Title, Description, Status, Priority, Type, 
                CreatedBy, GoalId, DueDate, IsAIGenerated, AiReasoning, 
                ResolvedAsins, CreatedAt, UpdatedAt
              )
              VALUES (
                @id, @title, @description, @status, @priority, @type, 
                @createdBy, @goalId, @dueDate, @isAIGenerated, @aiReasoning, 
                @resolvedAsins, GETDATE(), GETDATE()
              )
            `);
            
          createdTasks.push({ id: taskId, ...taskData, deadline });
        }
      }

      // 5. Initial sync of achievement
      await growthService.syncGoalPerformance(goalId);

      return responseHandler.success(res, { goal, plan: createdTasks }, 'Strategic Goal and AI Execution Plan created successfully', 201);
    } catch (error) {
      console.error('[AI Goal Controller] Creation Error:', error);
      return responseHandler.error(res, 'Failed to create AI-driven strategy', 500, error);
    }
  }
}

module.exports = new AIGoalController();
