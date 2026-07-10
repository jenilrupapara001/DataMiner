const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ recipientName, taskTitle, taskInstanceCode, assigneeName, slaHours, overdueBy, priority }) =>
  renderEmail({
    theme: 'warning',
    eyebrow: 'SLA Breach',
    title: 'A task has breached its SLA',
    moduleName: 'Brand Central',
    previewText: `SLA breach: ${taskTitle || taskInstanceCode}`,
    greetingName: recipientName || 'Team',
    introParagraph: 'A task has breached its service level agreement and requires immediate attention.',
    alert: { title: 'Overdue', text: `This task is now ${overdueBy || 'overdue past'} its ${slaHours || '—'}-hour SLA deadline.` },
    dataTitle: 'Task details',
    dataRows: [
      { label: 'Task', value: taskTitle || taskInstanceCode || '—' },
      { label: 'Assignee', value: assigneeName || '—' },
      { label: 'SLA', value: slaHours ? `${slaHours} hours` : 'Not set' },
      { label: 'Overdue by', value: overdueBy || '—' },
      { label: 'Priority', value: priority || '—' },
    ],
    cta: { label: 'Take action', url: `${brand.dashboardUrl}/pems/tasks`, accent: true },
    contextNote: 'You received this because a task has breached its SLA on Brand Central.',
  });
