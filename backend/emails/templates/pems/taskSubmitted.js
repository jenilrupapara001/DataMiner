const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ reviewerName, taskTitle, taskInstanceCode, submittedBy, submittedAt, timeTaken, priority }) =>
  renderEmail({
    theme: 'premium',
    eyebrow: 'Awaiting Review',
    title: `${submittedBy || 'Someone'} submitted "${taskTitle || taskInstanceCode}"`,
    moduleName: 'Brand Central',
    previewText: `Awaiting review: ${taskTitle || taskInstanceCode}`,
    greetingName: reviewerName || 'Reviewer',
    introParagraph: 'A task has been submitted for your review.\n\nPlease review and approve or request changes.',
    dataTitle: 'Submission details',
    dataRows: [
      { label: 'Submitted by', value: submittedBy || '—' },
      { label: 'Submitted at', value: submittedAt ? new Date(submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—', nowrap: true },
      { label: 'Time taken', value: timeTaken || '—' },
      { label: 'Priority', value: priority || '—' },
    ],
    cta: { label: 'Review submission', url: `${brand.dashboardUrl}/pems/tasks` },
    contextNote: 'You received this because a task was submitted for your review on Brand Central.',
  });
