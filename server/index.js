require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_key_change_this_in_production') {
  console.error('FATAL: JWT_SECRET is not set. Set it in server/.env');
  process.exit(1);
}

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const os     = require('os');

const { connectDB, getPool } = require('./config/db');
const authRoutes              = require('./routes/auth');
const userRoutes              = require('./routes/users');
const gameRoutes              = require('./routes/games');
const adminRoutes             = require('./routes/admin');
const { setupSocketHandlers } = require('./socket/handlers');

const isAllowedOrigin = (origin) => {
  if (!origin) return false; // Block requests with no Origin header
  const exact = process.env.CLIENT_URL;
  if (exact && origin === exact) return true;
  // Allow localhost/LAN in dev; block everything else in prod
  if (process.env.NODE_ENV === 'production') return false;
  return (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    /^https?:\/\/192\.168\./.test(origin) ||
    /^https?:\/\/10\./.test(origin) ||
    origin.includes('.vercel.app') // preview deploys during development
  );
};

// ── In-memory login rate limiter (per IP) ────────────────────────
const loginAttempts = new Map(); // ip → { count, resetAt }
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const checkLoginRate = (ip) => {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + LOGIN_WINDOW_MS; }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) return false;
  entry.count++;
  loginAttempts.set(ip, entry);
  return true;
};
// Clean up old entries every 30 minutes
setInterval(() => { const now = Date.now(); loginAttempts.forEach((v, k) => { if (now > v.resetAt) loginAttempts.delete(k); }); }, 30 * 60 * 1000);

const corsOptions = {
  origin: (origin, cb) => isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`CORS blocked: ${origin}`)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

app.set('io', io); // make io available to route handlers (announcements)
app.set('checkLoginRate', checkLoginRate); // expose to auth routes

// ── Security headers ──────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',           'DENY');
  res.setHeader('X-XSS-Protection',          '1; mode=block');
  res.setHeader('Referrer-Policy',            'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',         'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

connectDB().then(async () => {
  // Reset stale active rooms on startup
  try {
    await getPool().query(`UPDATE Rooms SET status='ended', ended_at=NOW() WHERE status='active'`);
  } catch {}

  // Cleanup expired/used OTPs older than 1 hour
  try {
    const { rowCount } = await getPool().query(
      `DELETE FROM EmailVerifications WHERE used=TRUE OR expires_at < NOW() - INTERVAL '1 hour'`
    );
    if (rowCount > 0) console.log(`[DB] Cleaned up ${rowCount} old OTP record(s)`);
  } catch {}

  // Schedule daily OTP cleanup (every 24h)
  setInterval(async () => {
    try {
      await getPool().query(
        `DELETE FROM EmailVerifications WHERE used=TRUE OR expires_at < NOW() - INTERVAL '1 hour'`
      );
    } catch {}
  }, 24 * 60 * 60 * 1000);

  // Auto-seed game types if none exist
  try {
    // Ensure required games exist — upsert by name on every startup
    const GameType = require('./models/GameType');
    const REQUIRED_GAMES = [
      { name: 'Battle of Talingchan', nameTh: 'แบทเทิลออฟตลิ่งชัน',     description: 'Thai card battle game.',                 descriptionTh: 'เกมการ์ดต่อสู้สัญชาติไทย', color: '#e11d48' },
      { name: 'Cardfight!! Vanguard', nameTh: 'การ์ดไฟต์!! แวนการ์ด', description: 'Japanese trading card game by Bushiroad.', descriptionTh: 'เกมการ์ดญี่ปุ่นโดย Bushiroad', color: '#1d4ed8' },
    ];
    for (const g of REQUIRED_GAMES) {
      const existing = await GameType.findByName(g.name);
      if (!existing) { await GameType.create(g); console.log(`+ Game added: ${g.name}`); }
    }
    // Clean up: remove 'Thai Card Battle' interim entry if it exists
    try { await getPool().query(`DELETE FROM GameTypes WHERE name='Thai Card Battle'`); } catch {}
  } catch (e) { console.warn('Auto-seed warning:', e.message); }
}).catch(() => {});

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth',  authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);

setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    const nets = os.networkInterfaces();
    console.log(`   Local  : http://localhost:${PORT}`);
    for (const n of Object.keys(nets)) {
      for (const net of nets[n]) {
        if (net.family === 'IPv4' && !net.internal)
          console.log(`   Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('');
});
