/**
 * PEMS Email Notification Service
 * Sends emails on task events using unified design system
 */
const { sql, getPool } = require('../../database/db');
const emailService = require('../emailService');
const {
  taskAssigned,
  taskSubmitted,
  taskApproved,
  taskRejected,
  slaBreach,
  taskEscalated,
} = require('../../emails');

const TEMPLATES = {
  TASK_ASSIGNED: (task, assignee) => ({
    subject: `[PEMS] Task Assigned: ${task.Title || task.InstanceCode}`,
    html: taskAssigned({
      assigneeName: assignee?.FirstName || 'Team',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      assignedBy: task.AssigneeName || 'System',
      priority: task.Priority,
      dueDate: task.DueDate,
      slaHours: task.SLAHours,
      sellerName: task.SellerName,
      department: task.Department,
      taskId: task.Id,
    }),
  }),

  TASK_SUBMITTED: (task, reviewer) => ({
    subject: `[PEMS] Task Submitted for Review: ${task.Title || task.InstanceCode}`,
    html: taskSubmitted({
      reviewerName: reviewer?.FirstName || 'Reviewer',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      submittedBy: task.AssigneeName || 'Unknown',
      submittedAt: task.CompletedAt || task.UpdatedAt,
      timeTaken: task.TimeTaken || '-',
      priority: task.Priority,
      sellerName: task.SellerName,
      taskId: task.Id,
    }),
  }),

  TASK_APPROVED: (task, assignee) => ({
    subject: `[PEMS] Task Approved: ${task.Title || task.InstanceCode}`,
    html: taskApproved({
      assigneeName: assignee?.FirstName || 'Team',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      approvedBy: task.ReviewerName || 'Reviewer',
      approvedAt: task.ReviewedAt || task.UpdatedAt,
      feedback: task.Feedback,
      taskId: task.Id,
    }),
  }),

  TASK_REJECTED: (task, assignee) => ({
    subject: `[PEMS] Task Rejected: ${task.Title || task.InstanceCode}`,
    html: taskRejected({
      assigneeName: assignee?.FirstName || 'Team',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      reviewedBy: task.ReviewerName || 'Reviewer',
      reviewedAt: task.ReviewedAt || task.UpdatedAt,
      feedback: task.Feedback,
      taskId: task.Id,
    }),
  }),

  SLA_BREACH: (task, assignee) => ({
    subject: `[PEMS] SLA Breached: ${task.Title || task.InstanceCode}`,
    html: slaBreach({
      recipientName: assignee?.FirstName || 'Team',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      assigneeName: task.AssigneeName,
      slaHours: task.SLAHours,
      overdueBy: task.OverdueBy || '-',
      priority: task.Priority,
      taskId: task.Id,
    }),
  }),

  TASK_ESCALATED: (task, manager) => ({
    subject: `[PEMS] Task Escalated: ${task.Title || task.InstanceCode}`,
    html: taskEscalated({
      managerName: manager?.FirstName || 'Manager',
      taskTitle: task.Title,
      taskInstanceCode: task.InstanceCode,
      assigneeName: task.AssigneeName,
      reason: task.EscalationReason || task.Feedback || 'SLA breach',
      escalatedAt: task.EscalatedAt || task.UpdatedAt,
      priority: task.Priority,
      taskId: task.Id,
    }),
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
      const { SocketService } = require('../SocketService');
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
