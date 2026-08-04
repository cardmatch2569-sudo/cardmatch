const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getPool } = require('../config/db');
const { getOnlineUsers } = require('../socket/handlers');

const router = express.Router();

// GET /api/friends — accepted friends list
router.get('/', protect, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user._id;
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.player_id, u.elo, u.wins, u.losses, u.total_games
       FROM Friendships f
       JOIN Users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY u.username`,
      [userId]
    );
    const online = getOnlineUsers();
    res.json({
      friends: rows.map(r => ({
        _id:      r.id,
        username: r.username,
        avatar:   r.avatar || '',
        playerId: r.player_id,
        elo:      r.elo || 1000,
        isOnline: online.has(r.id),
        stats:    { wins: r.wins || 0, losses: r.losses || 0, totalGames: r.total_games || 0 },
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/friends/requests — pending requests sent TO me
router.get('/requests', protect, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT f.user_id AS from_id, u.username, u.avatar, u.elo, f.created_at
       FROM Friendships f
       JOIN Users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user._id]
    );
    res.json({ requests: rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/friends/request/:targetId — send friend request
router.post('/request/:targetId', protect, async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.user._id;
    if (targetId === userId) return res.status(400).json({ message: 'ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้' });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    const pool = getPool();
    const { rows: existing } = await pool.query(
      'SELECT status FROM Friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)',
      [userId, targetId]
    );
    if (existing.length > 0) {
      const s = existing[0].status;
      if (s === 'accepted') return res.status(400).json({ message: 'เป็นเพื่อนกันอยู่แล้ว' });
      return res.status(400).json({ message: 'มีคำขอเพื่อนรอดำเนินการอยู่แล้ว' });
    }

    await pool.query(
      'INSERT INTO Friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
      [userId, targetId, 'pending']
    );

    // Notify target if online
    const io = req.app.get('io');
    const targetEntry = getOnlineUsers().get(targetId);
    if (targetEntry && io) {
      io.to(targetEntry.socketId).emit('friend_request_received', {
        fromId:       userId,
        fromUsername: req.user.username,
        fromAvatar:   req.user.avatar || '',
      });
    }

    res.json({ message: 'ส่งคำขอเพื่อนแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/friends/accept/:fromId — accept a request
router.post('/accept/:fromId', protect, async (req, res) => {
  try {
    const { fromId } = req.params;
    const userId = req.user._id;
    const pool = getPool();

    const { rowCount } = await pool.query(
      `UPDATE Friendships SET status='accepted' WHERE user_id=$1 AND friend_id=$2 AND status='pending'`,
      [fromId, userId]
    );
    if (rowCount === 0) return res.status(404).json({ message: 'ไม่พบคำขอเพื่อน' });

    // Mirror for bidirectional lookup
    await pool.query(
      `INSERT INTO Friendships (user_id, friend_id, status) VALUES ($1,$2,'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'`,
      [userId, fromId]
    );

    // Notify sender if online
    const io = req.app.get('io');
    const fromEntry = getOnlineUsers().get(fromId);
    if (fromEntry && io) {
      io.to(fromEntry.socketId).emit('friend_request_accepted', {
        byId:       userId,
        byUsername: req.user.username,
        byAvatar:   req.user.avatar || '',
      });
    }

    res.json({ message: 'ยอมรับคำขอเพื่อนแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/friends/:friendId — remove friend or decline request
router.delete('/:friendId', protect, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;
    await getPool().query(
      'DELETE FROM Friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)',
      [userId, friendId]
    );
    res.json({ message: 'ลบเพื่อนแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
