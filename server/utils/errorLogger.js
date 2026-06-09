const { getPool } = require('../config/db');

const MAX_ERRORS = 500;

// Fire-and-forget: never throws, never blocks the caller
const logErr = async (level = 'error', event = '', message = '', opts = {}) => {
  try {
    const pool = getPool();
    if (!pool) return;
    const { stack = '', userId = null, username = null, roomId = null, url = '', metadata = {} } = opts;
    await pool.query(
      `INSERT INTO ErrorLogs (level, source, event, message, stack, user_id, username, room_id, url, metadata)
       VALUES ($1, 'server', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [level, String(event).slice(0, 100), String(message).slice(0, 2000), String(stack).slice(0, 5000), userId, username, roomId, String(url).slice(0, 500), JSON.stringify(metadata)]
    );
    // Keep only the most recent MAX_ERRORS rows to prevent unbounded growth
    pool.query(`DELETE FROM ErrorLogs WHERE id NOT IN (SELECT id FROM ErrorLogs ORDER BY created_at DESC LIMIT ${MAX_ERRORS})`).catch(() => {});
  } catch {}
};

module.exports = { logErr };
