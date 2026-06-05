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

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS Tournaments (
        id           VARCHAR(36) PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        game_type_id VARCHAR(36) NOT NULL,
        status       VARCHAR(20)  DEFAULT 'waiting',
        max_players  INTEGER      DEFAULT 16,
        created_by   VARCHAR(36)  NOT NULL,
        created_at   TIMESTAMP    DEFAULT NOW(),
        started_at   TIMESTAMP,
        ended_at     TIMESTAMP
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS TournamentPlayers (
        tournament_id VARCHAR(36) NOT NULL,
        user_id       VARCHAR(36) NOT NULL,
        joined_at     TIMESTAMP   DEFAULT NOW(),
        PRIMARY KEY (tournament_id, user_id)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS TournamentMatches (
        id            VARCHAR(36) PRIMARY KEY,
        tournament_id VARCHAR(36) NOT NULL,
        room_id       VARCHAR(50) NOT NULL,
        player1_id    VARCHAR(36) NOT NULL,
        player2_id    VARCHAR(36) NOT NULL,
        winner_id     VARCHAR(36),
        status        VARCHAR(20)  DEFAULT 'playing',
        round         INTEGER      DEFAULT 1,
        created_at    TIMESTAMP    DEFAULT NOW(),
        ended_at      TIMESTAMP
      )
    `);
    // Add multi-round columns (safe on re-deploy)
    await p.query(`ALTER TABLE Tournaments ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 3`).catch(() => {});
    await p.query(`ALTER TABLE Tournaments ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0`).catch(() => {});
    await p.query(`ALTER TABLE TournamentPlayers ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0`).catch(() => {});
    await p.query(`ALTER TABLE TournamentPlayers ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0`).catch(() => {});
    await p.query(`ALTER TABLE TournamentPlayers ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0`).catch(() => {});
    await p.query(`ALTER TABLE Tournaments ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP NULL`).catch(() => {});
    await p.query(`ALTER TABLE Tournaments ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP NULL`).catch(() => {});
    console.log('[DB] Tournament tables ready');
  } catch (e) {
    console.error('[DB] Tournament tables warning:', e.message);
  }

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
