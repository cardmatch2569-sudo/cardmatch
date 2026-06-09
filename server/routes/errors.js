const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getPool } = require('../config/db');

const router = express.Router();

// Per-user rate limit: max 1 client error stored per 10s (prevents log spam)
const clientRateLimit = new Map(); // userId → lastReportedAt
const clientRateOk = (userId) => {
  const now = Date.now();
  if (now - (clientRateLimit.get(userId) || 0) < 10000) return false;
  clientRateLimit.set(userId, now);
  return true;
};
// Clean up stale entries every hour
setInterval(() => {
  const cutoff = Date.now() - 60000;
  clientRateLimit.forEach((v, k) => { if (v < cutoff) clientRateLimit.delete(k); });
}, 3600000);

// POST /api/errors/client — receive client-side error reports (auth required)
router.post('/client', protect, async (req, res) => {
  res.json({ ok: true }); // respond immediately — don't block the client
  if (!clientRateOk(req.user.id)) return;
  try {
    const { event = 'client_error', message = '', stack = '', url = '', metadata = {} } = req.body;
    if (!message) return;
    const pool = getPool();
    await pool.query(
      `INSERT INTO ErrorLogs (level, source, event, message, stack, user_id, username, url, metadata)
       VALUES ('error', 'client', $1, $2, $3, $4, $5, $6, $7)`,
      [String(event).slice(0, 100), String(message).slice(0, 2000), String(stack).slice(0, 5000), req.user.id, req.user.username, String(url).slice(0, 500), JSON.stringify(metadata || {})]
    );
    pool.query(`DELETE FROM ErrorLogs WHERE id NOT IN (SELECT id FROM ErrorLogs ORDER BY created_at DESC LIMIT 500)`).catch(() => {});
  } catch {}
});

// GET /api/errors — list recent errors (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { level, source, limit = 100 } = req.query;
    const pool = getPool();
    const params = [];
    const conditions = [];
    if (level)  { params.push(level);  conditions.push(`level=$${params.length}`); }
    if (source) { params.push(source); conditions.push(`source=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit) || 100, 500));
    const { rows } = await pool.query(
      `SELECT id, level, source, event, message, stack, user_id, username, room_id, url, metadata, created_at
       FROM ErrorLogs ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    const { rows: [{ cnt }] } = await pool.query('SELECT COUNT(*) AS cnt FROM ErrorLogs');
    res.json({ errors: rows, total: parseInt(cnt, 10) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/errors/:id — delete one error
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await getPool().query('DELETE FROM ErrorLogs WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/errors — clear all errors
router.delete('/', protect, adminOnly, async (req, res) => {
  try {
    await getPool().query('DELETE FROM ErrorLogs');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
