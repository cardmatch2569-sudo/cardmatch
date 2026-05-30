const nodemailer = require('nodemailer');

// ── Email provider selection ──────────────────────────────────────
// Priority: RESEND_API_KEY → Gmail SMTP → log only (dev)

const hasResend  = !!process.env.RESEND_API_KEY;
const hasGmail   = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS &&
                     !process.env.EMAIL_PASS.includes('xxxx'));

let resendClient = null;
if (hasResend) {
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

let gmailTransport = null;
const getGmail = () => {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
  }
  return gmailTransport;
};

// ── Core send function ────────────────────────────────────────────
const sendMail = async ({ to, subject, html, text }) => {
  if (hasResend && resendClient) {
    const from = process.env.EMAIL_FROM || 'CardMatch <noreply@resend.dev>';
    const { error } = await resendClient.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return;
  }

  if (hasGmail) {
    await getGmail().sendMail({
      from: `"CardMatch" <${process.env.EMAIL_USER}>`,
      to, subject, html, text,
    });
    return;
  }

  // Dev mode — no email provider configured
  console.warn(`📧 [DEV] Email not sent (no provider). Subject: ${subject}`);
};

// ── OTP Email Templates ───────────────────────────────────────────
const otpBlock = (code) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:20px;background:#0f0f1a;border-radius:12px;border:1px solid #2d2d44;">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">รหัส OTP</p>
        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#a78bfa;font-family:monospace;">${code}</div>
      </td>
    </tr>
  </table>
  <p style="margin:20px 0 0;font-size:13px;color:#6b7280;text-align:center;">⏱ หมดอายุใน <strong style="color:#d1d5db;">10 นาที</strong></p>
`;

const wrap = (body) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="420" cellpadding="0" cellspacing="0"
             style="background:#1a1a2e;border-radius:16px;border:1px solid #2d2d44;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:28px;text-align:center;">
            <div style="font-size:36px;margin-bottom:6px;">🃏</div>
            <h1 style="color:#fff;margin:0;font-size:22px;">CardMatch</h1>
          </td>
        </tr>
        <tr><td style="padding:28px;color:#e5e7eb;">${body}</td></tr>
        <tr>
          <td style="padding:14px 28px;border-top:1px solid #2d2d44;text-align:center;">
            <p style="margin:0;font-size:11px;color:#4b5563;">CardMatch © 2026 — หาคู่เล่นการ์ดเกม</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Send registration OTP ─────────────────────────────────────────
const sendRegisterOTPEmail = async (toEmail, code, username) => {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;">สวัสดีคุณ <strong style="color:#a78bfa;">${username || 'ผู้สมัครใหม่'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;">ใช้รหัสนี้เพื่อยืนยันอีเมลและสร้างบัญชี CardMatch</p>
    ${otpBlock(code)}
    <p style="margin:16px 0 0;font-size:12px;color:#4b5563;text-align:center;">หากไม่ได้สมัคร กรุณาเพิกเฉย</p>`;

  await sendMail({
    to: toEmail,
    subject: `[CardMatch] รหัสยืนยัน: ${code}`,
    html: wrap(body),
    text: `รหัส OTP CardMatch: ${code}\n\nหมดอายุใน 10 นาที`,
  });
};

// ── Send Google OAuth OTP ─────────────────────────────────────────
const sendOTPEmail = async (toEmail, code, displayName) => {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;">สวัสดีคุณ <strong style="color:#a78bfa;">${displayName || 'ผู้ใช้'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;">ใช้รหัสนี้เพื่อยืนยันอีเมลและเปิดใช้งานบัญชี CardMatch</p>
    ${otpBlock(code)}
    <p style="margin:16px 0 0;font-size:12px;color:#4b5563;text-align:center;">หากไม่ได้ทำรายการนี้ กรุณาเพิกเฉย</p>`;

  await sendMail({
    to: toEmail,
    subject: `[CardMatch] รหัสยืนยัน: ${code}`,
    html: wrap(body),
    text: `รหัส OTP CardMatch: ${code}\n\nหมดอายุใน 10 นาที`,
  });
};

module.exports = { sendOTPEmail, sendRegisterOTPEmail };
