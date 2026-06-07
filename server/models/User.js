const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool, generatePlayerId } = require('../config/db');

const fmt = (row) => {
  if (!row) return null;
  return {
    _id:      row.id,
    playerId: row.player_id || null,
    username: row.username,
    email:    row.email,
    password: row.password,
    avatar:   row.avatar || '',
    isAdmin:  !!row.is_admin,
    googleId: row.google_id || null,
    stats: {
      totalGames: row.total_games || 0,
      wins:       row.wins        || 0,
      losses:     row.losses      || 0,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// Generate unique player_id with retry
async function makeUniquePlayerId(pool) {
  let pid; let tries = 0;
  do {
    pid = generatePlayerId();
    const { rows } = await pool.query('SELECT 1 FROM Users WHERE player_id=$1', [pid]);
    if (!rows.length) return pid;
  } while (++tries < 50);
  throw new Error('Failed to generate unique player_id');
}

const User = {
  async create({ username, email, password, isAdmin = false }) {
    const pool = getPool();
    const id  = uuidv4();
    const pid = await makeUniquePlayerId(pool);
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO Users (id, username, email, password, is_admin, player_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, username, email.toLowerCase().trim(), hash, isAdmin, pid]
    );
    return fmt(rows[0]);
  },

  async createWithGoogle({ googleId, email, username, avatar = '', isAdmin = false }) {
    const pool = getPool();
    const id  = uuidv4();
    const pid = await makeUniquePlayerId(pool);
    const { rows } = await pool.query(
      `INSERT INTO Users (id, username, email, password, google_id, avatar, is_admin, player_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, username, email.toLowerCase().trim(), '', googleId, avatar, isAdmin, pid]
    );
    return fmt(rows[0]);
  },

  async createFromVerifiedEmail({ username, email, hashedPassword, isAdmin = false }) {
    const pool = getPool();
    const id  = uuidv4();
    const pid = await makeUniquePlayerId(pool);
    const { rows } = await pool.query(
      `INSERT INTO Users (id, username, email, password, is_admin, player_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, username, email.toLowerCase().trim(), hashedPassword, isAdmin, pid]
    );
    return fmt(rows[0]);
  },

  async findById(id) {
    const { rows } = await getPool().query('SELECT * FROM Users WHERE id=$1', [id]);
    return fmt(rows[0]);
  },

  async findByEmail(email) {
    const { rows } = await getPool().query('SELECT * FROM Users WHERE email=$1', [email.toLowerCase().trim()]);
    return fmt(rows[0]);
  },

  async findByUsername(username) {
    const { rows } = await getPool().query('SELECT * FROM Users WHERE username=$1', [username]);
    return fmt(rows[0]);
  },

  async findByEmailOrUsername(email, username) {
    const { rows } = await getPool().query(
      'SELECT * FROM Users WHERE email=$1 OR username=$2',
      [email.toLowerCase().trim(), username]
    );
    return fmt(rows[0]);
  },

  async findByGoogleId(googleId) {
    const { rows } = await getPool().query('SELECT * FROM Users WHERE google_id=$1', [googleId]);
    return fmt(rows[0]);
  },

  async count() {
    const { rows } = await getPool().query('SELECT COUNT(*) AS cnt FROM Users');
    return parseInt(rows[0].cnt, 10);
  },

  async findByPlayerId(playerId) {
    const { rows } = await getPool().query(
      'SELECT * FROM Users WHERE player_id=$1',
      [playerId.toUpperCase().trim()]
    );
    return fmt(rows[0]);
  },

  async search(query, excludeId) {
    const { rows } = await getPool().query(
      `SELECT id,username,avatar,player_id,total_games,wins,losses
       FROM Users
       WHERE username ILIKE $1 AND id <> $2
       LIMIT 10`,
      [`%${query}%`, excludeId]
    );
    return rows.map(fmt);
  },

  async update(id, { avatar }) {
    const { rows } = await getPool().query(
      'UPDATE Users SET avatar=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [avatar ?? '', id]
    );
    return fmt(rows[0]);
  },

  async linkGoogle(id, googleId, avatar) {
    await getPool().query(
      `UPDATE Users SET google_id=$1,
         avatar = CASE WHEN avatar='' THEN $2 ELSE avatar END
       WHERE id=$3`,
      [googleId, avatar || '', id]
    );
  },

  async comparePassword(plain, hash) {
    if (!hash) return false;
    return bcrypt.compare(plain, hash);
  },

  toPublic(user) {
    if (!user) return null;
    const { password, ...pub } = user;
    return { ...pub, hasPassword: !!password };
  },
};

module.exports = User;
