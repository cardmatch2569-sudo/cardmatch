const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Prevent hanging forever — fail fast so async send doesn't block
      connectionTimeout: 10000,   // 10s to connect
      greetingTimeout:   10000,   // 10s for SMTP greeting
      socketTimeout:     15000,   // 15s idle socket
    });
  }
  return transporter;
};

const sendOTPEmail = async (toEmail, code, displayName) => {
  const t = getTransporter();

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:40px 20px;">
        <table width="400" cellpadding="0" cellspacing="0"
               style="background:#1a1a2e;border-radius:16px;border:1px solid #2d2d44;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:8px;">🃏</div>
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">CardMatch</h1>
              <p style="color:#c4b5fd;margin:4px 0 0;font-size:14px;">Card Game Matchmaking Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#e5e7eb;">
              <p style="margin:0 0 8px;font-size:16px;">สวัสดีคุณ <strong style="color:#a78bfa;">${displayName || 'ผู้ใช้ใหม่'}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">
                ใช้รหัสนี้เพื่อยืนยันอีเมลและเปิดใช้งานบัญชี CardMatch ของคุณ
              </p>

              <!-- OTP Code -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;background:#0f0f1a;border-radius:12px;border:1px solid #2d2d44;">
                    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">รหัสยืนยัน OTP</p>
                    <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#a78bfa;font-family:monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 8px;font-size:13px;color:#6b7280;text-align:center;">
                ⏱ รหัสนี้จะหมดอายุใน <strong style="color:#d1d5db;">10 นาที</strong>
              </p>
              <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
                หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลนี้
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #2d2d44;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                CardMatch © 2026 — หาคู่เล่นการ์ดเกม
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  await t.sendMail({
    from: `"CardMatch" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `[CardMatch] รหัสยืนยัน: ${code}`,
    html,
    text: `รหัสยืนยัน CardMatch ของคุณคือ: ${code}\n\nรหัสนี้จะหมดอายุใน 10 นาที`,
  });
};

// Registration OTP email (slightly different subject/wording)
const sendRegisterOTPEmail = async (toEmail, code, username) => {
  const t = getTransporter();

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:40px 20px;">
        <table width="400" cellpadding="0" cellspacing="0"
               style="background:#1a1a2e;border-radius:16px;border:1px solid #2d2d44;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:8px;">🃏</div>
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">CardMatch</h1>
              <p style="color:#c4b5fd;margin:4px 0 0;font-size:14px;">ยืนยันอีเมลเพื่อสมัครสมาชิก</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#e5e7eb;">
              <p style="margin:0 0 8px;font-size:16px;">สวัสดีคุณ <strong style="color:#a78bfa;">${username || 'ผู้สมัครใหม่'}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">
                ใช้รหัสนี้เพื่อยืนยันอีเมลและสร้างบัญชี CardMatch ของคุณ
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;background:#0f0f1a;border-radius:12px;border:1px solid #2d2d44;">
                    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">รหัส OTP สมัครสมาชิก</p>
                    <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#a78bfa;font-family:monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 8px;font-size:13px;color:#6b7280;text-align:center;">
                ⏱ รหัสนี้จะหมดอายุใน <strong style="color:#d1d5db;">10 นาที</strong>
              </p>
              <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
                หากคุณไม่ได้สมัครสมาชิก CardMatch กรุณาเพิกเฉยต่ออีเมลนี้
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #2d2d44;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                CardMatch © 2026 — หาคู่เล่นการ์ดเกม
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  await t.sendMail({
    from: `"CardMatch" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `[CardMatch] ยืนยันอีเมลสมัครสมาชิก: ${code}`,
    html,
    text: `รหัส OTP สมัครสมาชิก CardMatch: ${code}\n\nรหัสนี้จะหมดอายุใน 10 นาที`,
  });
};

module.exports = { sendOTPEmail, sendRegisterOTPEmail };
