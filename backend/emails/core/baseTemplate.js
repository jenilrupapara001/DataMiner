const { colors, typography, layout } = require('./tokens');
const { themes } = require('./themes');
const {
  renderHeader, renderTitle, renderBody, renderDivider,
  renderDataTable, renderOtpBlock, renderAlert, renderChecklist,
  renderCta, renderSecondaryLink, renderSupportLine, renderExternalFooter,
  renderPreheader,
} = require('./components');

/**
 * Renders the canonical RetailOps email.
 *
 * @param {Object} opts
 * @param {string} opts.theme            - Theme key from themes.js
 * @param {string} opts.eyebrow         - Small uppercase label (theme-colored)
 * @param {string} opts.title           - Large H1 headline (may wrap 2 lines)
 * @param {string} opts.moduleName      - Top-right module label
 * @param {string} opts.greetingName    - "Hi {name},"
 * @param {string} opts.introParagraph  - Body copy
 * @param {string} opts.previewText     - Hidden inbox preheader (40-90 chars)
 * @param {Object} [opts.otpBlock]      - { code, expiryMinutes, ipAddress }
 * @param {Object} [opts.alert]         - { title, text }
 * @param {Array}  [opts.dataRows]      - [{ label, value, nowrap }]
 * @param {string} [opts.dataTitle]     - Section heading above data table
 * @param {Array}  [opts.checklist]     - [{ text }]
 * @param {Object} [opts.cta]           - { label, url, accent? }
 * @param {Object} [opts.secondaryLink] - { label, url }
 * @param {string} [opts.contextNote]   - Footer context line
 * @returns {string}
 */
function renderEmail(opts) {
  const theme = themes[opts.theme] || themes.info;
  const sections = [];

  sections.push(renderHeader({ accentColor: theme.accentColor, moduleName: opts.moduleName }));
  sections.push(renderTitle({ accentColor: theme.accentColor, eyebrow: opts.eyebrow, title: opts.title }));
  sections.push(renderBody({ greetingName: opts.greetingName, intro: opts.introParagraph }));

  if (opts.otpBlock) {
    sections.push(renderOtpBlock({ code: opts.otpBlock.code, expiryMinutes: opts.otpBlock.expiryMinutes || 10, ipAddress: opts.otpBlock.ipAddress }));
  }

  if (opts.dataRows && opts.dataRows.length > 0) {
    sections.push(renderDataTable({ title: opts.dataTitle, rows: opts.dataRows }));
  }

  if (opts.alert) {
    sections.push(renderAlert({ accentColor: theme.accentColor, accentTint: theme.accentTint, title: opts.alert.title, text: opts.alert.text }));
  }

  if (opts.checklist && opts.checklist.length > 0) {
    sections.push(renderChecklist({ title: opts.checklistTitle || 'What\'s included', items: opts.checklist.map(c => c.text || c), accentColor: theme.accentColor }));
  }

  if (opts.cta) {
    sections.push(renderCta({ label: opts.cta.label, url: opts.cta.url, accent: opts.cta.accent, accentColor: theme.accentColor }));
  }

  if (opts.secondaryLink) {
    sections.push(renderSecondaryLink(opts.secondaryLink));
  }

  sections.push(renderSupportLine());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${opts.title || 'RetailOps'}</title>
</head>
<body style="margin:0; padding:0; background:${colors.bgPage}; font-family:${typography.fontStack}; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;">
${renderPreheader(opts.previewText)}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bgPage};">
    <tr>
      <td align="center" style="padding:${layout.pagePad};">
        <table role="presentation" width="${layout.width}" cellpadding="0" cellspacing="0"
               style="background:${colors.bgCard}; border:${layout.cardBorder}; border-radius:${layout.cardRadius}px; box-shadow:${layout.cardShadow};">
          ${sections.join('\n')}
        </table>
        ${renderExternalFooter({ contextNote: opts.contextNote })}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail };
