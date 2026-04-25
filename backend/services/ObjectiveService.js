const { sql, getPool, generateId } = require('../database/db');

class ObjectiveService {

    /**
     * Create a new Objective.
     * If type is MONTHLY, it can optionally generate 4 Weekly Key Results/Sub-Objectives.
     */
    async createObjective(data, user) {
        const { title, type, startDate, endDate, sellerId, autoGenerateWeekly, goalId, description } = data;
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('goalId', sql.VarChar, goalId || null)
            .input('title', sql.NVarChar, title)
            .input('description', sql.NVarChar, description || null)
            .input('ownerId', sql.VarChar, user.Id || user._id)
            .input('sellerId', sql.VarChar, sellerId || null)
            .input('type', sql.NVarChar, type || 'MONTHLY')
            .input('startDate', sql.DateTime, startDate ? new Date(startDate) : null)
            .input('endDate', sql.DateTime, endDate ? new Date(endDate) : null)
            .input('status', sql.NVarChar, 'NOT_STARTED')
            .input('autoGenerateWeekly', sql.Bit, autoGenerateWeekly ? 1 : 0)
            .input('createdBy', sql.VarChar, user.Id || user._id)
            .query(`
                INSERT INTO Objectives (Id, GoalId, Title, Description, OwnerId, SellerId, Type, StartDate, EndDate, Status, AutoGenerateWeekly, CreatedBy, Progress, CreatedAt, UpdatedAt)
                VALUES (@id, @goalId, @title, @description, @ownerId, @sellerId, @type, @startDate, @endDate, @status, @autoGenerateWeekly, @createdBy, 0, GETDATE(), GETDATE())
            `);

        // System Log
        try {
            const SystemLogService = require('./SystemLogService');
            await SystemLogService.log({
                level: 'INFO',
                module: 'OBJECTIVE',
                message: `Created new objective: ${title}`,
                userId: user.Id || user._id,
                metadata: JSON.stringify({ objectiveId: id })
            });
        } catch (err) {
            console.error('[ObjectiveService] Logging failed:', err);
        }

        if (type === 'MONTHLY' && autoGenerateWeekly) {
            await this.generateWeeklyBreakdown({ Id: id, StartDate: startDate, EndDate: endDate, SellerId: sellerId }, user);
        }

        return { id, title, type };
    }

    /**
     * Automatically generate 4 Weekly Key Results for a Monthly Objective.
     */
    async generateWeeklyBreakdown(parentObjective, user) {
        const start = new Date(parentObjective.StartDate);
        const end = new Date(parentObjective.EndDate);
        const pool = await getPool();

        // Create 4 Weekly KRs
        for (let weekNum = 1; weekNum <= 4; weekNum++) {
            const weekStart = new Date(start);
            weekStart.setDate(start.getDate() + (weekNum - 1) * 7);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const actualEnd = weekEnd > end ? end : weekEnd;

            const krId = generateId();
            await pool.request()
                .input('id', sql.VarChar, krId)
                .input('objectiveId', sql.VarChar, parentObjective.Id)
                .input('title', sql.NVarChar, `Week ${weekNum}: Execution Phase`)
                .input('ownerId', sql.VarChar, user.Id || user._id)
                .input('status', sql.NVarChar, 'NOT_STARTED')
                .input('targetValue', sql.Decimal(18, 2), 100)
                .input('unit', sql.NVarChar, '%')
                .input('metricType', sql.NVarChar, 'Tasks Completed')
                .query(`
                    INSERT INTO KeyResults (Id, ObjectiveId, Title, OwnerId, Status, TargetValue, Unit, MetricType, CurrentValue, Progress, CreatedAt, UpdatedAt)
                    VALUES (@id, @objectiveId, @title, @ownerId, @status, @targetValue, @unit, @metricType, 0, 0, GETDATE(), GETDATE())
                `);

            // Create default tasks for this week
            const tasks = [
                { title: `Week ${weekNum} Planning`, type: 'GENERAL_OPTIMIZATION', priority: 'HIGH' },
                { title: `Week ${weekNum} Execution`, type: 'GENERAL_OPTIMIZATION', priority: 'MEDIUM' },
                { title: `Week ${weekNum} Review`, type: 'REVIEW_MANAGEMENT', priority: 'MEDIUM' }
            ];

            for (const t of tasks) {
                const taskId = generateId();
                await pool.request()
                    .input('id', sql.VarChar, taskId)
                    .input('title', sql.NVarChar, t.title)
                    .input('type', sql.NVarChar, t.type)
                    .input('priority', sql.NVarChar, t.priority)
                    .input('status', sql.NVarChar, 'PENDING')
                    .input('createdBy', sql.VarChar, user.Id || user._id)
                    .input('assignedTo', sql.VarChar, user.Id || user._id)
                    .input('krId', sql.VarChar, krId)
                    .input('sellerId', sql.VarChar, parentObjective.SellerId || null)
                    .input('dueDate', sql.DateTime, actualEnd)
                    .query(`
                        INSERT INTO Actions (Id, Title, Type, Priority, Status, CreatedBy, AssignedTo, KeyResultId, SellerId, DueDate, CreatedAt, UpdatedAt)
                        VALUES (@id, @title, @type, @priority, @status, @createdBy, @assignedTo, @krId, @sellerId, @dueDate, GETDATE(), GETDATE())
                    `);
            }
        }
    }

