const https = require('https');

// ── Brevo Transactional Email API (using built-in https module) ───
const SENDER = { name: 'CardMatch', email: 'cardmatch2569@gmail.com' };

const brevoSend = ({ to, subject, htmlContent, textContent }) =>
  new Promise((resolve, reject) => {
    const key = process.env.BREVO_API_KEY;
    if (!key) return reject(new Error('BREVO_API_KEY not set'));

    const payload = JSON.stringify({
      sender:      SENDER,
      to:          [{ email: to }],
      subject,
      htmlContent,
      textContent,
    });

    const req = https.request({
      hostname: 'api.brevo.com',
      port:     443,
      path:     '/v3/smtp/email',
      method:   'POST',
      headers: {
        'api-key':        key,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'accept':         'application/json',
      },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const r = JSON.parse(body);
          console.log(`📧 Brevo sent to ${to} — messageId: ${r.messageId}`);
          resolve(r);
        } else {
          reject(new Error(`Brevo ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

// ── OTP Template ──────────────────────────────────────────────────
const otpBlock = (code) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px;background:#0f0f1a;border-radius:12px;border:1px solid #2d2d44;">
      <p style="margin:0 0 10px;font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">OTP Code</p>
      <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#a78bfa;font-family:monospace;">${code}</div>
    </td></tr>
  </table>
  <p style="margin:18px 0 0;font-size:13px;color:#6b7280;text-align:center;">Expires in <strong style="color:#d1d5db;">10 minutes</strong></p>`;

const wrap = (body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="420" cellpadding="0" cellspacing="0"
      style="max-width:420px;width:100%;background:#1a1a2e;border-radius:16px;border:1px solid #2d2d44;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:28px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">&#127183; CardMatch</h1>
        <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px;">Card Game Matchmaking</p>
      </td></tr>
      <tr><td style="padding:28px;color:#e5e7eb;">${body}</td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #2d2d44;text-align:center;">
        <p style="margin:0;font-size:11px;color:#4b5563;">CardMatch &copy; 2026</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

// ── Public API ────────────────────────────────────────────────────
const sendRegisterOTPEmail = (toEmail, code, username) =>
  brevoSend({
    to:          toEmail,
    subject:     `[CardMatch] Verification Code: ${code}`,
    htmlContent: wrap(`
      <p style="margin:0 0 6px;font-size:16px;">Hello <strong style="color:#a78bfa;">${username || 'New User'}</strong>,</p>
      <p style="margin:0 0 22px;font-size:14px;color:#9ca3af;">Use this code to verify your email and create your CardMatch account.</p>
      ${otpBlock(code)}
      <p style="margin:18px 0 0;font-size:12px;color:#4b5563;text-align:center;">If you did not sign up, please ignore this email.</p>`),
    textContent: `CardMatch OTP: ${code}\nExpires in 10 minutes.`,
  });

const sendOTPEmail = (toEmail, code, displayName) =>
  brevoSend({
    to:          toEmail,
    subject:     `[CardMatch] Verification Code: ${code}`,
    htmlContent: wrap(`
      <p style="margin:0 0 6px;font-size:16px;">Hello <strong style="color:#a78bfa;">${displayName || 'User'}</strong>,</p>
      <p style="margin:0 0 22px;font-size:14px;color:#9ca3af;">Use this code to verify your email and activate your CardMatch account.</p>
      ${otpBlock(code)}
      <p style="margin:18px 0 0;font-size:12px;color:#4b5563;text-align:center;">If you did not request this, please ignore.</p>`),
    textContent: `CardMatch OTP: ${code}\nExpires in 10 minutes.`,
  });

module.exports = { sendOTPEmail, sendRegisterOTPEmail };
