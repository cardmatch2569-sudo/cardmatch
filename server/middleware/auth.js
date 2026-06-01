const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getPool, generatePlayerId } = require('../config/db');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Auto-generate player_id on first access if still missing
    if (!user.playerId) {
      try {
        const pool = getPool();
        let pid; let tries = 0;
        do {
          pid = generatePlayerId();
          const { rows } = await pool.query('SELECT 1 FROM Users WHERE player_id=$1', [pid]);
          if (!rows.length) break;
        } while (++tries < 50);
        await pool.query('UPDATE Users SET player_id=$1 WHERE id=$2', [pid, user._id]);
        user = await User.findById(user._id); // reload with new player_id
      } catch (e) { console.warn('[auth] player_id gen failed:', e.message); }
    }

    req.user = User.toPublic(user);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly };
