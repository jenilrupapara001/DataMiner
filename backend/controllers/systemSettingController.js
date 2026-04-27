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
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('key', sql.NVarChar, 'octoparse_automation_enabled')
      .query('SELECT Value FROM SystemSettings WHERE [Key] = @key');
    
    const enabled = result.recordset[0]?.Value === 'true' || result.recordset[0]?.Value === true;
    
    res.json({
      success: true,
      data: { enabled }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Toggle Octoparse automation on/off
 * POST /api/settings/octoparse-automation
 */
exports.toggleOctoparseAutomation = async (req, res) => {
  try {
    const { enabled } = req.body;
    const pool = await getPool();
    
    // Upsert the setting
    await pool.request()
      .input('key', sql.NVarChar, 'octoparse_automation_enabled')
      .input('value', sql.NVarChar, String(enabled === true))
      .query(`
        IF EXISTS (SELECT 1 FROM SystemSettings WHERE [Key] = @key)
          UPDATE SystemSettings SET Value = @value, UpdatedAt = GETDATE() WHERE [Key] = @key
        ELSE
          INSERT INTO SystemSettings ([Key], Value, CreatedAt, UpdatedAt) VALUES (@key, @value, GETDATE(), GETDATE())
      `);
    
    // Also update environment variable in memory
    process.env.AUTOMATION_ENABLED = String(enabled === true);
    
    console.log(`🔧 Octoparse Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    res.json({
      success: true,
      data: { enabled: enabled === true },
      message: `Octoparse automation ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
