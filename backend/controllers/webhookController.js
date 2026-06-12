/**
 * webhookController.js
 * --------------------
 * CRUD for Webhook configurations (Pabbly / any HTTP endpoint).
 * Stores configs in the Webhooks SQL table.
 */

const { sql, getPool, generateId } = require('../database/db');
const { testWebhook, EVENT_LABELS } = require('../services/WebhookService');

/**
 * GET /api/webhooks
 * List all webhook configs
 */
exports.getWebhooks = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT * FROM Webhooks ORDER BY CreatedAt DESC`);

    const webhooks = result.recordset.map(w => ({
      ...w,
      id: w.Id,
      events: JSON.parse(w.Events || '[]'),
      isActive: Boolean(w.IsActive),
    }));

    res.json({ success: true, data: webhooks });
  } catch (err) {
    console.error('[webhookController] getWebhooks error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/webhooks
 * Create a new webhook config
 */
exports.createWebhook = async (req, res) => {
  try {
    const { name, url, events = ['*'], description = '' } = req.body;
    const userId = req.user?.Id || req.user?._id;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'A valid HTTPS URL is required' });
    }

    const pool = await getPool();
    const id = generateId();

    await pool.request()
      .input('Id', sql.VarChar, id)
      .input('Name', sql.NVarChar, name || 'Unnamed Webhook')
      .input('Url', sql.NVarChar, url)
      .input('Events', sql.NVarChar, JSON.stringify(events))
      .input('Description', sql.NVarChar, description)
      .input('IsActive', sql.Bit, 1)
      .input('CreatedBy', sql.VarChar, userId || null)
      .query(`
        INSERT INTO Webhooks (Id, Name, Url, Events, Description, IsActive, CreatedBy, CreatedAt, UpdatedAt)
        VALUES (@Id, @Name, @Url, @Events, @Description, @IsActive, @CreatedBy, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

    const created = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM Webhooks WHERE Id = @id');

    const w = created.recordset[0];
    res.status(201).json({
      success: true,
      data: { ...w, id: w.Id, events: JSON.parse(w.Events || '[]'), isActive: Boolean(w.IsActive) }
    });
  } catch (err) {
    console.error('[webhookController] createWebhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/webhooks/:id
 * Update a webhook config
 */
exports.updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, description, isActive } = req.body;
    const pool = await getPool();

    const updates = [];
    const request = pool.request();
    let idx = 0;

    if (name !== undefined)        { updates.push(`Name = @p${idx}`);        request.input(`p${idx++}`, sql.NVarChar, name); }
    if (url !== undefined)         { updates.push(`Url = @p${idx}`);         request.input(`p${idx++}`, sql.NVarChar, url); }
    if (events !== undefined)      { updates.push(`Events = @p${idx}`);      request.input(`p${idx++}`, sql.NVarChar, JSON.stringify(events)); }
    if (description !== undefined) { updates.push(`Description = @p${idx}`); request.input(`p${idx++}`, sql.NVarChar, description); }
    if (isActive !== undefined)    { updates.push(`IsActive = @p${idx}`);    request.input(`p${idx++}`, sql.Bit, isActive ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    updates.push('UpdatedAt = dbo.GetEnvDate()');
    request.input('id', sql.VarChar, id);
    await request.query(`UPDATE Webhooks SET ${updates.join(', ')} WHERE Id = @id`);

    const updated = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM Webhooks WHERE Id = @id');

    if (!updated.recordset[0]) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    const w = updated.recordset[0];
    res.json({
      success: true,
      data: { ...w, id: w.Id, events: JSON.parse(w.Events || '[]'), isActive: Boolean(w.IsActive) }
    });
  } catch (err) {
    console.error('[webhookController] updateWebhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook config
 */
exports.deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    await pool.request()
      .input('id', sql.VarChar, id)
      .query('DELETE FROM Webhooks WHERE Id = @id');

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/webhooks/:id/test
 * Send a test event to verify the webhook URL
 */
exports.testWebhookById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await testWebhook(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/webhooks/logs
 * Get last 50 delivery log entries
 */
exports.getWebhookLogs = async (req, res) => {
  try {
    const pool = await getPool();
    const { webhookId } = req.query;

    let where = '1=1';
    const request = pool.request();

    if (webhookId) {
      where = 'l.WebhookId = @wid';
      request.input('wid', sql.VarChar, webhookId);
    }

    const result = await request.query(`
      SELECT TOP 50
        l.Id, l.WebhookId, l.Event, l.HttpStatus, l.DurationMs,
        l.Response, l.Attempt, l.Success, l.CreatedAt,
        w.Name as WebhookName, w.Url as WebhookUrl
      FROM WebhookLogs l
      LEFT JOIN Webhooks w ON l.WebhookId = w.Id
      WHERE ${where}
      ORDER BY l.CreatedAt DESC
    `);

    res.json({
      success: true,
      data: result.recordset.map(r => ({ ...r, success: Boolean(r.Success) }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/webhooks/events
 * Return all available event types (for UI checkboxes)
 */
exports.getEventTypes = async (req, res) => {
  const events = Object.entries(EVENT_LABELS).map(([key, label]) => ({
    key,
    label,
    category: key.split('.')[0],
  }));
  res.json({ success: true, data: events });
};
