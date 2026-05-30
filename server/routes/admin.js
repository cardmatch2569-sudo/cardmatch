const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const User     = require('../models/User');
const { getPool } = require('../config/db');
const { getOnlineUsers } = require('../socket/handlers');

const router = express.Router();

// ── STATS ────────────────────────────────────────────────────────
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const [users, rooms, activeRooms, games, otps] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM Users'),
      pool.query('SELECT COUNT(*) AS cnt FROM Rooms'),
      pool.query("SELECT COUNT(*) AS cnt FROM Rooms WHERE status='active'"),
      pool.query('SELECT COUNT(*) AS cnt FROM GameTypes WHERE is_active=TRUE'),
      pool.query("SELECT COUNT(*) AS cnt FROM EmailVerifications WHERE used=FALSE AND expires_at > NOW()"),
    ]);
    res.json({
      totalUsers:  parseInt(users.rows[0].cnt, 10),
      totalRooms:  parseInt(rooms.rows[0].cnt, 10),
      activeRooms: parseInt(activeRooms.rows[0].cnt, 10),
      activeGames: parseInt(games.rows[0].cnt, 10),
      pendingOTPs: parseInt(otps.rows[0].cnt, 10),
      onlineUsers: getOnlineUsers().size,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── USERS LIST ───────────────────────────────────────────────────
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { search = '', page = 1, limit = 15 } = req.query;
    const q      = `%${search}%`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT id,username,email,is_admin,avatar,total_games,wins,losses,google_id,created_at
         FROM Users
         WHERE username ILIKE $1 OR email ILIKE $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [q, parseInt(limit), offset]
      ),
      pool.query(
        'SELECT COUNT(*) AS cnt FROM Users WHERE username ILIKE $1 OR email ILIKE $1',
        [q]
      ),
    ]);

    const online = getOnlineUsers();
    const users = rows.rows.map(r => ({
      _id:       r.id,
      username:  r.username,
      email:     r.email,
      isAdmin:   !!r.is_admin,
      avatar:    r.avatar || '',
      hasGoogle: !!r.google_id,
      isOnline:  online.has(r.id),
      stats:     { totalGames: r.total_games || 0, wins: r.wins || 0, losses: r.losses || 0 },
      createdAt: r.created_at,
    }));

    res.json({ users, total: parseInt(total.rows[0].cnt, 10), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── TOGGLE ADMIN ROLE ────────────────────────────────────────────
router.put('/users/:id/role', protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user._id)
      return res.status(400).json({ message: 'ไม่สามารถเปลี่ยนสิทธิ์ตัวเองได้' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    await getPool().query(
      'UPDATE Users SET is_admin=$1 WHERE id=$2',
      [!user.isAdmin, req.params.id]
    );
    res.json({ message: 'อัปเดตสิทธิ์แล้ว', isAdmin: !user.isAdmin });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ROOMS HISTORY ────────────────────────────────────────────────
router.get('/rooms', protect, adminOnly, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT r.room_id AS "RoomId", r.status AS "Status",
              r.created_at AS "CreatedAt", r.ended_at AS "EndedAt",
              g.name AS "GameName", g.name_th AS "GameNameTh", g.color AS "GameColor"
       FROM Rooms r
       LEFT JOIN GameTypes g ON r.game_type_id = g.id
       ORDER BY r.created_at DESC LIMIT 30`
    );
    res.json({ rooms: rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ONLINE USERS ─────────────────────────────────────────────────
router.get('/online', protect, adminOnly, (req, res) => {
  const online = Array.from(getOnlineUsers().entries()).map(([userId, info]) => ({
    userId, username: info.username, avatar: info.avatar,
  }));
  res.json({ online });
});

module.exports = router;
