const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Room = require('../models/Room');
const GameType = require('../models/GameType');

// In-memory state
const onlineUsers = new Map();       // userId → { socketId, username, avatar }
const matchQueues = new Map();       // gameTypeId → [{ userId, socketId, username }]
const activeRooms = new Map();       // roomId → { players: [userId] }
const pendingChallenges = new Map(); // challengeId → { from, to, gameTypeId }
const publicChatBuffer = [];         // last 50 public lobby messages
const watchTokens = new Map();       // token → { roomId, ownerUserId, expiresAt }

// Basic content filter — blocks clearly illegal/harmful content
const BLOCKED_PATTERNS = [
  /เบอร์โทร|line\s*id|โทร\s*หา|ติดต่อ\s*ได้ที่/i,  // contact solicitation
  /ยาเสพติด|ยาบ้า|กัญชา|heroin|cocaine/i,            // drugs
  /ลามก|โป๊|porn|xxx|sex\s*for/i,                      // pornography
  /พนัน|บาคาร่า|casino|gambling/i,                    // gambling
];
const isBlocked = (text) => BLOCKED_PATTERNS.some(p => p.test(text));
let currentAnnouncement = null;      // { text, author, timestamp } | null

// Rate limit state — userId → last event timestamp (ms)
const rateLimits = {
  publicMsg:  new Map(), // 1 msg / 1.5s
  queueJoin:  new Map(), // 1 join / 3s
  roomMsg:    new Map(), // 1 msg / 0.8s
};
const rateOk = (map, userId, minMs) => {
  const now = Date.now();
  if (now - (map.get(userId) || 0) < minMs) return false;
  map.set(userId, now);
  return true;
};

const MAX_CONCURRENT_USERS = 200; // Safe limit for Railway Starter plan (~512MB RAM)

