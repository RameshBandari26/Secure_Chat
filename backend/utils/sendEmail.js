const nodemailer = require("nodemailer");

// -----------------------------------------------------------------
// Sends an email if SMTP credentials are configured in .env
// (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
//
// If they are NOT configured (e.g. you're just running this locally
// without a real mail provider), we fall back to printing the email
// to the server console instead of sending it, so the forgot-password
// flow still works end-to-end during development.
//
// For production, set the SMTP_* variables to a real provider
// (Gmail app password, SendGrid, Mailgun, Postmark, etc).
// -----------------------------------------------------------------
async function sendEmail({ to, subject, html, text }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("\n===== 📧 EMAIL (SMTP not configured, dev fallback) =====");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log(text || html);
    console.log("=========================================================\n");
    return { devFallback: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    html,
    text,
  });

  return { devFallback: false };
}

module.exports = { sendEmail };
