const express = require('express');
const jwt     = require('jsonwebtoken');
const { protect }  = require('../middleware/auth');
const { getPool }  = require('../config/db');
const { getOnlineUsers } = require('../socket/handlers');

const NOTIF_TYPE = 'meetup_interest';

const router = express.Router();

function optionalUser(req) {
  try {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) {
      const d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
      return d.id || d._id || null;
    }
  } catch {}
  return null;
}

// GET /api/meetup — public, optional auth for interest status
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const province = typeof req.query.province === 'string' ? req.query.province.slice(0, 100) : '';
    const period   = typeof req.query.period   === 'string' ? req.query.period : '';
    const currentUserId = optionalUser(req);

    const params = [];
    const conds  = [`mp.status = 'active'`, `mp.scheduled_at > NOW() - INTERVAL '30 minutes'`];

    if (province) {
      params.push(province);
      conds.push(`mp.province = $${params.length}`);
    }
    if (period === 'today')     conds.push(`mp.scheduled_at < NOW() + INTERVAL '24 hours'`);
    if (period === 'week')      conds.push(`mp.scheduled_at < NOW() + INTERVAL '7 days'`);
    if (period === 'next_week') {
      conds.push(`mp.scheduled_at >= NOW() + INTERVAL '7 days'`);
      conds.push(`mp.scheduled_at < NOW() + INTERVAL '14 days'`);
    }

    let interestSel  = ', false AS i_am_interested, 0 AS new_interest';
    let interestJoin = '';
    if (currentUserId) {
      params.push(currentUserId);
      const pn = params.length;
      interestJoin = `LEFT JOIN MeetupInterests mi_u ON mi_u.post_id = mp.id AND mi_u.user_id = $${pn}`;
      interestSel  = `, (mi_u.user_id IS NOT NULL) AS i_am_interested,
        (SELECT COUNT(*) FROM Notifications n
          WHERE n.user_id = $${pn} AND n.type = '${NOTIF_TYPE}' AND n.read = FALSE
            AND n.data->>'postId' = mp.id::text) AS new_interest`;
      if (req.query.mine === '1') conds.push(`mp.user_id = $${pn}`);
    }

    const { rows } = await pool.query(
      `SELECT mp.id, mp.province, mp.location_name, mp.scheduled_at,
              mp.players_needed, mp.note, mp.created_at,
              (SELECT COUNT(*) FROM MeetupInterests mi WHERE mi.post_id = mp.id) AS interest_count,
              mp.lat, mp.lng, mp.address,
              u.id AS user_id, u.username, u.avatar, u.elo, u.wins, u.losses,
              (SELECT COUNT(*) FROM MeetupPosts mp2 WHERE mp2.user_id = u.id) AS hosted_count
              ${interestSel}
       FROM MeetupPosts mp
       JOIN Users u ON u.id = mp.user_id
       ${interestJoin}
       WHERE ${conds.join(' AND ')}
       ORDER BY mp.scheduled_at ASC
       LIMIT 100`,
      params
    );

    res.json({
      posts: rows.map(r => ({
        id:            r.id,
        province:      r.province,
        locationName:  r.location_name,
        scheduledAt:   r.scheduled_at,
        playersNeeded: r.players_needed,
        note:          r.note,
        interestCount: parseInt(r.interest_count) || 0,
        createdAt:     r.created_at,
        iAmInterested: r.i_am_interested || false,
        newInterest:   parseInt(r.new_interest) || 0,
        lat:           r.lat,
        lng:           r.lng,
        address:       r.address || '',
        host: {
          id:          r.user_id,
          username:    r.username,
          avatar:      r.avatar || '',
          elo:         r.elo || 1000,
          wins:        r.wins || 0,
          losses:      r.losses || 0,
          hostedCount: parseInt(r.hosted_count) || 0,
        },
      })),
    });
  } catch (err) {
    console.error('[meetup] GET error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

const MAX_ACTIVE_POSTS = 5;
const MAX_DAYS_AHEAD   = 90;

const parseId = (v) => (/^\d{1,9}$/.test(String(v)) ? parseInt(v, 10) : null);

// POST /api/meetup — create post (auth required)
router.post('/', protect, async (req, res) => {
  try {
    const { playersNeeded, note, address } = req.body;
    const province     = String(req.body.province || '').trim().slice(0, 100);
    const locationName = String(req.body.locationName || '').trim().slice(0, 200);
    if (!province || !locationName || !req.body.scheduledAt) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
    }
    // Client must send an ISO string with timezone; a bare local time would be read as UTC here
    const when = new Date(req.body.scheduledAt);
    if (isNaN(when.getTime())) {
      return res.status(400).json({ message: 'รูปแบบวันเวลาไม่ถูกต้อง' });
    }
    if (when <= new Date()) {
      return res.status(400).json({ message: 'วันเวลาที่เลือกต้องเป็นอนาคต' });
    }
    if (when > new Date(Date.now() + MAX_DAYS_AHEAD * 86400000)) {
      return res.status(400).json({ message: `นัดล่วงหน้าได้ไม่เกิน ${MAX_DAYS_AHEAD} วัน` });
    }
    let lat = parseFloat(req.body.lat);
    let lng = parseFloat(req.body.lng);
    // Thailand bounding box; anything outside is dropped rather than rejected
    if (!(lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106)) { lat = null; lng = null; }
    const pool = getPool();
    const { rows: [{ n }] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM MeetupPosts
       WHERE user_id = $1 AND status = 'active' AND scheduled_at > NOW()`,
      [req.user._id]
    );
    if (n >= MAX_ACTIVE_POSTS) {
      return res.status(429).json({ message: `โพสต์นัดที่ยังไม่ถึงเวลาได้สูงสุด ${MAX_ACTIVE_POSTS} โพสต์ กรุณาลบโพสต์เก่าก่อน` });
    }
    const { rows } = await pool.query(
      `INSERT INTO MeetupPosts (user_id, province, location_name, scheduled_at, players_needed, note, lat, lng, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        req.user._id,
        province,
        locationName,
        when.toISOString(),
        Math.min(Math.max(parseInt(playersNeeded) || 1, 1), 10),
        String(note || '').slice(0, 200),
        lat,
        lng,
        lat === null ? '' : String(address || '').slice(0, 300),
      ]
    );
    res.json({ id: rows[0].id });
  } catch (err) {
    console.error('[meetup] POST error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetup/:id/interest — toggle interest
router.post('/:id/interest', protect, async (req, res) => {
  try {
    const pool   = getPool();
    const postId = parseId(req.params.id);
    const userId = req.user._id;
    if (postId === null) return res.status(404).json({ message: 'ไม่พบโพสต์' });

    const { rows: [post] } = await pool.query(
      `SELECT id, user_id, location_name, scheduled_at FROM MeetupPosts WHERE id = $1 AND status = 'active'`,
      [postId]
    );
    if (!post) return res.status(404).json({ message: 'ไม่พบโพสต์' });
    if (post.user_id === userId)
      return res.status(400).json({ message: 'ไม่สามารถกดสนใจโพสต์ตัวเองได้' });

    const { rowCount } = await pool.query(
      `DELETE FROM MeetupInterests WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );
    const nowInterested = rowCount === 0;
    if (nowInterested) {
      await pool.query(
        `INSERT INTO MeetupInterests (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [postId, userId]
      );
    }

    // One unread notification per (post, user): toggling off/on must not stack duplicates
    await pool.query(
      `DELETE FROM Notifications
       WHERE user_id = $1 AND type = $2 AND read = FALSE
         AND data->>'postId' = $3 AND data->>'fromId' = $4`,
      [post.user_id, NOTIF_TYPE, String(postId), userId]
    );
    if (nowInterested) {
      const data = {
        postId,
        fromId:       userId,
        fromUsername: req.user.username,
        locationName: post.location_name,
        scheduledAt:  post.scheduled_at,
      };
      await pool.query(
        `INSERT INTO Notifications (user_id, type, data) VALUES ($1, $2, $3)`,
        [post.user_id, NOTIF_TYPE, JSON.stringify(data)]
      );
      const io = req.app.get('io');
      const hostEntry = getOnlineUsers().get(post.user_id);
      if (hostEntry && io) io.to(hostEntry.socketId).emit('meetup_interest', data);
    }

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM MeetupInterests WHERE post_id = $1`,
      [postId]
    );
    res.json({ interested: nowInterested, interestCount: count });
  } catch (err) {
    console.error('[meetup] interest error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/meetup/:id — delete own post
router.delete('/:id', protect, async (req, res) => {
  try {
    const pool = getPool();
    const postId = parseId(req.params.id);
    if (postId === null) return res.status(404).json({ message: 'ไม่พบโพสต์' });
    const { rowCount } = await pool.query(
      `DELETE FROM MeetupPosts WHERE id = $1 AND user_id = $2`,
      [postId, req.user._id]
    );
    if (rowCount === 0)
      return res.status(403).json({ message: 'ไม่พบโพสต์หรือไม่มีสิทธิ์ลบ' });
    await pool.query(
      `DELETE FROM Notifications WHERE type = $1 AND data->>'postId' = $2`,
      [NOTIF_TYPE, String(postId)]
    );
    res.json({ message: 'ลบโพสต์แล้ว' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetup/notifications/count — unread "someone is interested" count for the host
router.get('/notifications/count', protect, async (req, res) => {
  try {
    const { rows: [{ count }] } = await getPool().query(
      `SELECT COUNT(*)::int AS count FROM Notifications n
       JOIN MeetupPosts mp ON mp.id::text = n.data->>'postId'
       WHERE n.user_id = $1 AND n.type = $2 AND n.read = FALSE AND mp.status = 'active'`,
      [req.user._id, NOTIF_TYPE]
    );
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetup/:id/interested — host only: who is interested + friend status; marks them seen
router.get('/:id/interested', protect, async (req, res) => {
  try {
    const pool   = getPool();
    const postId = parseId(req.params.id);
    const hostId = req.user._id;
    if (postId === null) return res.status(404).json({ message: 'ไม่พบโพสต์' });

    const { rows: [post] } = await pool.query(
      `SELECT user_id FROM MeetupPosts WHERE id = $1`, [postId]
    );
    if (!post) return res.status(404).json({ message: 'ไม่พบโพสต์' });
    if (post.user_id !== hostId)
      return res.status(403).json({ message: 'ดูรายชื่อได้เฉพาะเจ้าของโพสต์' });

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.elo, u.wins, u.losses, mi.created_at,
              (SELECT status FROM Friendships WHERE user_id = $2 AND friend_id = u.id) AS out_status,
              (SELECT status FROM Friendships WHERE user_id = u.id AND friend_id = $2) AS in_status
       FROM MeetupInterests mi
       JOIN Users u ON u.id = mi.user_id
       WHERE mi.post_id = $1
       ORDER BY mi.created_at DESC NULLS LAST`,
      [postId, hostId]
    );
    await pool.query(
      `UPDATE Notifications SET read = TRUE
       WHERE user_id = $1 AND type = $2 AND read = FALSE AND data->>'postId' = $3`,
      [hostId, NOTIF_TYPE, String(postId)]
    );

    const online = getOnlineUsers();
    res.json({
      users: rows.map(r => ({
        id:       r.id,
        username: r.username,
        avatar:   r.avatar || '',
        elo:      r.elo || 1000,
        wins:     r.wins || 0,
        losses:   r.losses || 0,
        isOnline: online.has(r.id),
        friendStatus:
          r.out_status === 'accepted' || r.in_status === 'accepted' ? 'friends'
          : r.out_status === 'pending' ? 'sent'
          : r.in_status  === 'pending' ? 'received'
          : 'none',
      })),
    });
  } catch (err) {
    console.error('[meetup] interested error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
