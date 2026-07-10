const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, ipAddress, timestamp }) =>
  renderEmail({
    theme: 'security',
    eyebrow: 'Security Alert',
    title: 'Your account is temporarily locked',
    moduleName: 'Security',
    previewText: 'Your Brand Central account has been temporarily locked',
    greetingName: userName,
    introParagraph: 'We detected multiple failed sign-in attempts on your account.\n\nFor your protection, we\'ve locked it for 15 minutes. You can try again after the lockout expires.',
    dataTitle: 'Lockout details',
    dataRows: [
      { label: 'IP Address', value: ipAddress || 'Unknown' },
      { label: 'Attempted at', value: timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), nowrap: true },
      { label: 'Locked until', value: (() => { const d = new Date(Date.now() + 15*60000); return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); })(), nowrap: true },
    ],
    alert: { title: 'Didn\'t try to sign in?', text: 'Reset your password immediately and enable two-factor authentication. Contact your administrator if you need urgent access.' },
    cta: { label: 'Reset password', url: `${require('../../core/tokens').brand.dashboardUrl}/forgot-password`, accent: true },
    contextNote: 'You received this because of sign-in activity on your Brand Central account.',
  });