    /**
     * Get objectives with their full hierarchy (Key Results -> Actions)
     */
    async getObjectivesHierarchy(filter = {}, user = null) {
        const pool = await getPool();
        
        let query = `SELECT o.*, u.FirstName, u.LastName, u.Email FROM Objectives o LEFT JOIN Users u ON o.OwnerId = u.Id`;
        const request = pool.request();
        
        if (filter.sellerId) {
            query += ` WHERE o.SellerId = @sellerId`;
            request.input('sellerId', sql.VarChar, filter.sellerId);
        }
        
        query += ` ORDER BY o.CreatedAt DESC`;
        const objectivesResult = await request.query(query);
        const objectives = objectivesResult.recordset;

        for (const obj of objectives) {
            const krsResult = await pool.request()
                .input('objectiveId', sql.VarChar, obj.Id)
                .query(`SELECT kr.*, u.FirstName, u.LastName FROM KeyResults kr LEFT JOIN Users u ON kr.OwnerId = u.Id WHERE kr.ObjectiveId = @objectiveId`);
            obj.keyResults = krsResult.recordset;

            for (const kr of obj.keyResults) {
                const actionsResult = await pool.request()
                    .input('krId', sql.VarChar, kr.Id)
                    .query(`SELECT a.*, u.FirstName as AssignedFirstName, u.LastName as AssignedLastName, s.Name as SellerName 
                            FROM Actions a 
                            LEFT JOIN Users u ON a.AssignedTo = u.Id 
                            LEFT JOIN Sellers s ON a.SellerId = s.Id
                            WHERE a.KeyResultId = @krId 
                            ORDER BY 
                                CASE a.Priority 
                                    WHEN 'HIGH' THEN 1 
                                    WHEN 'MEDIUM' THEN 2 
                                    WHEN 'LOW' THEN 3 
                                    ELSE 4 
                                END`);
                kr.actions = actionsResult.recordset;
            }
        }

        return objectives;
    }

    /**
     * Update progress of an Objective based on its Key Results
     */
    async refreshProgress(objectiveId) {
        const pool = await getPool();
        
        const krsResult = await pool.request()
            .input('objectiveId', sql.VarChar, objectiveId)
            .query(`SELECT Progress FROM KeyResults WHERE ObjectiveId = @objectiveId`);
        
        const krs = krsResult.recordset;
        if (krs.length === 0) return 0;

        const totalProgress = krs.reduce((sum, kr) => sum + (kr.Progress || 0), 0);
        const avgProgress = totalProgress / krs.length;

        await pool.request()
            .input('id', sql.VarChar, objectiveId)
            .input('progress', sql.Decimal(5, 2), avgProgress)
            .query(`UPDATE Objectives SET Progress = @progress, UpdatedAt = GETDATE() WHERE Id = @id`);

        return avgProgress;
    }

