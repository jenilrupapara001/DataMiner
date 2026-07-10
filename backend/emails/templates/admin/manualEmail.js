const { renderEmail } = require('../../core/baseTemplate');
const { brand } = require('../../core/tokens');

module.exports = ({ userName, subject, body, adminName }) =>
  renderEmail({
    theme: 'info',
    eyebrow: 'Message from Admin',
    title: subject || 'Message from Admin',
    moduleName: 'Brand Central',
    previewText: (subject || 'A message from your admin').slice(0, 80),
    greetingName: userName,
    introParagraph: body || '',
    cta: { label: 'Open dashboard', url: brand.dashboardUrl },
    contextNote: `Sent by ${adminName || 'Admin'} via Brand Central.`,
  });
