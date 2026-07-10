const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, code, ipAddress }) =>
  renderEmail({
    theme: 'auth',
    eyebrow: 'Secure Login',
    title: 'Sign in to Brand Central',
    moduleName: 'Security',
    previewText: `Your Brand Central sign-in code: ${code}`,
    greetingName: userName || 'there',
    introParagraph: 'Use this code to complete your sign-in. It expires in 10 minutes.',
    otpBlock: { code, expiryMinutes: 10, ipAddress },
    alert: { title: 'Security notice', text: 'Never share this code with anyone. Brand Central will never ask for it over phone, chat, or email.' },
    contextNote: 'You received this because someone attempted to sign in to your Brand Central account.',
  });
