/**
 * PEMS Email Notification Service
 * Sends emails on task events using existing emailService
 */
const { sql, getPool } = require('../../database/db');
const emailService = require('../emailService');

const TEMPLATES = {
  TASK_ASSIGNED: (task, assignee) => ({
    subject: `[PEMS] Task Assigned: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">Task Assigned to You</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${assignee?.FirstName || 'Team'}</strong>,</p>
          <p>You have been assigned a new task:</p>
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode} · ${task.SellerName || ''} · ${task.Department || ''}</span><br/>
            <span style="color: #94a3b8;">Priority: ${task.Priority || 'MEDIUM'} · Due: ${task.DueDate ? new Date(task.DueDate).toLocaleDateString('en-IN') : 'Not set'}</span>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/pems/tasks" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Task</a>
        </div>
      </div>`
  }),

  TASK_SUBMITTED: (task, reviewer) => ({
    subject: `[PEMS] Task Submitted for Review: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #9333ea; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">Task Pending Your Review</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${reviewer?.FirstName || 'Reviewer'}</strong>,</p>
          <p>A task has been submitted for your review:</p>
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 4px solid #9333ea; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode} · ${task.SellerName || ''} · ${task.Department || ''}</span><br/>
            <span style="color: #94a3b8;">Submitted by: ${task.AssigneeName || 'Unknown'} · Achievement: ${task.AchievementPct || 0}%</span>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/pems/reviews" style="display: inline-block; background: #9333ea; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review Task</a>
        </div>
      </div>`
  }),

  TASK_APPROVED: (task, assignee) => ({
    subject: `[PEMS] Task Approved: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #16a34a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">Task Approved</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${assignee?.FirstName || 'Team'}</strong>,</p>
          <p>Your task has been approved:</p>
          <div style="background: #f0fdf4; padding: 12px; border-radius: 6px; border-left: 4px solid #16a34a; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode} · Achievement: ${task.AchievementPct || 0}%</span>
          </div>
        </div>
      </div>`
  }),

  TASK_REJECTED: (task, assignee) => ({
    subject: `[PEMS] Task Rejected: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">Task Rejected</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${assignee?.FirstName || 'Team'}</strong>,</p>
          <p>Your task has been rejected and requires rework:</p>
          <div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode}</span>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/pems/tasks" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View & Rework</a>
        </div>
      </div>`
  }),

  SLA_BREACH: (task, assignee) => ({
    subject: `[PEMS] SLA Breached: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">SLA Breach Alert</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${assignee?.FirstName || 'Team'}</strong>,</p>
          <p>The following task has breached its SLA:</p>
          <div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode} · SLA: ${task.SLAHours}h · Due: ${task.DueDate ? new Date(task.DueDate).toLocaleDateString('en-IN') : 'Past due'}</span>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/pems/tasks" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Take Action</a>
        </div>
      </div>`
  }),

  TASK_ESCALATED: (task, manager) => ({
    subject: `[PEMS] Task Escalated: ${task.Title || task.InstanceCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 16px;">Task Escalated</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p>Hi <strong>${manager?.FirstName || 'Manager'}</strong>,</p>
          <p>A task has been escalated to you:</p>
          <div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 16px 0;">
            <strong>${task.Title || 'Untitled Task'}</strong><br/>
            <span style="color: #64748b;">${task.InstanceCode} · ${task.SellerName || ''} · Priority: ${task.Priority}</span>
          </div>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/pems/tasks" style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review Escalation</a>
        </div>
      </div>`
  }),
};

async function getUserEmail(userId) {
  const pool = await getPool();
  const result = await pool.request().input('userId', sql.VarChar, userId)
    .query('SELECT Email, FirstName, LastName FROM Users WHERE Id = @userId');
  return result.recordset[0] || null;
}

async function triggerNotification(eventType, task, recipientId, details = {}) {
  try {
    const pool = await getPool();

    // Create in-app notification
    await pool.request()
      .input('id', sql.VarChar, genId())
      .input('taskInstanceId', sql.VarChar, task.Id || task._id)
      .input('userId', sql.VarChar, recipientId)
      .input('type', sql.VarChar, eventType)
      .input('title', sql.NVarChar, `${eventType.replace(/_/g, ' ').toLowerCase()}: ${task.Title || task.InstanceCode}`)
      .input('message', sql.NVarChar, details.message || '')
      .input('actionUrl', sql.NVarChar, details.actionUrl || '/pems/tasks')
      .query(`INSERT INTO PemsNotifications (Id, TaskInstanceId, UserId, Type, Title, Message, ActionUrl) 
              VALUES (@id, @taskInstanceId, @userId, @type, @title, @message, @actionUrl)`);

    // Send email notification
    const user = await getUserEmail(recipientId);
    if (user?.Email) {
      const template = TEMPLATES[eventType]?.(task, user);
      if (template) {
        emailService.send({ to: user.Email, subject: template.subject, html: template.html })
          .catch(err => console.warn(`Email notification failed for ${eventType}:`, err.message));
      }
    }

    // Emit socket event for real-time update
    try {
      const { SocketService } = require('./SocketService');
      const io = SocketService?.getIo?.();
      if (io) {
        io.emit('pems-notification', { type: eventType, taskId: task.Id, recipientId });
      }
    } catch {}

    return { success: true };
  } catch (err) {
    console.warn(`Notification trigger failed for ${eventType}:`, err.message);
    return { success: false, error: err.message };
  }
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

module.exports = { triggerNotification, TEMPLATES };
