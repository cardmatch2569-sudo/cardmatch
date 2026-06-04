const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getPool, generatePlayerId } = require('../config/db');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Generate player_id for current user — also ensures column exists
router.post('/generate-player-id', protect, async (req, res) => {
  try {
    const pool = getPool();
    // Ensure column exists (safe on any DB state)
    await pool.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS player_id VARCHAR(8) UNIQUE`).catch(() => {});

    if (req.user.playerId) {
      return res.json({ user: req.user });
    }

    let pid; let tries = 0;
    do {
      pid = generatePlayerId();
      const { rows } = await pool.query('SELECT 1 FROM Users WHERE player_id=$1', [pid]);
      if (!rows.length) break;
    } while (++tries < 50);

    await pool.query('UPDATE Users SET player_id=$1 WHERE id=$2', [pid, req.user._id]);
    const updated = await User.findById(req.user._id);
    res.json({ user: User.toPublic(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ users: [] });

    const users = await User.search(q.trim(), req.user._id);
    // Return public fields only (no password, but fmt already excludes via toPublic)
    res.json({ users: users.map(User.toPublic) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/profile/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: User.toPublic(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me', protect, async (req, res) => {
  try {
    const { avatar } = req.body;
    const user = await User.update(req.user._id, { avatar });
    res.json({ user: User.toPublic(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────
router.put('/me/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });

    const user = await User.findById(req.user._id);
    // Google-only accounts have no password
    if (!user.password)
      return res.status(400).json({ message: 'บัญชี Google ไม่รองรับการเปลี่ยนรหัสผ่าน' });

    const valid = await User.comparePassword(currentPassword, user.password);
    if (!valid) return res.status(403).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    if (currentPassword === newPassword)
      return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await getPool().query('UPDATE Users SET password=$1, updated_at=NOW() WHERE id=$2', [hashed, req.user._id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE OWN ACCOUNT (requires password confirmation) ──────────
router.delete('/me', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านเพื่อยืนยัน' });

    const user = await User.findById(req.user._id);
    // Google-only accounts have no password — skip password check
    if (user.password) {
      const valid = await User.comparePassword(password, user.password);
      if (!valid) return res.status(403).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const pool = getPool();
    await pool.query('DELETE FROM RoomPlayers WHERE user_id=$1', [req.user._id]);
    await pool.query('DELETE FROM EmailVerifications WHERE email=$1', [user.email]);
    await pool.query('DELETE FROM Users WHERE id=$1', [req.user._id]);

    res.json({ message: 'ลบบัญชีเรียบร้อยแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
