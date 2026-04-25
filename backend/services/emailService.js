const nodemailer = require('nodemailer');
const { sql, getPool } = require('../database/db');

const getTransporter = async () => {
    try {
        const pool = await getPool();
        const settingsRes = await pool.request()
            .query("SELECT [Key], [Value] FROM SystemSettings WHERE [Key] IN ('smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpSecure')");
        
        const settingsMap = {};
        settingsRes.recordset.forEach(s => { settingsMap[s.Key] = s.Value; });

        const user = settingsMap.smtpUser || process.env.SMTP_USER;
        const pass = settingsMap.smtpPass || process.env.SMTP_PASS;
        const host = settingsMap.smtpHost || (user?.includes('gmail') ? 'smtp.gmail.com' : null);
        const port = settingsMap.smtpPort || 587;
        const secure = settingsMap.smtpSecure === 'ssl';

        if (!user || !pass) {
            return null;
        }

        return nodemailer.createTransport({
            host: host,
            port: port,
            secure: secure,
            auth: {
                user: user,
                pass: pass
            }
        });
    } catch (error) {
        console.error('Error getting dynamic transporter:', error);
        return null;
    }
};

const sendEmail = async (to, subject, html) => {
    try {
        const transporter = await getTransporter();

        if (!transporter) {
            console.warn('SMTP credentials missing (DB & Env). Email not sent.');
            return false;
        }

        const pool = await getPool();
        const fromRes = await pool.request()
            .query("SELECT [Value] FROM SystemSettings WHERE [Key] = 'smtpUser'");
        
        const fromEmail = fromRes.recordset[0]?.Value || process.env.SMTP_USER;

        const info = await transporter.sendMail({
            from: `"GMS Dashboard" <${fromEmail}>`,
            to,
            subject,
            html
        });

        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const sendTaskAssignmentEmail = async (user, action) => {
    const subject = `New Task Assigned: ${action.title}`;
    const html = `
    <h2>New Task Assignment</h2>
    <p>Hello ${user.firstName},</p>
    <p>You have been assigned a new task:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0;">${action.title}</h3>
      <p><strong>Priority:</strong> ${action.priority}</p>
      <p><strong>Type:</strong> ${action.type}</p>
      <p><strong>Description:</strong> ${action.description || 'No description provided.'}</p>
    </div>
    <p>Please log in to the dashboard to view details and start the task.</p>
  `;
    return sendEmail(user.email, subject, html);
};

const sendOverdueReminder = async (user, action) => {
    const subject = `Overdue Task Reminder: ${action.title}`;
    const html = `
    <h2 style="color: #d9534f;">Task Overdue Reminder</h2>
    <p>Hello ${user.firstName},</p>
    <p>The following task is now overdue:</p>
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeeba;">
      <h3 style="margin-top: 0;">${action.title}</h3>
      <p><strong>Due Date:</strong> ${new Date(action.DueDate).toLocaleDateString()}</p>
      <p><strong>Priority:</strong> ${action.priority}</p>
    </div>
    <p>Please update the status or complete this task as soon as possible.</p>
  `;
    return sendEmail(user.email, subject, html);
};

module.exports = {
    sendEmail,
    sendTaskAssignmentEmail,
    sendOverdueReminder
};