const setupSocketHandlers = (io) => {
  // Authenticate socket on connection
  io.use(async (socket, next) => {
    // Watch viewer — bypass normal auth, validate watch token instead
    const wt = socket.handshake.auth?.watchToken;
    if (wt) {
      const td = watchTokens.get(wt);
      if (!td || Date.now() > td.expiresAt) return next(new Error('WATCH_TOKEN_INVALID'));
      socket.isWatcher = true;
      socket.watchToken = wt;
      socket.watchRoomId = td.roomId;
      socket.watchOwnerUserId = td.ownerUserId;
      return next();
    }
    // Reject if server is at capacity
    if (onlineUsers.size >= MAX_CONCURRENT_USERS) {
      return next(new Error('SERVER_FULL'));
    }
    const token = socket.handshake.auth?.token;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = User.toPublic(user);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Watch viewer — separate handling, not a full player
    if (socket.isWatcher) {
      setupWatchHandlers(io, socket);
      return;
    }

    const user = socket.user;
    const userId = user._id;

    onlineUsers.set(userId, { socketId: socket.id, username: user.username, avatar: user.avatar });
    io.emit('online_count', { count: onlineUsers.size });
    console.log(`[+] ${user.username} (${socket.id})`);
    // Register watch handlers for room owner too
    setupWatchHandlers(io, socket);

    // Send recent public chat history to newly connected user
    socket.emit('public_chat_history', publicChatBuffer);
    // Send current announcement if one is active
    if (currentAnnouncement) socket.emit('announcement', currentAnnouncement);

    // Fix: On reconnect, update socketId in any active queue entry
    // (socketId changes on reconnect; old entry would cause match_found to be lost)
    let wasInQueue = false;
    matchQueues.forEach((queue, gameTypeId) => {
      const entry = queue.find(p => p.userId === userId);
      if (entry && entry.socketId !== socket.id) {
        console.log(`[QUEUE] Updated socketId for ${user.username}: ${entry.socketId} → ${socket.id}`);
        entry.socketId = socket.id;
        wasInQueue = true;
      }
    });
    if (wasInQueue) {
      console.log(`[QUEUE] ${user.username} re-joined queue after reconnect`);
    }

    // ── MATCHMAKING ────────────────────────────────────────────────
    socket.on('join_queue', async ({ gameTypeId }) => {
      if (!rateOk(rateLimits.queueJoin, userId, 3000)) return;
      console.log(`\n[QUEUE] ${user.username} wants to join queue | gameTypeId=${gameTypeId}`);
      console.log(`[QUEUE] Current queues:`, JSON.stringify(Object.fromEntries(
        [...matchQueues.entries()].map(([k, v]) => [k, v.map(p => p.username)])
      )));
      console.log(`[QUEUE] Online users: ${[...onlineUsers.values()].map(u => u.username).join(', ')}`);

      if (!gameTypeId) {
        console.log(`[QUEUE] ❌ REJECTED: no gameTypeId`);
        return;
      }

      const queue = matchQueues.get(gameTypeId) || [];
      const alreadyIn = queue.find((p) => p.userId === userId);
      if (alreadyIn) {
        console.log(`[QUEUE] ⚠️ ${user.username} already in queue`);
        return;
      }
      const alreadyInRoom = [...activeRooms.values()].some(r => r.players.includes(userId));
      if (alreadyInRoom) {
        console.log(`[QUEUE] ⚠️ ${user.username} already in active room`);
        return;
      }

      const waiting = queue.find((p) => p.userId !== userId);
      if (waiting) {
        console.log(`[QUEUE] ✅ MATCH! ${user.username} <-> ${waiting.username}`);
        matchQueues.set(gameTypeId, queue.filter((p) => p.userId !== waiting.userId));

        const roomId = uuidv4();
        const gameType = await GameType.findById(gameTypeId);
        const gameInfo = { _id: gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color };

        try { await Room.create({ roomId, gameTypeId, players: [waiting.userId, userId] }); }
        catch (e) {
          console.error('[Room.create] matchmaking failed:', e.message);
          socket.emit('error', { message: 'Failed to create room, please try again' });
          return;
        }
        activeRooms.set(roomId, { players: [waiting.userId, userId] });

        const opponentInfo = onlineUsers.get(waiting.userId) || {};
        io.to(waiting.socketId).emit('match_found', { roomId, gameType: gameInfo, opponent: { _id: userId, username: user.username, avatar: user.avatar } });
        socket.emit('match_found', { roomId, gameType: gameInfo, opponent: { _id: waiting.userId, username: waiting.username, avatar: opponentInfo.avatar } });
      } else {
        console.log(`[QUEUE] 📋 ${user.username} added to queue (waiting for opponent)`);
        queue.push({ userId, socketId: socket.id, username: user.username });
        matchQueues.set(gameTypeId, queue);
        socket.emit('queue_joined', { gameTypeId, position: queue.length });
      }
    });

    // ── PUBLIC LOBBY CHAT ─────────────────────────────────────────
    socket.on('public_message', ({ message }) => {
      if (!message?.trim()) return;
      if (isBlocked(message)) return socket.emit('error', { message: 'ข้อความถูกบล็อกเนื่องจากเนื้อหาไม่เหมาะสม' });
      if (!rateOk(rateLimits.publicMsg, userId, 1500)) return;
      const msg = {
        from: { _id: userId, username: user.username, avatar: user.avatar },
        message: message.trim().slice(0, 300),
        timestamp: new Date().toISOString(),
      };
      publicChatBuffer.push(msg);
      if (publicChatBuffer.length > 50) publicChatBuffer.shift();
      io.emit('public_message', msg); // broadcast to all connected users
    });

    socket.on('leave_queue', () => {
      matchQueues.forEach((queue, gameTypeId) => {
        matchQueues.set(gameTypeId, queue.filter((p) => p.userId !== userId));
      });
      socket.emit('queue_left');
    });

    // ── DIRECT CHALLENGE ──────────────────────────────────────────
    // Challenge by Player ID (e.g. "A3B7C2")
    socket.on('challenge_by_player_id', async ({ playerId, gameTypeId }) => {
      if (!playerId || !gameTypeId) return;
      // Block if in active room
      if ([...activeRooms.values()].some(r => r.players.includes(userId)))
        return socket.emit('challenge_id_error', { message: 'ไม่สามารถท้าได้ขณะอยู่ในห้องแข่ง' });
      // Block if in matchmaking queue
      const inQueue = [...matchQueues.values()].some(q => q.some(p => p.userId === userId));
      if (inQueue)
        return socket.emit('challenge_id_error', { message: 'กรุณาออกจากคิวก่อนท้าด้วย Player ID' });
      const targetUser = await User.findByPlayerId(playerId);
      if (!targetUser) return socket.emit('challenge_id_error', { message: 'ไม่พบผู้เล่น ID นี้' });
      if (targetUser._id === userId) return socket.emit('challenge_id_error', { message: 'ไม่สามารถท้าตัวเองได้' });
      const target = onlineUsers.get(targetUser._id);
      if (!target) return socket.emit('challenge_id_error', { message: `${targetUser.username} ออฟไลน์อยู่` });

      const challengeId = uuidv4();
      const gameType = await GameType.findById(gameTypeId);
      pendingChallenges.set(challengeId, { from: userId, to: targetUser._id, gameTypeId });
      setTimeout(() => pendingChallenges.delete(challengeId), 30000);
      io.to(target.socketId).emit('challenge_received', {
        challengeId,
        from: { _id: userId, username: user.username, avatar: user.avatar },
        gameType: { _id: gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color },
      });
      socket.emit('challenge_id_sent', { to: targetUser.username });
    });

    socket.on('challenge_player', async ({ targetUserId, gameTypeId }) => {
      if (targetUserId === userId) return;
      const target = onlineUsers.get(targetUserId);
      if (!target) return socket.emit('error', { message: 'Player is offline' });

      const challengeId = uuidv4();
      const gameType = await GameType.findById(gameTypeId);
      pendingChallenges.set(challengeId, { from: userId, to: targetUserId, gameTypeId });
      setTimeout(() => pendingChallenges.delete(challengeId), 30000);

      io.to(target.socketId).emit('challenge_received', {
        challengeId,
        from: { _id: userId, username: user.username, avatar: user.avatar },
        gameType: { _id: gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color },
      });
    });

    socket.on('challenge_response', async ({ challengeId, accepted }) => {
      const challenge = pendingChallenges.get(challengeId);
      if (!challenge) return;
      pendingChallenges.delete(challengeId);

      const fromInfo = onlineUsers.get(challenge.from);
      if (!fromInfo) return;

      if (!accepted) {
        io.to(fromInfo.socketId).emit('challenge_declined', { by: user.username });
        return;
      }

      const roomId = uuidv4();
      const gameType = await GameType.findById(challenge.gameTypeId);
      const gameInfo = { _id: challenge.gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color };

      try { await Room.create({ roomId, gameTypeId: challenge.gameTypeId, players: [challenge.from, userId] }); }
      catch (e) {
        console.error('[Room.create] challenge failed:', e.message);
        socket.emit('error', { message: 'Failed to create room, please try again' });
        return;
      }
      activeRooms.set(roomId, { players: [challenge.from, userId] });

      io.to(fromInfo.socketId).emit('challenge_accepted', { roomId, gameType: gameInfo, opponent: { _id: userId, username: user.username, avatar: user.avatar } });
      socket.emit('challenge_accepted', { roomId, gameType: gameInfo, opponent: { _id: challenge.from, username: fromInfo.username, avatar: fromInfo.avatar } });
    });

    // ── WEBRTC SIGNALING ──────────────────────────────────────────
    const inRoom = (roomId) => activeRooms.get(roomId)?.players.includes(userId);
    socket.on('join_room',      ({ roomId }) => { socket.join(roomId); socket.to(roomId).emit('peer_joined', { userId }); });
    socket.on('offer',          ({ roomId, offer })     => { if (!inRoom(roomId)) return; socket.to(roomId).emit('offer',         { offer, from: userId }); });
    socket.on('answer',         ({ roomId, answer })    => { if (!inRoom(roomId)) return; socket.to(roomId).emit('answer',        { answer, from: userId }); });
    socket.on('ice_candidate',  ({ roomId, candidate }) => { if (!inRoom(roomId)) return; socket.to(roomId).emit('ice_candidate', { candidate, from: userId }); });

    // ── CHAT ──────────────────────────────────────────────────────
    socket.on('send_message', ({ roomId, message }) => {
      if (!message?.trim()) return;
      if (!rateOk(rateLimits.roomMsg, userId, 800)) return;
      // Bug fix: cap message length to prevent DoS / memory issues
      const trimmed = message.trim().slice(0, 500);
      io.to(roomId).emit('message_received', {
        from: { _id: userId, username: user.username, avatar: user.avatar },
        message: trimmed,
        timestamp: new Date().toISOString(),
      });
    });

    // ── LEAVE ROOM ────────────────────────────────────────────────
    socket.on('leave_room', async ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit('partner_disconnected');
      try { await Room.updateStatus(roomId, 'ended'); } catch {}
      activeRooms.delete(roomId);
    });

    // ── DISCONNECT ────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      matchQueues.forEach((queue, gameTypeId) => {
        matchQueues.set(gameTypeId, queue.filter((p) => p.userId !== userId));
      });
      for (const [roomId, room] of activeRooms) {
        if (room.players.includes(userId)) {
          socket.to(roomId).emit('partner_disconnected');
          try { await Room.updateStatus(roomId, 'ended'); } catch {}
          activeRooms.delete(roomId);
        }
      }
      io.emit('online_count', { count: onlineUsers.size });
      console.log(`[-] ${user.username}`);
    });
  });
};

