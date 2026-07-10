const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ assigneeName, taskTitle, taskInstanceCode, reviewedBy, reviewedAt, feedback }) =>
  renderEmail({
    theme: 'danger',
    eyebrow: 'Changes Requested',
    title: `"${taskTitle || taskInstanceCode}" needs rework`,
    moduleName: 'Brand Central',
    previewText: `Changes requested: ${taskTitle || taskInstanceCode}`,
    greetingName: assigneeName || 'Team',
    introParagraph: `${reviewedBy || 'A reviewer'} has requested changes on your submission.\n\nPlease review the feedback and resubmit.`,
    dataTitle: 'Review details',
    dataRows: [
      { label: 'Reviewed by', value: reviewedBy || '—' },
      { label: 'Reviewed at', value: reviewedAt ? new Date(reviewedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—', nowrap: true },
    ],
    alert: { title: 'Reviewer feedback', text: feedback || 'No feedback was provided. Check the task details for specific instructions.' },
    cta: { label: 'View feedback and rework', url: `${brand.dashboardUrl}/pems/tasks`, accent: true },
    contextNote: 'You received this because your task submission was rejected on Brand Central.',
  });
