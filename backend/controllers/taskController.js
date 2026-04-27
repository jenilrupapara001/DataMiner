const { sql, getPool, generateId } = require('../database/db');
const TaskAnalyzer = require('../utils/taskAnalyzer');

/**
 * Generate tasks from selected ASINs
 * POST /api/tasks/generate
 */
exports.generateTasks = async (req, res) => {
    try {
        const { asinIds } = req.body;
        
        if (!asinIds || !Array.isArray(asinIds) || asinIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No ASINs selected' });
        }

        const pool = await getPool();
        
        // Fetch ASINs
        const asinResult = await pool.request()
            .query(`SELECT a.*, s.Name as SellerName FROM Asins a LEFT JOIN Sellers s ON a.SellerId = s.Id WHERE a.Id IN (${asinIds.map(id => `'${id}'`).join(',')})`);
        
        if (asinResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'No ASINs found' });
        }

        // Analyze and generate tasks
        const { tasks: generatedTasks, summary } = await TaskAnalyzer.analyzeMultiple(asinResult.recordset);

        // Fetch seller-user mappings for auto-assignment
        const sellerUsersResult = await pool.request().query('SELECT SellerId, UserId FROM UserSellers');
        const sellerUserMap = {};
        sellerUsersResult.recordset.forEach(row => {
            // Map each seller to its first associated user
            if (!sellerUserMap[row.SellerId]) sellerUserMap[row.SellerId] = row.UserId;
        });

        // Save tasks to database
        const creatorId = (req.user?._id || req.user?.id || '').toString();
        let savedCount = 0;

        for (const task of generatedTasks) {
            const taskId = generateId();
            const assignedUserId = task.sellerId ? sellerUserMap[task.sellerId] : null;
            
            try {
                await pool.request()
                    .input('id', sql.VarChar, taskId)
                    .input('title', sql.NVarChar, task.title)
                    .input('description', sql.NVarChar, task.description)
                    .input('category', sql.NVarChar, task.category)
                    .input('priority', sql.NVarChar, task.priority)
                    .input('status', sql.NVarChar, 'To-Do')
                    .input('type', sql.NVarChar, task.type)
                    .input('asinId', sql.VarChar, task.asinId)
                    .input('asinCode', sql.NVarChar, task.asinCode)
                    .input('sellerId', sql.VarChar, task.sellerId || null)
                    .input('sellerName', sql.NVarChar, task.sellerName)
                    .input('createdBy', sql.VarChar, creatorId)
                    .input('assignedTo', sql.VarChar, assignedUserId)
                    .input('impactScore', sql.Int, task.impactScore || 0)
                    .input('effortEstimate', sql.NVarChar, task.effortEstimate)
                    .input('isAIGenerated', sql.Bit, 1)
                    .input('aiReasoning', sql.NVarChar, task.aiReasoning)
                    .query(`
                        INSERT INTO Tasks (Id, Title, Description, Category, Priority, Status, Type,
                            AsinId, AsinCode, SellerId, SellerName, CreatedBy, AssignedTo,
                            ImpactScore, EffortEstimate, IsAIGenerated, AIReasoning, CreatedAt, UpdatedAt)
                        VALUES (@id, @title, @description, @category, @priority, @status, @type,
                            @asinId, @asinCode, @sellerId, @sellerName, @createdBy, @assignedTo,
                            @impactScore, @effortEstimate, @isAIGenerated, @aiReasoning, GETDATE(), GETDATE())
                    `);
                savedCount++;
            } catch (e) {
                console.error(`Failed to save task: ${task.title}`, e.message);
            }
        }

        res.json({
            success: true,
            message: `Generated and saved ${savedCount} optimization tasks from ${summary.analyzed} ASINs`,
            savedCount,
            summary
        });
    } catch (error) {
        console.error('Generate Tasks Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get all tasks with filters
 * GET /api/tasks
 */
exports.getTasks = async (req, res) => {
    try {
        const { status, category, priority, sellerId, asinId, search, page = 1, limit = 50 } = req.query;
        const pool = await getPool();
        
        let whereClause = 'WHERE 1=1';
        const params = {};

        if (status && status !== 'all') {
            whereClause += ' AND Status = @status';
            params.status = status;
        }
        if (category) {
            whereClause += ' AND Category = @category';
            params.category = category;
        }
        if (priority) {
            whereClause += ' AND Priority = @priority';
            params.priority = priority;
        }
        if (sellerId) {
            whereClause += ' AND SellerId = @sellerId';
            params.sellerId = sellerId;
        }
        if (asinId) {
            whereClause += ' AND AsinId = @asinId';
            params.asinId = asinId;
        }
        if (search) {
            whereClause += ' AND (Title LIKE @search OR AsinCode LIKE @search OR SellerName LIKE @search)';
            params.search = `%${search}%`;
        }

        // Count Total
        const countRequest = pool.request();
        Object.entries(params).forEach(([key, val]) => countRequest.input(key, val));
        const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM Tasks ${whereClause}`);
        const total = countResult.recordset[0].total;

        // Fetch Paginated Tasks
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const taskRequest = pool.request();
        Object.entries(params).forEach(([key, val]) => taskRequest.input(key, val));
        taskRequest.input('offset', sql.Int, offset);
        taskRequest.input('limit', sql.Int, parseInt(limit));

        const result = await taskRequest.query(`
            SELECT t.*, 
                u.FirstName as AssignedToFirstName, u.LastName as AssignedToLastName,
                cu.FirstName as CreatedByFirstName, cu.LastName as CreatedByLastName
            FROM Tasks t
            LEFT JOIN Users u ON t.AssignedTo = u.Id
            LEFT JOIN Users cu ON t.CreatedBy = cu.Id
            ${whereClause}
            ORDER BY 
                CASE t.Priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END,
                t.CreatedAt DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        // Map to camelCase for frontend consistency
        const tasks = result.recordset.map(t => ({
            id: t.Id,
            _id: t.Id,
            title: t.Title,
            description: t.Description,
            category: t.Category,
            priority: t.Priority,
            status: t.Status,
            type: t.Type,
            asinId: t.AsinId,
            asinCode: t.AsinCode,
            sellerId: t.SellerId,
            sellerName: t.SellerName,
            assignedTo: t.AssignedTo,
            assignedToName: t.AssignedToFirstName ? `${t.AssignedToFirstName} ${t.AssignedToLastName || ''}`.trim() : null,
            createdBy: t.CreatedBy,
            createdByName: t.CreatedByFirstName ? `${t.CreatedByFirstName} ${t.CreatedByLastName || ''}`.trim() : null,
            createdAt: t.CreatedAt,
            updatedAt: t.UpdatedAt,
            impactScore: t.ImpactScore,
            effortEstimate: t.EffortEstimate,
            isAIGenerated: t.IsAIGenerated,
            aiReasoning: t.AIReasoning,
            tags: (() => { try { return JSON.parse(t.Tags || '[]'); } catch { return []; } })()
        }));

        // Get status counts
        const statusCounts = await pool.request().query(`
            SELECT Status, COUNT(*) as count FROM Tasks GROUP BY Status
        `);
        const counts = { todo: 0, inProgress: 0, inReview: 0, completed: 0 };
        statusCounts.recordset.forEach(r => {
            if (r.Status === 'To-Do') counts.todo = r.count;
            if (r.Status === 'In Progress') counts.inProgress = r.count;
            if (r.Status === 'In Review') counts.inReview = r.count;
            if (r.Status === 'Completed') counts.completed = r.count;
        });

        res.json({
            success: true,
            data: {
                tasks,
                counts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get Tasks Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update task status
 * PUT /api/tasks/:id/status
 */
exports.updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, completionRemarks } = req.body;
        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        let setClause = 'Status = @status, UpdatedAt = GETDATE()';
        const request = pool.request()
            .input('id', sql.VarChar, id)
            .input('status', sql.NVarChar, status);

        if (status === 'In Progress') {
            setClause += ', StartTime = GETDATE()';
        }
        if (status === 'Completed') {
            setClause += ', CompletedAt = GETDATE(), CompletedBy = @userId';
            request.input('userId', sql.VarChar, userId);
            if (completionRemarks) {
                setClause += ', CompletionRemarks = @remarks';
                request.input('remarks', sql.NVarChar, completionRemarks);
            }
        }

        await request.query(`UPDATE Tasks SET ${setClause} WHERE Id = @id`);

        res.json({ success: true, message: `Task marked as ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Assign task to user
 * PUT /api/tasks/:id/assign
 */
exports.assignTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const pool = await getPool();

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query('UPDATE Tasks SET AssignedTo = @userId, UpdatedAt = GETDATE() WHERE Id = @id');

        res.json({ success: true, message: 'Task assigned' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete task
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Tasks WHERE Id = @id');
        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
