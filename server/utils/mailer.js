const nodemailer = require('nodemailer');

// ── Brevo SMTP (works from cloud servers, sends to any email) ──────
const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.BREVO_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.BREVO_LOGIN,
      pass: process.env.BREVO_PASSWORD,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

// ── Email template helpers ────────────────────────────────────────
const otpBlock = (code) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:24px;background:#0f0f1a;border-radius:12px;border:1px solid #2d2d44;">
        <p style="margin:0 0 10px;font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">รหัส OTP</p>
        <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#a78bfa;font-family:monospace;">${code}</div>
      </td>
    </tr>
  </table>
  <p style="margin:18px 0 0;font-size:13px;color:#6b7280;text-align:center;">⏱ หมดอายุใน <strong style="color:#d1d5db;">10 นาที</strong></p>`;

const wrap = (body) => `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="420" cellpadding="0" cellspacing="0" style="max-width:420px;width:100%;background:#1a1a2e;border-radius:16px;border:1px solid #2d2d44;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:28px;text-align:center;">
            <div style="font-size:36px;margin-bottom:6px;">&#127183;</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">CardMatch</h1>
            <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px;">Card Game Matchmaking</p>
          </td>
        </tr>
        <tr><td style="padding:28px;color:#e5e7eb;">${body}</td></tr>
        <tr>
          <td style="padding:14px 28px;border-top:1px solid #2d2d44;text-align:center;">
            <p style="margin:0;font-size:11px;color:#4b5563;">CardMatch &copy; 2026 &#8212; &#3627;&#3634;&#3588;&#3641;&#3656;&#3648;&#3621;&#3656;&#3609;&#3585;&#3634;&#3619;&#3660;&#3604;&#3648;&#3585;&#3617;</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Send Registration OTP ─────────────────────────────────────────
const sendRegisterOTPEmail = async (toEmail, code, username) => {
  const body = `
    <p style="margin:0 0 6px;font-size:16px;">&#3626;&#3623;&#3633;&#3626;&#3604;&#3637;&#3588;&#3640;&#3603; <strong style="color:#a78bfa;">${username || 'ผู้สมัครใหม่'}</strong>,</p>
    <p style="margin:0 0 22px;font-size:14px;color:#9ca3af;">ใช้รหัสนี้เพื่อยืนยันอีเมลและสร้างบัญชี CardMatch ของคุณ</p>
    ${otpBlock(code)}
    <p style="margin:18px 0 0;font-size:12px;color:#4b5563;text-align:center;">หากคุณไม่ได้สมัคร CardMatch กรุณาเพิกเฉย</p>`;

  await getTransporter().sendMail({
    from: `"CardMatch" <cardmatch2569@gmail.com>`,
    to:      toEmail,
    subject: `[CardMatch] รหัสยืนยัน: ${code}`,
    html:    wrap(body),
    text:    `รหัส OTP CardMatch: ${code}\nหมดอายุใน 10 นาที`,
  });
};

// ── Send Google OAuth OTP ─────────────────────────────────────────
const sendOTPEmail = async (toEmail, code, displayName) => {
  const body = `
    <p style="margin:0 0 6px;font-size:16px;">&#3626;&#3623;&#3633;&#3626;&#3604;&#3637;&#3588;&#3640;&#3603; <strong style="color:#a78bfa;">${displayName || 'ผู้ใช้'}</strong>,</p>
    <p style="margin:0 0 22px;font-size:14px;color:#9ca3af;">ใช้รหัสนี้เพื่อยืนยันอีเมลและเปิดใช้งานบัญชี CardMatch</p>
    ${otpBlock(code)}
    <p style="margin:18px 0 0;font-size:12px;color:#4b5563;text-align:center;">หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉย</p>`;

  await getTransporter().sendMail({
    from: `"CardMatch" <cardmatch2569@gmail.com>`,
    to:      toEmail,
    subject: `[CardMatch] รหัสยืนยัน: ${code}`,
    html:    wrap(body),
    text:    `รหัส OTP CardMatch: ${code}\nหมดอายุใน 10 นาที`,
  });
};

module.exports = { sendOTPEmail, sendRegisterOTPEmail };