    /**
     * Update an Objective
     */
    async updateObjective(id, data, userId) {
        const pool = await getPool();
        const { title, description, status, progress, sellerId, startDate, endDate } = data;

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('title', sql.NVarChar, title)
            .input('description', sql.NVarChar, description)
            .input('status', sql.NVarChar, status)
            .input('progress', sql.Decimal(5, 2), progress)
            .input('sellerId', sql.VarChar, sellerId)
            .input('startDate', sql.DateTime, startDate ? new Date(startDate) : null)
            .input('endDate', sql.DateTime, endDate ? new Date(endDate) : null)
            .query(`
                UPDATE Objectives SET
                    Title = COALESCE(@title, Title),
                    Description = COALESCE(@description, Description),
                    Status = COALESCE(@status, Status),
                    Progress = COALESCE(@progress, Progress),
                    SellerId = COALESCE(@sellerId, SellerId),
                    StartDate = COALESCE(@startDate, StartDate),
                    EndDate = COALESCE(@endDate, EndDate),
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);

        // Log activity
        const SystemLogService = require('./SystemLogService');
        await SystemLogService.log({
            level: 'INFO',
            module: 'OBJECTIVE',
            message: `Updated objective: ${title || id}`,
            userId: userId,
            metadata: JSON.stringify({ objectiveId: id })
        });

        return { id, ...data };
    }

    /**
     * Delete an Objective and its hierarchy (Key Results and Actions)
     */
    async deleteObjective(id, userId) {
        const pool = await getPool();
        
        // Actions will be deleted via cascading or manual cleanup
        // First delete actions associated with KRs of this objective
        await pool.request()
            .input('objectiveId', sql.VarChar, id)
            .query(`DELETE FROM Actions WHERE KeyResultId IN (SELECT Id FROM KeyResults WHERE ObjectiveId = @objectiveId)`);

        await pool.request()
            .input('objectiveId', sql.VarChar, id)
            .query(`DELETE FROM KeyResults WHERE ObjectiveId = @objectiveId`);

        await pool.request()
            .input('id', sql.VarChar, id)
            .query(`DELETE FROM Objectives WHERE Id = @id`);

        // Log activity
        const SystemLogService = require('./SystemLogService');
        await SystemLogService.log({
            level: 'WARN',
            module: 'OBJECTIVE',
            message: `Deleted objective and its hierarchy: ${id}`,
            userId: userId,
            metadata: JSON.stringify({ objectiveId: id })
        });

        return true;
    }

    /**
     * Synchronize progress for a specific Key Result (e.g. GMS tracking)
     */
    async syncKeyResultProgress(krId) {
        const pool = await getPool();
        const krResult = await pool.request()
            .input('krId', sql.VarChar, krId)
            .query(`SELECT kr.*, obj.SellerId, obj.StartDate, obj.EndDate 
                    FROM KeyResults kr 
                    JOIN Objectives obj ON kr.ObjectiveId = obj.Id 
                    WHERE kr.Id = @krId`);
        
        const kr = krResult.recordset[0];
        if (!kr) throw new Error('Key Result not found');

        if (kr.MetricType === 'GMS' && kr.SellerId) {
            const currentGms = await this.calculateCurrentGms(kr.SellerId, kr.StartDate, kr.EndDate);
            
            await pool.request()
                .input('krId', sql.VarChar, krId)
                .input('currentValue', sql.Decimal(18, 2), currentGms)
                .query(`UPDATE KeyResults SET CurrentValue = @currentValue, UpdatedAt = GETDATE() WHERE Id = @krId`);

            await this.refreshProgress(kr.ObjectiveId);
            return { ...kr, CurrentValue: currentGms };
        }

        return kr;
    }

    /**
     * Helper to calculate GMS for a seller in a given date range
     */
    async calculateCurrentGms(sellerId, startDate, endDate) {
        const pool = await getPool();
        
        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .input('start', sql.DateTime, new Date(startDate))
            .input('end', sql.DateTime, new Date(endDate))
            .query(`
                SELECT SUM(OrderedRevenue) as totalRevenue 
                FROM Orders 
                WHERE Date >= @start AND Date <= @end
                AND Asin IN (SELECT AsinCode FROM Asins WHERE SellerId = @sellerId)
            `);

        return result.recordset[0].totalRevenue || 0;
    }

    /**
     * Delete a Key Result and its associated Actions
     */
    async deleteKeyResult(id, userId) {
        const pool = await getPool();
        
        const krResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`SELECT ObjectiveId, Title FROM KeyResults WHERE Id = @id`);
        
        const kr = krResult.recordset[0];
        if (kr) {
            await pool.request().input('krId', sql.VarChar, id).query(`DELETE FROM Actions WHERE KeyResultId = @krId`);
            await pool.request().input('id', sql.VarChar, id).query(`DELETE FROM KeyResults WHERE Id = @id`);

            // Log activity
            const SystemLogService = require('./SystemLogService');
            await SystemLogService.log({
                level: 'WARN',
                module: 'KR',
                message: `Deleted key result: ${kr.Title}`,
                userId: userId,
                metadata: JSON.stringify({ krId: id })
            });

            // Refresh parent progress
            await this.refreshProgress(kr.ObjectiveId);
        }
        return true;
    }
}

module.exports = new ObjectiveService();
