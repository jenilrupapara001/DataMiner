const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, sellerName, marketplace, changedBy }) =>
  renderEmail({
    theme: 'danger',
    eyebrow: 'Access Removed',
    title: `Your access to ${sellerName} has been removed`,
    moduleName: 'Team Management',
    previewText: `Your access to ${sellerName} on Brand Central has been removed`,
    greetingName: userName,
    introParagraph: `Your management role for <strong>${sellerName}</strong> has been revoked.\n\nYou no longer have access to its dashboard, ASINs, or associated data.`,
    dataTitle: 'Removal details',
    dataRows: [
      { label: 'Brand', value: sellerName },
      { label: 'Marketplace', value: marketplace || 'N/A' },
      { label: 'Removed by', value: changedBy },
      { label: 'Date', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST', nowrap: true },
    ],
    checklistTitle: 'What changed',
    checklist: [
      'Dashboard access for this brand has been revoked',
      'ASIN data and sync settings are no longer accessible',
      'Contact your administrator to request access again',
    ],
    contextNote: `You received this because you were previously assigned to the ${sellerName} team on Brand Central.`,
  });
