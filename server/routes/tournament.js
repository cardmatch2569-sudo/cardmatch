const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getPool } = require('../config/db');
const { getTournaments, getTourneyMatchesMap, getOnlineUsers } = require('../socket/handlers');

const router = express.Router();

// GET /api/tournament — list open + active tournaments
router.get('/', protect, async (req, res) => {
  try {
    const ts = getTournaments();
    const pool = getPool();
    const { rows: gameTypes } = await pool.query('SELECT id, name, name_th FROM GameTypes');
    const gameTypeMap = Object.fromEntries(gameTypes.map(g => [g.id, g]));
    const list = [...ts.values()]
      .filter(t => t.status !== 'ended')
      .map(t => ({
        id:              t.id,
        name:            t.name,
        gameTypeId:      t.gameTypeId,
        gameTypeName:    gameTypeMap[t.gameTypeId]?.name    || '',
        gameTypeNameTh:  gameTypeMap[t.gameTypeId]?.name_th || '',
        status:          t.status,
        maxPlayers:      t.maxPlayers,
        totalRounds:     t.totalRounds  || 3,
        currentRound:    t.currentRound || 0,
        playerCount:     t.players.size,
        isJoined:        t.players.has(req.user._id),
        scheduledAt:     t.scheduledAt  || null,
        scheduledEnd:    t.scheduledEnd || null,
      }));
    res.json({ tournaments: list });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/tournament/admin/all — all tournaments with stats (admin) — MUST be before /:id
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT t.id, t.name, t.status, t.max_players, t.created_at,
              g.name AS game_name, g.name_th AS game_name_th, g.color AS game_color,
              u.username AS created_by_name
       FROM Tournaments t
       LEFT JOIN GameTypes g ON t.game_type_id = g.id
       LEFT JOIN Users     u ON t.created_by   = u.id
       ORDER BY t.created_at DESC
       LIMIT 30`
    );
    const live = getTournaments();
    const list = rows.map(r => ({
      ...r,
      livePlayerCount: live.get(r.id)?.players.size ?? 0,
      liveStatus:      live.get(r.id)?.status || r.status,
    }));
    res.json({ tournaments: list });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/tournament/:id — tournament details + players + matches
router.get('/:id', protect, async (req, res) => {
  try {
    const ts = getTournaments();
    const t  = ts.get(req.params.id);
    if (!t) return res.status(404).json({ message: 'ไม่พบ Tournament' });

    const pool = getPool();
    const { rows: matches } = await pool.query(
      `SELECT tm.id, tm.room_id, tm.player1_id, tm.player2_id, tm.winner_id, tm.status,
              u1.username AS player1_name, u2.username AS player2_name,
              uw.username AS winner_name
       FROM TournamentMatches tm
       LEFT JOIN Users u1 ON tm.player1_id = u1.id
       LEFT JOIN Users u2 ON tm.player2_id = u2.id
       LEFT JOIN Users uw ON tm.winner_id  = uw.id
       WHERE tm.tournament_id = $1
       ORDER BY tm.created_at ASC`,
      [req.params.id]
    );

    const liveMap = getTourneyMatchesMap();
    const matchesOut = matches.map(m => ({
      id:         m.id,
      roomId:     m.room_id,
      player1Id:  m.player1_id,
      player1Name: m.player1_name,
      player2Id:  m.player2_id,
      player2Name: m.player2_name,
      winnerId:   m.winner_id,
      winnerName: m.winner_name,
      status:     m.status,
      phase:      liveMap.get(m.room_id)?.phase || m.status,
    }));

    const online = getOnlineUsers();
    const buchholzOf = (playerId) => {
      let score = 0;
      if (!t.h2h) return score;
      for (const [key, winnerId] of t.h2h) {
        if (winnerId !== playerId) continue;
        const [x, y] = key.split('_');
        const loserId = x === playerId ? y : x;
        score += t.points?.get(loserId) || 0;
      }
      return score;
    };
    const playersInfo = [...t.players].map(id => {
      const info = online.get(id);
      return {
        userId:   id,
        username: info?.username || t.playerNames?.get(id) || '?', // BUG-07
        avatar:   info?.avatar  || '',
        points:   (t.points && t.points.get(id)) || 0,
        isOnline: !!info,
      };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const key = [a.userId, b.userId].sort().join('_');
      const winner = t.h2h?.get(key);
      if (winner === a.userId) return -1;
      if (winner === b.userId) return 1;
      return buchholzOf(b.userId) - buchholzOf(a.userId);
    });

    res.json({
      tournament: {
        id:               t.id,
        name:             t.name,
        gameTypeId:       t.gameTypeId,
        status:           t.status,
        phase:            t.phase || 'group',
        maxPlayers:       t.maxPlayers,
        totalRounds:      t.totalRounds,
        currentRound:     t.currentRound,
        activeMatchCount: t.activeMatchCount,
        playerCount:      t.players.size,
        isJoined:         t.players.has(req.user._id),
        playersInfo,
        matches:          matchesOut,
        scheduledAt:      t.scheduledAt || null,
        scheduledEnd:     t.scheduledEnd || null,
        playoffBracket:   t.playoffBracket   || null,
        playoffQualifiers: t.playoffQualifiers || [],
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/tournament/:id — close (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const ts = getTournaments();
    const t  = ts.get(req.params.id);
    if (!t) return res.status(404).json({ message: 'ไม่พบ Tournament' });

    t.status = 'ended';
    await getPool().query("UPDATE Tournaments SET status='ended', ended_at=NOW() WHERE id=$1", [req.params.id]);
    const io = req.app.get('io');
    io.emit('tournament_closed', { tournamentId: req.params.id });
    ts.delete(req.params.id);

    res.json({ message: 'ปิด Tournament แล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
