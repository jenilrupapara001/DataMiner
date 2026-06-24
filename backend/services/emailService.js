const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      pool: true,
      maxConnections: 5,
    });
    this.stats = { sent: 0, failed: 0, lastError: null };
    this.transporter.verify().then(() => console.log('✅ Email service ready')).catch(e => console.warn('⚠️ Email not configured:', e.message));
  }

  async send({ to, subject, html, text }) {
    try {
      const result = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || `"RetailOps" <${process.env.SMTP_USER || 'noreply@brandcentral.in'}>`,
        to, subject, html, text: text || html?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      });
      this.stats.sent++;
      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.stats.failed++;
      this.stats.lastError = error.message;
      console.error('Email failed:', error.message);
      console.log(`📧 [FALLBACK] To: ${to} | OTP: Check server logs`);
      throw error;
    }
  }

  getStats() { return { ...this.stats, failureRate: this.stats.sent > 0 ? ((this.stats.failed / this.stats.sent) * 100).toFixed(1) : 0 }; }

  _maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***';
    const [local, domain] = email.split('@');
    return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
  }
}

module.exports = new EmailService();
