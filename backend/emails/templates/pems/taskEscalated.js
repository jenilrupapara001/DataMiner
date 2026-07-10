const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ managerName, taskTitle, taskInstanceCode, assigneeName, reason, escalatedAt, priority }) =>
  renderEmail({
    theme: 'danger',
    eyebrow: 'Escalated to You',
    title: `"${taskTitle || taskInstanceCode}" has been escalated`,
    moduleName: 'Brand Central',
    previewText: `Escalated to you: ${taskTitle || taskInstanceCode}`,
    greetingName: managerName || 'Manager',
    introParagraph: 'A task has been escalated to you due to SLA breach or blocked status.\n\nYour review and intervention are required.',
    dataTitle: 'Escalation details',
    dataRows: [
      { label: 'Original assignee', value: assigneeName || '—' },
      { label: 'Reason', value: reason || 'SLA breach' },
      { label: 'Escalated at', value: escalatedAt ? new Date(escalatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—', nowrap: true },
      { label: 'Priority', value: priority || '—' },
    ],
    cta: { label: 'Review escalation', url: `${brand.dashboardUrl}/pems/tasks` },
    contextNote: 'You received this because a task was escalated to you on Brand Central.',
  });
