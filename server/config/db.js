const { Pool } = require('pg');

let pool;

const getPool = () => pool;

// Chars: uppercase letters + digits, excluding confusing pairs (0/O, 1/I)
const PID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generatePlayerId = () => {
  let id = '';
  for (let i = 0; i < 6; i++) id += PID_CHARS[Math.floor(Math.random() * PID_CHARS.length)];
  return id;
};

const initTables = async () => {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS Users (
      id           VARCHAR(36)  PRIMARY KEY,
      username     VARCHAR(20)  NOT NULL UNIQUE,
      email        VARCHAR(255) NOT NULL UNIQUE,
      password     VARCHAR(255) NOT NULL DEFAULT '',
      avatar       VARCHAR(500) DEFAULT '',
      is_admin     BOOLEAN      DEFAULT FALSE,
      google_id    VARCHAR(255),
      player_id    VARCHAR(8)   UNIQUE,
      total_games  INTEGER      DEFAULT 0,
      wins         INTEGER      DEFAULT 0,
      losses       INTEGER      DEFAULT 0,
      created_at   TIMESTAMP    DEFAULT NOW(),
      updated_at   TIMESTAMP    DEFAULT NOW()
    )
  `);
  // Add player_id for existing deployments that pre-date this column
  await p.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS player_id VARCHAR(8) UNIQUE`).catch(() => {});
  // Generate player_ids for any users that don't have one yet
  const { rows: noId } = await p.query('SELECT id FROM Users WHERE player_id IS NULL');
  for (const u of noId) {
    let pid; let tries = 0;
    do {
      pid = generatePlayerId();
      const { rows } = await p.query('SELECT 1 FROM Users WHERE player_id=$1', [pid]);
      if (!rows.length) break;
    } while (++tries < 50);
    if (pid) await p.query('UPDATE Users SET player_id=$1 WHERE id=$2', [pid, u.id]);
  }

  await p.query(`
    CREATE TABLE IF NOT EXISTS GameTypes (
      id             VARCHAR(36)  PRIMARY KEY,
      name           VARCHAR(100) NOT NULL UNIQUE,
      name_th        VARCHAR(200) NOT NULL,
      description    VARCHAR(500) DEFAULT '',
      description_th VARCHAR(500) DEFAULT '',
      image_url      VARCHAR(500) DEFAULT '',
      color          VARCHAR(20)  DEFAULT '#6366f1',
      is_active      BOOLEAN      DEFAULT TRUE,
      created_at     TIMESTAMP    DEFAULT NOW(),
      updated_at     TIMESTAMP    DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS Rooms (
      id           VARCHAR(36) PRIMARY KEY,
      room_id      VARCHAR(50) NOT NULL UNIQUE,
      game_type_id VARCHAR(36) NOT NULL,
      status       VARCHAR(20) DEFAULT 'waiting',
      created_at   TIMESTAMP   DEFAULT NOW(),
      ended_at     TIMESTAMP
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS RoomPlayers (
      room_id  VARCHAR(50) NOT NULL,
      user_id  VARCHAR(36) NOT NULL,
      PRIMARY KEY (room_id, user_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS EmailVerifications (
      id          VARCHAR(36) PRIMARY KEY,
      email       VARCHAR(255) NOT NULL,
      code        VARCHAR(10)  NOT NULL,
      google_data TEXT         NOT NULL DEFAULT '{}',
      expires_at  TIMESTAMP    NOT NULL,
      used        BOOLEAN      DEFAULT FALSE,
      created_at  TIMESTAMP    DEFAULT NOW()
    )
  `);

  if (noId.length) console.log(`[DB] Generated player_id for ${noId.length} existing user(s)`);
  console.log('Tables initialized (PostgreSQL)');
};

const connectDB = async () => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    });
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
    await initTables();
  } catch (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = { connectDB, getPool, generatePlayerId };
