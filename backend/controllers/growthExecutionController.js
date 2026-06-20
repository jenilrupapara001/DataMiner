const { sql, getPool } = require('../database/db');

/**
 * Get current goal (stub)
 */
exports.getCurrentGoal = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query("SELECT TOP 1 * FROM Goals ORDER BY CreatedAt DESC");
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get performance analytics (stub)
 */
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const pool = await getPool();
        const result = await pool.request()
            .input('tf', sql.Int, parseInt(timeframe) || 30)
            .query(`
                SELECT COUNT(*) as totalAsins, COUNT(DISTINCT SellerId) as totalSellers
                FROM Asins
                WHERE CreatedAt >= DATEADD(DAY, -@tf, dbo.GetEnvDate())
            `);
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get filtered tasks (stub)
 */
exports.getFilteredTasks = async (req, res) => {
    try {
        const { status, priority, assignedTo, stage } = req.query;
        const pool = await getPool();
        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (status) { whereClause += " AND Status = @status"; request.input('status', sql.NVarChar, status); }
        if (priority) { whereClause += " AND Priority = @priority"; request.input('priority', sql.NVarChar, priority); }

        const result = await request.query(`
            SELECT a.*, u.FirstName + ' ' + u.LastName as AssignedToName
            FROM Actions a
            LEFT JOIN Users u ON a.AssignedTo = u.Id
            ${whereClause}
            ORDER BY a.CreatedAt DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get intelligence insights (stub)
 */
exports.getIntelligenceInsights = async (req, res) => {
    try {
        const pool = await getPool();
        
        // Run all 3 queries in parallel instead of sequential
        const [sellersResult, asinsResult, actionsResult] = await Promise.all([
            pool.request().query("SELECT COUNT(*) as count FROM Sellers WHERE IsActive = 1"),
            pool.request().query("SELECT COUNT(*) as count FROM Asins"),
            pool.request().query("SELECT COUNT(*) as count FROM Actions WHERE Status != 'COMPLETED'")
        ]);

        res.json({
            success: true,
            data: {
                totalActiveSellers: sellersResult.recordset[0].count,
                totalAsins: asinsResult.recordset[0].count,
                pendingActions: actionsResult.recordset[0].count,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};