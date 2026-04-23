const nodemailer = require('nodemailer');

let transporterPromise = null;

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      process.env.SMTP_HOST
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
            auth: process.env.SMTP_USER
              ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASS
                }
              : undefined
          })
        : nodemailer.createTransport({
            jsonTransport: true
          })
    );
  }

  return transporterPromise;
}

async function sendMail({ to, subject, html }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Shlomo Popovitz - Business Automation Solutions" <no-reply@shlomo.local>',
    to,
    subject,
    html
  });

  return info;
}

async function sendWelcomeEmail(user) {
  if (!user?.email) {
    return null;
  }

  return sendMail({
    to: user.email,
    subject: 'ברוכים הבאים למערכת שלמה פופוביץ',
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h1>ברוכים הבאים</h1>
        <p>${escapeHtml(user.name || 'לקוח יקר')}, החשבון שלך נפתח בהצלחה ונמצא כעת בהמתנה לאישור ידני.</p>
        <p>לאחר האישור תקבלו מייל נוסף עם גישה מלאה ללוח הניהול.</p>
        <p>לשאלות: WhatsApp 054-246-6340 | aknvpupuch@gmail.com</p>
      </div>
    `
  });
}

async function sendApprovalEmail(user) {
  if (!user?.email) {
    return null;
  }

  return sendMail({
    to: user.email,
    subject: 'החשבון שלכם אושר',
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h1>החשבון אושר</h1>
        <p>${escapeHtml(user.name || 'לקוח יקר')}, החשבון שלכם במערכת שלמה פופוביץ אושר וכעת ניתן להיכנס ולהתחיל לעבוד.</p>
        <p>המערכת כוללת הפצה רב-ערוצית, סטטוס קבוצתי, ניהול לקוחות ואנליטיקה.</p>
      </div>
    `
  });
}

async function sendAdminSignupAlert(user, workspace) {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'aknvpupuch@gmail.com';

  return sendMail({
    to: adminEmail,
    subject: 'לקוח חדש ממתין לאישור',
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h1>לקוח חדש נרשם</h1>
        <p>שם: ${escapeHtml(user?.name || '')}</p>
        <p>טלפון: ${escapeHtml(user?.phone || '')}</p>
        <p>אימייל: ${escapeHtml(user?.email || '')}</p>
        <p>Workspace: ${escapeHtml(workspace?.name || '')}</p>
      </div>
    `
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  sendAdminSignupAlert,
  sendApprovalEmail,
  sendWelcomeEmail
};
