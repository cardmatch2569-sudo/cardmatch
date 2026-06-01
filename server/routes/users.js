const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getPool, generatePlayerId } = require('../config/db');

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

module.exports = router;
