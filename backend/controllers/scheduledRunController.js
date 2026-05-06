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
            console.log('🚀 [MANUAL TRIGGER] Enterprise Pipeline requested by user...');
            
            // Trigger in the background to avoid HTTP timeout
            SchedulerService.runEnterprisePipeline().catch(err => {
                console.error('❌ Manual enterprise pipeline failed in background:', err.message);
            });

            res.json({
                success: true,
                message: 'Nightly Scheduled pipeline manually triggered in background. Monitor progress below.'
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
}

module.exports = new ScheduledRunController();
