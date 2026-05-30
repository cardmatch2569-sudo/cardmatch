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
  if (!origin) return true;
  return (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}/.test(origin) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/.test(origin) ||
    origin.includes('.trycloudflare.com') ||
    origin.includes('.vercel.app') ||
    origin.includes('.railway.app') ||
    (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)
  );
};

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

connectDB().then(async () => {
  // Reset stale active rooms on startup
  try {
    await getPool().query(`UPDATE Rooms SET status='ended', ended_at=NOW() WHERE status='active'`);
  } catch {}
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