const getOnlineUsers = () => onlineUsers;

// ── WATCH (Second Screen) handlers ──────────────────────────────
const setupWatchHandlers = (io, socket) => {
  if (socket.isWatcher) {
    // Watcher: notify the room owner that viewer connected
    const ownerInfo = onlineUsers.get(socket.watchOwnerUserId);
    if (ownerInfo) {
      io.to(ownerInfo.socketId).emit('watch_viewer_joined', { viewerSocketId: socket.id });
    }
    // Relay WebRTC signals between watcher and room owner
    socket.on('watch_answer',    ({ answer })    => { const o = onlineUsers.get(socket.watchOwnerUserId); if (o) io.to(o.socketId).emit('watch_answer', { answer, viewerSocketId: socket.id }); });
    socket.on('watch_ice_viewer',({ candidate }) => { const o = onlineUsers.get(socket.watchOwnerUserId); if (o) io.to(o.socketId).emit('watch_ice_viewer', { candidate }); });
    socket.on('disconnect', () => { const o = onlineUsers.get(socket.watchOwnerUserId); if (o) io.to(o.socketId).emit('watch_viewer_left'); });
    return;
  }
  // Room owner: generate watch token + relay signals
  socket.on('request_watch_token', ({ roomId }) => {
    const userId = socket.user._id;
    if (!activeRooms.get(roomId)?.players.includes(userId)) return;
    // Invalidate any old token for this room+user
    watchTokens.forEach((v, k) => { if (v.roomId === roomId && v.ownerUserId === userId) watchTokens.delete(k); });
    const token = require('crypto').randomBytes(4).toString('hex').toUpperCase(); // 8-char token
    watchTokens.set(token, { roomId, ownerUserId: userId, expiresAt: Date.now() + 3_600_000 });
    setTimeout(() => watchTokens.delete(token), 3_600_000);
    socket.emit('watch_token_ready', { token, roomId });
  });
  socket.on('watch_offer',    ({ viewerSocketId, offer })    => io.to(viewerSocketId).emit('watch_offer',     { offer }));
  socket.on('watch_ice_owner',({ viewerSocketId, candidate }) => io.to(viewerSocketId).emit('watch_ice_owner', { candidate }));
};

const setAnnouncement = (io, text, author) => {
  if (!text) {
    currentAnnouncement = null;
  } else {
    currentAnnouncement = { text: text.slice(0, 400), author, timestamp: new Date().toISOString() };
  }
  io.emit('announcement', currentAnnouncement);
};
const getAnnouncement = () => currentAnnouncement;

module.exports = { setupSocketHandlers, getOnlineUsers, setAnnouncement, getAnnouncement };
