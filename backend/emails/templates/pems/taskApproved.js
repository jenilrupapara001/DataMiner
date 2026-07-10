const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ assigneeName, taskTitle, taskInstanceCode, approvedBy, approvedAt, feedback }) =>
  renderEmail({
    theme: 'success',
    eyebrow: 'Approved',
    title: 'Your task has been approved',
    moduleName: 'Brand Central',
    previewText: `Approved: ${taskTitle || taskInstanceCode}`,
    greetingName: assigneeName || 'Team',
    introParagraph: `Great work! Your submission for <strong>"${taskTitle || taskInstanceCode}"</strong> was approved${approvedBy ? ` by ${approvedBy}` : ''}.`,
    dataTitle: 'Approval details',
    dataRows: [
      { label: 'Approved by', value: approvedBy || '—' },
      { label: 'Approved at', value: approvedAt ? new Date(approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—', nowrap: true },
    ],
    alert: feedback ? { title: 'Feedback', text: feedback } : undefined,
    cta: { label: 'View task', url: `${brand.dashboardUrl}/pems/tasks` },
    contextNote: 'You received this because your task submission was approved on Brand Central.',
  });
