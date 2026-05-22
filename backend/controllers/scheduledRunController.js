const { sql, getPool } = require('../database/db');
const SchedulerService = require('../services/schedulerService');

/**
 * Scheduled Run Controller
 * Handles reporting, analytics, and manual triggering of the enterprise pipeline runs.
 */
class ScheduledRunController {
    /**
     * Get all scheduled runs sorted by StartTime DESC
     */
    async getScheduledRuns(req, res) {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT Id, StartTime, EndTime, Status, CreatedAt, UpdatedAt
                FROM ScheduledRuns
                ORDER BY StartTime DESC
            `);

            res.json({
                success: true,
                data: result.recordset
            });
        } catch (err) {
            console.error('❌ Failed to get scheduled runs:', err.message);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch scheduled runs',
                error: err.message
            });
        }
    }

    /**
     * Get details (seller-wise metrics) for a specific run
     */
    async getScheduledRunDetails(req, res) {
        const { id } = req.params;
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('id', sql.VarChar, id)
                .query(`
                    SELECT Id, StartTime, EndTime, Status, Details, CreatedAt, UpdatedAt
                    FROM ScheduledRuns
                    WHERE Id = @id
                `);

            if (result.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Scheduled run not found'
                });
            }

            const run = result.recordset[0];

            // Parse details if it is a JSON string
            let parsedDetails = [];
            if (run.Details) {
                try {
                    parsedDetails = JSON.parse(run.Details);
                } catch (jsonErr) {
                    parsedDetails = run.Details;
                }
            }

            res.json({
                success: true,
                data: {
                    ...run,
                    Details: parsedDetails
                }
            });
        } catch (err) {
            console.error(`❌ Failed to get scheduled run details for ${id}:`, err.message);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch scheduled run details',
                error: err.message
            });
        }
    }

    /**
     * Manually triggers the enterprise automation pipeline
     */
    async triggerScheduledRun(req, res) {
        try {
            const marketplace = req.query.marketplace || req.body.marketplace || 'amazon';
            console.log(`🚀 [MANUAL TRIGGER] ${marketplace.toUpperCase()} Enterprise Pipeline requested by user...`);

            // Trigger in the background to avoid HTTP timeout
            SchedulerService.runEnterprisePipeline(marketplace).catch(err => {
                console.error(`❌ Manual enterprise pipeline failed in background for ${marketplace}:`, err.message);
            });

            res.json({
                success: true,
                message: `${marketplace.toUpperCase()} pipeline manually triggered in background. Monitor progress below.`
            });
        } catch (err) {
            console.error('❌ Failed to trigger scheduled run:', err.message);
            res.status(500).json({
                success: false,
                message: 'Failed to trigger enterprise pipeline',
                error: err.message
            });
        }
    }

    /**
     * Get seller-level metrics aggregated from all scheduled runs
     */
    async getSellerMetrics(req, res)
        {
            try {
                const pool = await getPool();
                const result = await pool.request().query(`
                SELECT Details
                FROM ScheduledRuns
                ORDER BY StartTime ASC
            `);

                const metrics = {};

                for (let row of result.recordset) {
                    if (row.Details) {
                        let details;
                        try {
                            details = typeof row.Details === 'string' ? JSON.parse(row.Details) : row.Details;
                        } catch (e) {
                            continue;
                        }

                        if (Array.isArray(details)) {
                            for (let seller of details) {
                                if (!seller.sellerId) continue;

                                if (!metrics[seller.sellerId]) {
                                    metrics[seller.sellerId] = {
                                        sellerId: seller.sellerId,
                                        name: seller.name || 'Unknown',
                                        totalRuns: 0,
                                        totalInserted: 0,
                                        totalExpected: 0,
                                        failedRuns: 0,
                                        completedRuns: 0,
                                        runningRuns: 0,
                                        lastRunDate: null,
                                        lastRunStatus: null,
                                        lastRunDuration: null
                                    };
                                }

                                const sm = metrics[seller.sellerId];
                                sm.totalRuns++;
                                sm.totalInserted += (seller.count || 0);
                                sm.totalExpected += (seller.asinsCount || 0);

                                if (seller.status === 'FAILED') sm.failedRuns++;
                                else if (seller.status === 'COMPLETED') sm.completedRuns++;
                                else if (seller.status === 'RUNNING') sm.runningRuns++;

                                // Update last run since query is sorted ASC (oldest to newest)
                                sm.lastRunDate = seller.startTime || sm.lastRunDate;
                                sm.lastRunStatus = seller.status || sm.lastRunStatus;
                                if (seller.startTime && seller.endTime) {
                                    sm.lastRunDuration = new Date(seller.endTime) - new Date(seller.startTime);
                                }
                            }
                        }
                    }
                }

                res.json({
                    success: true,
                    data: Object.values(metrics)
                });
            } catch (err) {
                console.error('❌ Failed to get seller metrics:', err.message);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch seller metrics',
                    error: err.message
                });
            }
        }

    /**
     * Get detailed task logs for a specific seller from historical runs
     */
    async getSellerLogs(req, res) {
        const { sellerId } = req.params;
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT Id AS runId, Details, CreatedAt
                FROM ScheduledRuns
                ORDER BY StartTime DESC
            `);
            
            const logs = [];
            
            for (let row of result.recordset) {
                if (row.Details) {
                    let details;
                    try {
                        details = typeof row.Details === 'string' ? JSON.parse(row.Details) : row.Details;
                    } catch (e) {
                        continue;
                    }
                    
                    if (Array.isArray(details)) {
                        const sellerData = details.find(d => d.sellerId === sellerId);
                        if (sellerData) {
                            logs.push({
                                runId: row.runId,
                                createdAt: row.CreatedAt,
                                startTime: sellerData.startTime,
                                endTime: sellerData.endTime,
                                status: sellerData.status,
                                asinsCount: sellerData.asinsCount,
                                count: sellerData.count,
                                error: sellerData.error
                            });
                        }
                    }
                }
            }
            
            // Sort from newest to oldest based on startTime or createdAt
            logs.sort((a, b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt));

            res.json({
                success: true,
                data: logs
            });
        } catch (err) {
            console.error(`❌ Failed to get seller logs for ${sellerId}:`, err.message);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch seller logs',
                error: err.message
            });
        }
    }
}

module.exports = new ScheduledRunController();
