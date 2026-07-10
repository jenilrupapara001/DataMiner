const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, sellerName, marketplace, changedBy, baseUrl }) =>
  renderEmail({
    theme: 'success',
    eyebrow: 'Brand Assignment',
    title: `You've been assigned to ${sellerName}`,
    moduleName: 'Team Management',
    previewText: `You've been assigned as manager for ${sellerName} on Brand Central`,
    greetingName: userName,
    introParagraph: `You have been assigned as a manager for <strong>${sellerName}</strong> on Brand Central.\n\nYou now have access to ASINs, sync settings, pricing data, and performance analytics for this brand.`,
    dataTitle: 'Assignment details',
    dataRows: [
      { label: 'Brand', value: sellerName },
      { label: 'Marketplace', value: marketplace || 'N/A' },
      { label: 'Assigned by', value: changedBy },
      { label: 'Date', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST', nowrap: true },
    ],
    checklistTitle: 'What\'s included',
    checklist: [
      'Brand dashboard access from your sidebar',
      'ASIN, pricing, and sync management',
      'Performance analytics and GMS tracking',
    ],
    cta: { label: 'Open dashboard', url: baseUrl },
    contextNote: `You received this because you've been assigned to the ${sellerName} team on Brand Central.`,
  });
