const { colors, typography, layout } = require('./tokens');

function renderHeader({ accentColor, moduleName }) {
  const { brand } = require('./tokens');
  return `
  <tr>
    <td style="padding:${layout.headerPadding}; border-bottom:1px solid ${colors.borderHair};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="left" style="vertical-align:middle;">
            <img src="${brand.logoUrl}" alt="Brand Central" width="110" height="28" style="display:block; height:28px; width:auto; object-fit:contain;" />
          </td>
          <td align="right" style="vertical-align:middle; font-size:12px; color:#6b7280; font-weight:500; letter-spacing:0.02em;">
            ${moduleName || ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderTitle({ accentColor, eyebrow, title }) {
  return `
  <tr>
    <td style="padding:${layout.cardPadTop}px ${layout.cardPadX}px 8px;">
      <p style="margin:0 0 16px; font-size:12px; font-weight:500; color:${accentColor}; letter-spacing:0.08em; text-transform:uppercase;">${eyebrow}</p>
      <h1 style="margin:0; font-size:28px; line-height:1.2; letter-spacing:-0.025em; font-weight:600; color:${colors.textPrimary};">${title}</h1>
    </td>
  </tr>`;
}

function renderBody({ greetingName, introParagraph }) {
  const parts = (introParagraph || '').split('\n\n');
  const greetingHtml = greetingName ? `<p style="margin:0 0 20px; font-size:15px; line-height:1.65; color:${colors.textBody};">Hi <strong style="font-weight:600; color:${colors.textPrimary};">${greetingName}</strong>,</p>` : '';
  const bodyHtml = parts.map(p => `<p style="margin:0 0 12px; font-size:15px; line-height:1.65; color:${colors.textBody};">${p}</p>`).join('');
  return `
  <tr>
    <td style="padding:24px ${layout.cardPadX}px 32px;">
      ${greetingHtml}
      ${bodyHtml}
    </td>
  </tr>`;
}

function renderDivider() {
  return `<tr><td style="padding:0 ${layout.cardPadX}px;"><hr style="border:none; border-top:1px solid ${colors.borderHair}; margin:0;"></td></tr>`;
}

function renderDataTable({ title, rows }) {
  const rowHtml = (rows || []).map((r, i) => {
    const last = i === rows.length - 1;
    const borderBottom = last ? 'none' : `1px solid ${colors.borderHair}`;
    const bg = i % 2 === 0 ? '#ffffff' : colors.bgSubtle;
    const wrap = r.nowrap ? 'white-space:nowrap;' : '';
    return `
      <tr style="background:${bg};">
        <td style="padding:14px 20px; border-bottom:${borderBottom}; width:140px; font-size:13px; color:${colors.textSec}; font-weight:400;">${r.label}</td>
        <td style="padding:14px 20px; border-bottom:${borderBottom}; font-size:14px; color:${colors.textPrimary}; font-weight:500; text-align:right; ${wrap}">${r.value}</td>
      </tr>`;
  }).join('');

  return `
  <tr>
    <td style="padding:0 ${layout.cardPadX}px 24px;">
      ${title ? `<p style="margin:0 0 14px; font-size:13px; font-weight:600; color:${colors.textPrimary}; letter-spacing:0.04em; text-transform:uppercase;">${title}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid ${colors.borderDef}; border-radius:8px; border-collapse:separate; border-spacing:0; overflow:hidden; background:${colors.bgCard};">
        ${rowHtml}
      </table>
    </td>
  </tr>`;
}

function renderOtpBlock({ code, expiryMinutes, ipAddress }) {
  return `
  <tr>
    <td style="padding:8px ${layout.cardPadX}px 24px;">
      <p style="margin:0 0 14px; font-size:13px; font-weight:600; color:${colors.textPrimary}; letter-spacing:0.04em; text-transform:uppercase;">Verification Code</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid ${colors.borderDef}; border-radius:8px; background:${colors.bgSubtle}; border-collapse:separate; border-spacing:0; overflow:hidden;">
        <tr>
          <td style="padding:32px 24px; text-align:center;">
            <p style="margin:0; font-size:40px; font-weight:600; color:${colors.textPrimary}; letter-spacing:0.24em; font-family:${typography.monoStack};">${code}</p>
            <p style="margin:16px 0 0; font-size:13px; color:${colors.textSec};">Expires in ${expiryMinutes} minutes${ipAddress ? ` · Requested from ${ipAddress}` : ''}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderAlert({ accentColor, accentTint, title, text }) {
  return `
  <tr>
    <td style="padding:0 ${layout.cardPadX}px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-left:3px solid ${accentColor}; background:${accentTint}; border-radius:0 6px 6px 0;">
        <tr>
          <td style="padding:16px 20px;">
            ${title ? `<p style="margin:0 0 6px; font-size:13px; font-weight:600; color:${accentColor};">${title}</p>` : ''}
            <p style="margin:0; font-size:13px; line-height:1.6; color:${colors.textBody};">${text}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderChecklist({ title, items, accentColor }) {
  const rows = (items || []).map(item => `
    <tr>
      <td width="18" valign="top" style="padding:8px 0; font-size:10px; color:${accentColor}; line-height:1.6;">●</td>
      <td style="padding:8px 0; font-size:14px; color:${colors.textBody}; line-height:1.6;">${item}</td>
    </tr>`).join('');

  return `
  <tr>
    <td style="padding:8px ${layout.cardPadX}px 32px;">
      <p style="margin:0 0 14px; font-size:13px; font-weight:600; color:${colors.textPrimary}; letter-spacing:0.04em; text-transform:uppercase;">${title}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td>
  </tr>`;
}

function renderCta({ label, url, accent, accentColor }) {
  const bg = accent ? accentColor : colors.textPrimary;
  return `
  <tr>
    <td style="padding:0 ${layout.cardPadX}px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:${bg}; border-radius:6px;">
            <a href="${url}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:14px; font-weight:500; color:#ffffff; text-decoration:none; letter-spacing:-0.005em;">${label} <span style="margin-left:4px; color:#8b929e;">→</span></a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderSecondaryLink({ label, url }) {
  return `
  <tr>
    <td style="padding:0 ${layout.cardPadX}px 32px;">
      <a href="${url}" target="_blank" style="font-size:13px; color:${colors.textSec}; text-decoration:underline; text-decoration-color:#c3c7cf; text-underline-offset:3px; font-weight:500;">${label}</a>
    </td>
  </tr>`;
}

function renderSupportLine() {
  const { brand } = require('./tokens');
  return `
  <tr>
    <td style="padding:32px ${layout.cardPadX}px 24px; border-top:1px solid ${colors.borderHair};">
      <p style="margin:0; font-size:13px; line-height:1.6; color:${colors.textSec};">Questions? Reply to this email or contact <a href="mailto:${brand.supportEmail}" style="color:${colors.textPrimary}; text-decoration:underline; text-decoration-color:#c3c7cf; text-underline-offset:3px; font-weight:500;">${brand.supportEmail}</a></p>
    </td>
  </tr>`;
}

function renderExternalFooter({ contextNote }) {
  const { brand } = require('./tokens');
  return `
  <table role="presentation" width="${layout.width}" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px ${layout.cardPadX}px 40px;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:600; color:${colors.textBody}; letter-spacing:-0.005em;">${brand.name}</p>
        <p style="margin:0 0 16px; font-size:12px; color:${colors.textMuted};">${brand.tagline}</p>
        <p style="margin:0 0 16px; font-size:11px; line-height:1.6; color:${colors.textMuted};">3rd Floor, Vama House, Ring Rd, near Rivaa House<br>Udhana Darwaja, Rustampura, Surat, Gujarat 395002</p>
        <p style="margin:0 0 16px; font-size:12px;">
          <a href="tel:+919988339144" style="color:${colors.linkGray}; text-decoration:none;">${brand.phone}</a>
          &nbsp;·&nbsp;
          <a href="mailto:${brand.supportEmail}" style="color:${colors.linkGray}; text-decoration:none;">${brand.supportEmail}</a>
          &nbsp;·&nbsp;
          <a href="${brand.website}" style="color:${colors.linkGray}; text-decoration:none;">brandcentral.in</a>
        </p>
        <p style="margin:0 0 8px; font-size:11px; color:${colors.textFaint};">${brand.copyright}</p>
        ${contextNote ? `<p style="margin:0; font-size:11px; line-height:1.6; color:${colors.textFaint};">${contextNote}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

function renderPreheader(text) {
  if (!text) return '';
  return `
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; visibility:hidden; mso-hide:all; height:0; width:0; font-size:0; line-height:0;">${text}</div>
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

module.exports = {
  renderHeader,
  renderTitle,
  renderBody,
  renderDivider,
  renderDataTable,
  renderOtpBlock,
  renderAlert,
  renderChecklist,
  renderCta,
  renderSecondaryLink,
  renderSupportLine,
  renderExternalFooter,
  renderPreheader,
};
