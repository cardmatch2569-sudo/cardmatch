const express = require('express');
const { getPool } = require('../config/db');

const router = express.Router();

// GET /api/leaderboard?limit=50
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const { rows } = await getPool().query(
      `SELECT id, username, avatar, player_id, elo, wins, losses, total_games
       FROM Users
       WHERE total_games > 0
       ORDER BY elo DESC, wins DESC
       LIMIT $1`,
      [limit]
    );
    res.json({
      leaderboard: rows.map((r, i) => ({
        rank:       i + 1,
        userId:     r.id,
        username:   r.username,
        avatar:     r.avatar || '',
        playerId:   r.player_id,
        elo:        r.elo        || 1000,
        wins:       r.wins       || 0,
        losses:     r.losses     || 0,
        totalGames: r.total_games || 0,
        winRate: r.total_games > 0
          ? Math.round((r.wins / r.total_games) * 100)
          : 0,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
