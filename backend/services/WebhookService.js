/**
 * WebhookService.js
 * -----------------
 * Central outbound webhook dispatcher for Pabbly Connect integration.
 * Call WebhookService.fire(event, payload) from any controller/service.
 * Non-blocking — errors never crash the caller.
 */

const { sql, getPool, generateId } = require('../database/db');

// Event label map for human-readable email subjects
const EVENT_LABELS = {
  'task.created': 'Task Created',
  'task.assigned': 'Task Assigned',
  'task.started': 'Task Started',
  'task.submitted_for_review': 'Task Submitted for Review',
  'task.review_approved': 'Task Review Approved',
  'task.review_rejected': 'Task Review Rejected',
  'task.completed': 'Task Completed',
  'task.overdue': 'Task Overdue',
  'task.deleted': 'Task Deleted',
  'target.created': 'Target Created',
  'target.achieved': 'Target Achieved 🎉',
  'target.missed': 'Target Missed',
  'target.updated': 'Target Updated',
  'alert.triggered': 'Alert Triggered',
  'alert.critical': 'Critical Alert',
  'report.daily_summary': 'Daily Summary Report',
  'report.weekly_summary': 'Weekly Summary Report',
  'report.asin_sync_complete': 'ASIN Sync Completed',
  'report.optimization_scan': 'Optimization Scan Results',
  'okr.objective_created': 'New Objective Created',
  'okr.key_result_updated': 'Key Result Updated',
  'okr.objective_completed': 'Objective Completed 🏆',
};

/**
 * Fire a webhook event to all subscribed Pabbly URLs.
 * @param {string} event  - e.g. 'task.assigned'
 * @param {object} data   - event-specific payload
 */
async function fire(event, data = {}) {
  // Run completely async — never block the caller
  setImmediate(async () => {
    try {
      const pool = await getPool();

      // Fetch all active webhooks that subscribe to this event
      const result = await pool.request()
        .query(`SELECT * FROM Webhooks WHERE IsActive = 1`);

      const webhooks = result.recordset;
      if (!webhooks || webhooks.length === 0) return;

      const payload = buildPayload(event, data);

      for (const webhook of webhooks) {
        // Check if this webhook subscribes to this event
        let events = [];
        try { events = JSON.parse(webhook.Events || '[]'); } catch (_) { }

        const subscribesAll = events.includes('*') || events.length === 0;
        const subscribes = subscribesAll || events.includes(event);
        if (!subscribes) continue;

        await deliverWithRetry(pool, webhook, payload, event);
      }
    } catch (err) {
      // Silent — webhook errors must never crash the API
      console.error('[WebhookService] fire() error:', err.message);
    }
  });
}

/**
 * Build the standard Pabbly-compatible payload
 */
function buildPayload(event, data) {
  return {
    event,
    eventLabel: EVENT_LABELS[event] || event,
    timestamp: new Date().toISOString(),
    source: 'RetailOps',
    appUrl: process.env.FRONTEND_URL || 'https://data.brandcentral.in',
    data,
  };
}

/**
 * Deliver payload to one webhook URL, retry up to 3 times
 */
async function deliverWithRetry(pool, webhook, payload, event, attempt = 1) {
  const MAX_RETRIES = 3;
  const logId = generateId();
  let status = 0;
  let responseBody = '';
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(webhook.Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RetailOps-Webhook/1.0',
        'X-RetailOps-Event': payload.event,
        'X-RetailOps-Timestamp': payload.timestamp,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    status = res.status;
    responseBody = await res.text().catch(() => '');

    const duration = Date.now() - startedAt;

    // Log delivery
    await logDelivery(pool, {
      id: logId,
      webhookId: webhook.Id,
      event,
      status,
      duration,
      responseBody: responseBody.slice(0, 500),
      attempt,
      success: status >= 200 && status < 300,
    });

    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status}`);
    }

  } catch (err) {
    console.error(`[WebhookService] Delivery failed (attempt ${attempt}/${MAX_RETRIES}) for ${webhook.Url}: ${err.message}`);

    if (attempt < MAX_RETRIES) {
      const delay = attempt * 2000; // 2s, 4s backoff
      setTimeout(() => deliverWithRetry(pool, webhook, payload, event, attempt + 1), delay);
    } else {
      // Log final failure
      await logDelivery(pool, {
        id: logId + '_fail',
        webhookId: webhook.Id,
        event,
        status: status || 0,
        duration: Date.now() - startedAt,
        responseBody: err.message.slice(0, 500),
        attempt,
        success: false,
      }).catch(() => { });
    }
  }
}

/**
 * Log a webhook delivery attempt to WebhookLogs table
 */
async function logDelivery(pool, { id, webhookId, event, status, duration, responseBody, attempt, success }) {
  try {
    await pool.request()
      .input('Id', sql.VarChar, id)
      .input('WebhookId', sql.VarChar, webhookId)
      .input('Event', sql.NVarChar, event)
      .input('Status', sql.Int, status)
      .input('Duration', sql.Int, duration)
      .input('Response', sql.NVarChar, responseBody || '')
      .input('Attempt', sql.Int, attempt)
      .input('Success', sql.Bit, success ? 1 : 0)
      .query(`
        INSERT INTO WebhookLogs (Id, WebhookId, Event, HttpStatus, DurationMs, Response, Attempt, Success, CreatedAt)
        VALUES (@Id, @WebhookId, @Event, @Status, @Duration, @Response, @Attempt, @Success, dbo.GetEnvDate())
      `);
  } catch (e) {
    // Don't let log failures propagate
  }
}

/**
 * Send a test payload to a specific webhook URL (used by settings page)
 */
async function testWebhook(webhookId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, webhookId)
      .query('SELECT * FROM Webhooks WHERE Id = @id');

    if (!result.recordset[0]) throw new Error('Webhook not found');
    const webhook = result.recordset[0];

    const testPayload = buildPayload('task.assigned', {
      id: 'TEST-001',
      title: 'Nike India — Title Optimization (TEST)',
      type: 'TITLE_OPTIMIZATION',
      priority: 'HIGH',
      status: 'PENDING',
      description: 'This is a test event from RetailOps webhook settings.',
      seller: { name: 'Nike India', marketplace: 'Amazon.in' },
      assignedTo: { name: 'Test User', email: 'chintan.patel@brandcentral.in' },
      createdBy: { name: 'Admin' },
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      asinCount: 40,
      dashboardUrl: process.env.FRONTEND_URL || 'https://data.brandcentral.in',
      isTest: true,
    });

    await deliverWithRetry(pool, webhook, testPayload, 'task.assigned');
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = { fire, testWebhook, EVENT_LABELS };
