const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ assigneeName, taskTitle, taskInstanceCode, assignedBy, priority, dueDate, slaHours, sellerName }) =>
  renderEmail({
    theme: 'info',
    eyebrow: 'New Task',
    title: taskTitle || 'New task assigned',
    moduleName: 'Brand Central',
    previewText: `New task: ${taskTitle || taskInstanceCode}`,
    greetingName: assigneeName || 'Team',
    introParagraph: `${assignedBy || 'A team member'} has assigned you a new task.\n\nPlease review the details and get started.`,
    dataTitle: 'Task details',
    dataRows: [
      { label: 'Code', value: taskInstanceCode || '—' },
      { label: 'Priority', value: priority || 'Medium' },
      { label: 'Due date', value: dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set', nowrap: true },
      { label: 'SLA', value: slaHours ? `${slaHours} hours` : 'Not set' },
      { label: 'Seller', value: sellerName || '—' },
      { label: 'Assigned by', value: assignedBy || '—' },
    ],
    checklistTitle: 'Next steps',
    checklist: [
      'Open the task to review requirements and attachments',
      'Complete work within the SLA window to avoid breach',
      'Submit for review when ready',
    ],
    cta: { label: 'View task', url: `${brand.dashboardUrl}/pems/tasks` },
    contextNote: 'You received this because a new task has been assigned to you on Brand Central.',
  });
