const { sql, getPool, generateId } = require('../database/db');

/**
 * Get all API keys (masked values)
 */
exports.getKeys = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT a.*, u.FirstName + ' ' + u.LastName as CreatedByName
                FROM ApiKeys a
                LEFT JOIN Users u ON a.OwnerId = u.Id
                ORDER BY a.CreatedAt DESC
            `);

        const maskedKeys = result.recordset.map(k => {
            const val = k.Value;
            let masked = val;
            if (val && val.length > 8) {
                masked = val.slice(0, 4) + '•'.repeat(Math.max(6, val.length - 8)) + val.slice(-4);
            } else if (val) {
                masked = '•'.repeat(val.length);
            }
            return {
                ...k,
                _id: k.Id,
                value: masked,
                createdBy: k.OwnerId,
                createdByName: k.CreatedByName,
                createdAt: k.CreatedAt,
                updatedAt: k.UpdatedAt
            };
        });

        res.json({ success: true, data: maskedKeys });
    } catch (error) {
        console.error('Get API Keys Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Create a new API key
 */
exports.createKey = async (req, res) => {
    try {
        const { name, serviceId, value, category, description } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('Name', sql.NVarChar, name)
            .input('ServiceId', sql.NVarChar, serviceId)
            .input('Value', sql.NVarChar, value)
            .input('Category', sql.NVarChar, category || 'Other')
            .input('Description', sql.NVarChar, description || '')
            .input('OwnerId', sql.VarChar, userId)
            .input('IsActive', sql.Bit, 1)
            .query(`
                INSERT INTO ApiKeys (Id, Name, ServiceId, Value, Category, Description, OwnerId, IsActive, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, @ServiceId, @Value, @Category, @Description, @OwnerId, @IsActive, GETDATE(), GETDATE())
            `);

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`
                SELECT a.*, u.FirstName + ' ' + u.LastName as CreatedByName
                FROM ApiKeys a
                LEFT JOIN Users u ON a.OwnerId = u.Id
                WHERE a.Id = @id
            `);

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        if (error.message.includes('UNIQUE') || error.message.includes('duplicate')) {
            return res.status(400).json({ success: false, message: 'Service ID must be unique' });
        }
        console.error('Create API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Update an API key
 */
exports.updateKey = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, serviceId, value, category, description, isActive } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (name) { updates.push(`Name = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, name); }
        if (serviceId) { updates.push(`ServiceId = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, serviceId); }
        if (value) { updates.push(`Value = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, value); }
        if (category) { updates.push(`Category = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, category); }
        if (description !== undefined) { updates.push(`Description = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, description); }
        if (isActive !== undefined) { updates.push(`IsActive = @p${idx++}`); request.input(`p${idx-1}`, sql.Bit, isActive ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No updates provided' });
        }

        updates.push(`UpdatedAt = GETDATE()`);

        request.input('id', sql.VarChar, id);
        const sqlText = `UPDATE ApiKeys SET ${updates.join(', ')} WHERE Id = @id; SELECT * FROM ApiKeys WHERE Id = @id`;
        const result = await request.query(sqlText);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error('Update API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete an API key
 */
exports.deleteKey = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM ApiKeys WHERE Id = @id; SELECT @@ROWCOUNT as deleted");

        if (result.recordset[1]?.[0]?.deleted === 0) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, message: 'Key deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Reveal an API key value
 */
exports.revealKey = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT Value FROM ApiKeys WHERE Id = @id");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, value: result.recordset[0].Value });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
