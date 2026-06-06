const express = require('express');
const jwt     = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User              = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const { protect }       = require('../middleware/auth');
const { sendOTPEmail, sendRegisterOTPEmail } = require('../utils/mailer');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ── GET CURRENT USER ─────────────────────────────────────────────
router.get('/me', protect, (req, res) => res.json({ user: req.user }));

// ── EMAIL REGISTER — Step 1 ───────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ message: 'Username ต้องมี 3-20 ตัวอักษร' });
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    const exists = await User.findByEmailOrUsername(email, username);
    if (exists) {
      const f = exists.email === email.toLowerCase().trim() ? 'email' : 'username';
      return res.status(400).json({ message: f === 'email' ? 'อีเมลนี้ถูกใช้งานแล้ว' : 'Username นี้ถูกใช้งานแล้ว' });
    }

    if (await EmailVerification.isRateLimited(email))
      return res.status(429).json({ message: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const code = generateOTP();
    await EmailVerification.create(email, code, { type: 'email', username, email, hashedPassword });
    if (process.env.NODE_ENV !== 'production') console.log(`\n🔑 Register OTP for ${email} : ${code}\n`);

    sendRegisterOTPEmail(email, code, username)
      .then(() => console.log(`📧 sent to ${email}`))
      .catch(e  => console.warn(`📧 warn:`, e.message));

    res.json({ requiresOtp: true, email });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── EMAIL LOGIN ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const checkLoginRate = req.app.get('checkLoginRate');
    if (checkLoginRate && !checkLoginRate(ip))
      return res.status(429).json({ message: 'เข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอ 15 นาที' });

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await User.findByEmail(email);
    if (!user || !(await User.comparePassword(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: signToken(user._id), user: User.toPublic(user) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GOOGLE OAUTH — Step 1 ─────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'No credential' });
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE')
      return res.status(500).json({ message: 'Google OAuth not configured' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    let user = await User.findByGoogleId(googleId);
    if (user) return res.json({ token: signToken(user._id), user: User.toPublic(user) });

    user = await User.findByEmail(email);
    if (user) {
      await User.linkGoogle(user._id, googleId, picture);
      user = await User.findById(user._id);
      return res.json({ token: signToken(user._id), user: User.toPublic(user) });
    }

    if (await EmailVerification.isRateLimited(email))
      return res.status(429).json({ message: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่' });

    const code = generateOTP();
    await EmailVerification.create(email, code, { googleId, email, name, picture });
    if (process.env.NODE_ENV !== 'production') console.log(`\n🔑 Google OTP for ${email} : ${code}\n`);

    sendOTPEmail(email, code, name).catch(e => console.warn(`📧 warn:`, e.message));
    res.json({ requiresOtp: true, email, name });
  } catch (err) { console.error('Google auth error:', err.message); res.status(400).json({ message: 'Google authentication failed' }); }
});

// OTP verify rate limiter — max 5 attempts per email per 10 min
const otpVerifyAttempts = new Map();
const checkOtpRate = (email) => {
  const now = Date.now(), win = 10 * 60 * 1000;
  const e = otpVerifyAttempts.get(email) || { count: 0, resetAt: now + win };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + win; }
  if (e.count >= 5) return false;
  e.count++; otpVerifyAttempts.set(email, e); return true;
};
// Clean up expired OTP rate limit entries every 15 minutes
setInterval(() => { const now = Date.now(); otpVerifyAttempts.forEach((v, k) => { if (now > v.resetAt) otpVerifyAttempts.delete(k); }); }, 15 * 60 * 1000);

// ── VERIFY OTP — Step 2 ───────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code required' });
    if (!checkOtpRate(email))
      return res.status(429).json({ message: 'พยายามยืนยัน OTP มากเกินไป กรุณารอ 10 นาที' });

    const otpRow = await EmailVerification.verify(email, code);
    if (!otpRow) return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว' });

    const data = JSON.parse(otpRow.google_data);
    const isFirstUser = (await User.count()) === 0;
    let user;

    if (data.type === 'email') {
      if (await User.findByUsername(data.username))
        return res.status(409).json({ message: 'Username นี้ถูกใช้ไปแล้ว' });
      user = await User.createFromVerifiedEmail({ username: data.username, email, hashedPassword: data.hashedPassword, isAdmin: isFirstUser });
    } else {
      const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 17) || 'user';
      let username = base; let counter = 1;
      while (await User.findByUsername(username)) { username = `${base}${counter++}`; if (counter > 100) break; }
      user = await User.createWithGoogle({ googleId: data.googleId, email, username, avatar: data.picture || '', isAdmin: isFirstUser });
    }

    await EmailVerification.markUsed(otpRow.id);
    res.status(201).json({ token: signToken(user._id), user: User.toPublic(user) });
  } catch (err) { console.error('OTP verify error:', err.message); res.status(500).json({ message: err.message }); }
});

// ── RESEND OTP ────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    if (await EmailVerification.isRateLimited(email))
      return res.status(429).json({ message: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่' });

    const { rows } = await getPool().query(
      `SELECT google_data FROM EmailVerifications WHERE email=$1 AND used=FALSE ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );
    if (!rows[0]) return res.status(400).json({ message: 'ไม่พบข้อมูล กรุณาเริ่มต้นใหม่' });

    const data    = JSON.parse(rows[0].google_data);
    const newCode = generateOTP();
    await EmailVerification.create(email, newCode, data);
    if (process.env.NODE_ENV !== 'production') console.log(`\n🔑 OTP (resend) for ${email} : ${newCode}\n`);

    const fn = data.type === 'email'
      ? sendRegisterOTPEmail(email, newCode, data.username)
      : sendOTPEmail(email, newCode, data.name);
    fn.catch(e => console.warn(`📧 resend warn:`, e.message));

    res.json({ message: 'ส่งรหัสใหม่ไปที่ Email แล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── FORGOT PASSWORD — Step 1: send OTP ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'กรุณากรอก Email' });

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'ไม่พบบัญชีที่ใช้ Email นี้' });

    if (await EmailVerification.isRateLimited(email))
      return res.status(429).json({ message: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่' });

    const code = generateOTP();
    await EmailVerification.create(email, code, { type: 'reset', userId: user._id, username: user.username });
    if (process.env.NODE_ENV !== 'production') console.log(`\n🔑 Password Reset OTP for ${email}: ${code}\n`);

    sendOTPEmail(email, code, user.username).catch(e => console.warn('📧 warn:', e.message));
    res.json({ message: 'ส่งรหัส OTP ไปยัง Email แล้ว', email });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── RESET PASSWORD — Step 2: verify OTP + set new password ───────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword?.trim()) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    if (newPassword.trim().length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    const otpRow = await EmailVerification.verify(email, code);
    if (!otpRow) return res.status(400).json({ message: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว' });

    const data = JSON.parse(otpRow.google_data);
    if (data.type !== 'reset') return res.status(400).json({ message: 'รหัสไม่ถูกต้องสำหรับการรีเซ็ตรหัสผ่าน' });

    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);
    await getPool().query('UPDATE Users SET password=$1, updated_at=NOW() WHERE email=$2', [hashed, email.toLowerCase().trim()]); // normalized consistently
    await EmailVerification.markUsed(otpRow.id);

    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสใหม่' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

function getPool() { return require('../config/db').getPool(); }

module.exports = router;
