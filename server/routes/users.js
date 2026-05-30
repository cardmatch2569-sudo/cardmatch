const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

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
