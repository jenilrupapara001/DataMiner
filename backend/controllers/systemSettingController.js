const { sql, getPool } = require('../database/db');

/**
 * Get all settings (SQL Version)
 */
exports.getSettings = async (req, res) => {
    try {
        const { group } = req.query;
        let whereClause = 'WHERE 1=1';
        const request = (await getPool()).request();

        if (group) {
            whereClause += " AND [Key] LIKE @groupPattern";
            request.input('groupPattern', sql.NVarChar, `${group}%`);
        }

        const result = await request.query(`
            SELECT * FROM SystemSettings ${whereClause} ORDER BY [Key]
        `);

        const settingsMap = {};
        result.recordset.forEach(s => {
            settingsMap[s.Key] = s.Value;
        });

        res.json({ success: true, data: settingsMap });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get setting by key
 */
exports.getSettingByKey = async (req, res) => {
    try {
        const { key } = req.params;
        
        if (key === 'AUTOMATION_ENABLED') {
            return res.json({ success: true, data: { Key: 'AUTOMATION_ENABLED', Value: 'true' } });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('key', sql.NVarChar, key)
            .query("SELECT * FROM SystemSettings WHERE [Key] = @key");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update settings (upsert)
 */
exports.updateSettings = async (req, res) => {
    try {
        const { settings, group } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid settings data' });
        }

        const pool = await getPool();
        const userId = req.user?.Id || req.user?._id;

        for (const [key, value] of Object.entries(settings)) {
            await pool.request()
                .input('key', sql.NVarChar, key)
                .input('val', sql.NVarChar, String(value))
                .input('desc', sql.NVarChar, `${group || 'general'}.${key}`)
                .input('updatedBy', sql.VarChar, userId || null)
                .query(`
                    MERGE SystemSettings AS target
                    USING (SELECT @key AS [Key]) AS source
                    ON target.[Key] = source.[Key]
                    WHEN MATCHED THEN
                        UPDATE SET Value = @val, UpdatedAt = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT ([Key], Value, Description, CreatedAt, UpdatedAt)
                        VALUES (@key, @val, @desc, GETDATE(), GETDATE());
                `);
        }

        // Dynamically trigger rescheduling if schedule settings were updated
        const keys = Object.keys(settings);
        if (keys.includes('AUTOMATION_SCHEDULE_TIME') || keys.includes('AUTOMATION_AJIO_SCHEDULE_TIME') || keys.includes('AUTOMATION_ENABLED')) {
            try {
                const SchedulerService = require('../services/schedulerService');
                // Use a non-blocking background invocation so response returns immediately
                SchedulerService.reschedule().catch(err => {
                    console.error('❌ Error during background dynamic rescheduling:', err.message);
                });
            } catch (schedErr) {
                console.error('❌ Scheduler reschedule import failed:', schedErr.message);
            }
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.testEmail = async (req, res) => {
    res.json({ success: true, message: 'Email test not implemented yet' });
};

/**
 * Get Octoparse automation status
 * GET /api/settings/octoparse-automation
 */
exports.getOctoparseAutomation = async (req, res) => {
  res.json({
    success: true,
    data: { enabled: true }
  });
};

/**
 * Toggle Octoparse automation on/off
 * POST /api/settings/octoparse-automation
 */
exports.toggleOctoparseAutomation = async (req, res) => {
  res.json({
    success: true,
    data: { enabled: true },
    message: `Octoparse automation is forced to enabled globally`
  });
};

/**
 * Get scheduler config (schedule time + automation flag) from DB/Environment
 * GET /api/settings/schedule-config
 */
exports.getScheduleConfig = async (req, res) => {
    try {
        const pool = await getPool();
        const settingsResult = await pool.request().query("SELECT [Key], Value FROM SystemSettings WHERE [Key] IN ('AUTOMATION_SCHEDULE_TIME', 'AUTOMATION_AJIO_SCHEDULE_TIME', 'AUTOMATION_ENABLED')");
        
        const settingsMap = {};
        settingsResult.recordset.forEach(s => {
            settingsMap[s.Key] = s.Value;
        });

        const scheduleTime = settingsMap['AUTOMATION_SCHEDULE_TIME'] || process.env.AUTOMATION_SCHEDULE_TIME || '11:20';
        const ajioScheduleTime = settingsMap['AUTOMATION_AJIO_SCHEDULE_TIME'] || process.env.AUTOMATION_AJIO_SCHEDULE_TIME || '12:00';
        const automationEnabled = settingsMap['AUTOMATION_ENABLED'] !== undefined 
            ? settingsMap['AUTOMATION_ENABLED'] === 'true'
            : process.env.AUTOMATION_ENABLED === 'true';

        res.json({
            success: true,
            data: {
                scheduleTime,
                ajioScheduleTime,
                automationEnabled
            }
        });
    } catch (error) {
        console.error('Error in getScheduleConfig:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
