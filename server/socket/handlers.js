const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Room = require('../models/Room');
const GameType = require('../models/GameType');
const { getPool } = require('../config/db');
const log = require('../utils/logger');

// ── In-memory state ────────────────────────────────────────────────
const onlineUsers = new Map();       // userId → { socketId, username, avatar, isAdmin }
const matchQueues = new Map();       // gameTypeId → [{ userId, socketId, username }]
const activeRooms = new Map();       // roomId → { players: [userId], isTournament?: boolean }
const pendingChallenges = new Map(); // challengeId → { from, to, gameTypeId }
const publicChatBuffer = [];         // last 50 public lobby messages

// Tournament in-memory state
const tournaments    = new Map();    // tournamentId → { id, name, gameTypeId, status, maxPlayers, totalRounds, currentRound, activeMatchCount, playedPairs: Set, points: Map, createdBy, players: Set<userId> }
const tourneyMatches = new Map();    // roomId → { matchId, tournamentId, players:[p1,p2], results: Map, phase, timer }
const adminWatching  = new Map();    // roomId → { adminUserId, adminSocketId }

// ── Pairing: random, no-repeat (greedy with fallback) ─────────────────
const pairPlayersNoRepeat = (playerIds, playedPairs) => {
  const arr = [...playerIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const pairs = [];
  const unpaired = [...arr];
  while (unpaired.length >= 2) {
    const p1 = unpaired.shift();
    let bestIdx = unpaired.findIndex(p2 => !playedPairs.has([p1, p2].sort().join('_')));
    if (bestIdx === -1) bestIdx = 0; // forced repeat fallback
    const p2 = unpaired.splice(bestIdx, 1)[0];
    pairs.push([p1, p2]);
  }
  return { pairs, bye: unpaired[0] || null };
};

// Basic content filter
const BLOCKED_PATTERNS = [
  /เบอร์โทร|line\s*id|โทร\s*หา|ติดต่อ\s*ได้ที่/i,
  /ยาเสพติด|ยาบ้า|กัญชา|heroin|cocaine/i,
  /ลามก|โป๊|porn|xxx|sex\s*for/i,
  /พนัน|บาคาร่า|casino|gambling/i,
];
const isBlocked = (text) => BLOCKED_PATTERNS.some(p => p.test(text));
let currentAnnouncement = null;

// Rate limit state
const rateLimits = {
  publicMsg:  new Map(),
  queueJoin:  new Map(),
  roomMsg:    new Map(),
};
const rateOk = (map, userId, minMs) => {
  const now = Date.now();
  if (now - (map.get(userId) || 0) < minMs) return false;
  map.set(userId, now);
  return true;
};

const MAX_CONCURRENT_USERS = 1000;

// ── Tournament helpers ─────────────────────────────────────────────

const getTournamentPublic = (t) => ({
  id:               t.id,
  name:             t.name,
  gameTypeId:       t.gameTypeId,
  status:           t.status,
  maxPlayers:       t.maxPlayers,
  totalRounds:      t.totalRounds,
  currentRound:     t.currentRound,
  activeMatchCount: t.activeMatchCount,
  playerCount:      t.players.size,
  scheduledAt:      t.scheduledAt || null,
  scheduledEnd:     t.scheduledEnd || null,
});

const isLockedInTournament = (userId) => {
  for (const t of tournaments.values()) {
    if (t.status === 'ended') continue;
    if (!t.players.has(userId)) continue;
    if (t.scheduledAt) return Date.now() >= new Date(t.scheduledAt).getTime();
    return t.status !== 'waiting';
  }
  return false;
};

const notifyAdmins = (io, type, data) => {
  for (const [, info] of onlineUsers) {
    if (info.isAdmin) {
      io.to(info.socketId).emit('admin_match_alert', { type, ...data });
    }
  }
};

const ADMIN_DECISION_TIMEOUT_MS = 10 * 60 * 1000; // BUG-06: 10 min auto-resolve if no admin decides

const finalizeMatch = async (io, roomId, match, winnerId, method) => {
  clearTimeout(match.timer);
  clearTimeout(match.adminDecisionTimer); // BUG-06
  match.phase = 'done';
  match.winnerId = winnerId;
  const loserId = match.players.find(p => p !== winnerId);
  if (!loserId) return;

  // Update tournament points (+3 for winner)
  const t = tournaments.get(match.tournamentId);
  if (t) {
    t.points.set(winnerId, (t.points.get(winnerId) || 0) + 3);
    t.activeMatchCount = Math.max(0, (t.activeMatchCount || 1) - 1);
  }
  // Atomically decide if THIS invocation triggers round-end (prevents double-fire when two matches finish simultaneously)
  const triggerRoundEnd = t ? (t.activeMatchCount === 0 && !t._roundEndFired) : false;
  if (triggerRoundEnd) t._roundEndFired = true;

  // Build standings to include in result
  const standings = t ? buildStandings(t) : [];

  io.to(roomId).emit('match_result_final', { winnerId, loserId, method, standings, tournamentId: match.tournamentId });

  try {
    const pool = getPool();
    await pool.query(
      "UPDATE TournamentMatches SET winner_id=$1, status='done', ended_at=NOW() WHERE id=$2",
      [winnerId, match.matchId]
    );
    await pool.query('UPDATE Users SET wins=wins+1, total_games=total_games+1 WHERE id=$1', [winnerId]);
    await pool.query('UPDATE Users SET losses=losses+1, total_games=total_games+1 WHERE id=$1', [loserId]);
    // Update tournament player points
    await pool.query('UPDATE TournamentPlayers SET points=points+3, wins=wins+1 WHERE tournament_id=$1 AND user_id=$2', [match.tournamentId, winnerId]).catch(() => {});
    await pool.query('UPDATE TournamentPlayers SET losses=losses+1 WHERE tournament_id=$1 AND user_id=$2', [match.tournamentId, loserId]).catch(() => {});
  } catch (e) { console.error('[finalizeMatch]', e.message); }

  // Check if round is complete — only the invocation that set triggerRoundEnd=true enters here
  if (t && triggerRoundEnd) {
    t._roundEndFired = false; // reset for next round
    const info = getTournamentPublic(t);
    if (t.currentRound >= t.totalRounds) {
      // All rounds done → tournament complete
      t.status = 'ended';
      io.to(`tournament:${t.id}`).emit('tournament_complete', { tournamentId: t.id, standings });
      io.emit('tournament_updated', info);
      try { await getPool().query("UPDATE Tournaments SET status='ended', ended_at=NOW() WHERE id=$1", [t.id]); } catch {}
    } else {
      // Round complete, more rounds remain
      t.status = 'round_complete';
      io.to(`tournament:${t.id}`).emit('round_complete', {
        tournamentId: t.id,
        roundNumber:  t.currentRound,
        totalRounds:  t.totalRounds,
        standings,
      });
      io.emit('tournament_updated', info);
      notifyAdmins(io, 'round_complete', {
        tournamentId: t.id,
        roundNumber:  t.currentRound,
        totalRounds:  t.totalRounds,
      });
    }
  }
};

const buildStandings = (t) => {
  return [...t.players]
    .map(id => ({
      userId:   id,
      username: onlineUsers.get(id)?.username || t.playerNames?.get(id) || '?', // BUG-07
      points:   t.points.get(id) || 0,
    }))
    .sort((a, b) => b.points - a.points);
};

const handleMatchTimeout = (io, roomId) => {
  const match = tourneyMatches.get(roomId);
  if (!match || match.phase !== 'result_reporting') return;

  if (match.results.size === 0) {
    match.phase = 'admin_decision';
    io.to(roomId).emit('match_needs_admin', { reason: 'timeout_no_response' });
    notifyAdmins(io, 'timeout', {
      roomId, matchId: match.matchId, tournamentId: match.tournamentId,
      players: match.players,
      playerNames: match.players.map(id => onlineUsers.get(id)?.username || '?'),
    });
    // BUG-06: auto-resolve after 10 min if no admin acts
    match.adminDecisionTimer = setTimeout(() => {
      if (match.phase !== 'admin_decision') return;
      const winnerId = match.players[Math.floor(Math.random() * match.players.length)];
      finalizeMatch(io, roomId, match, winnerId, 'auto_timeout').catch(() => {});
    }, ADMIN_DECISION_TIMEOUT_MS);
  } else {
    const [[declarerId, result]] = [...match.results.entries()];
    const winnerId = result === 'win' ? declarerId : match.players.find(p => p !== declarerId);
    finalizeMatch(io, roomId, match, winnerId, 'timeout_one_sided').catch(() => {});
  }
};

// ── Main Socket Setup ──────────────────────────────────────────────

const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
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
    const user   = socket.user;
    const userId = user._id;

    onlineUsers.set(userId, { socketId: socket.id, username: user.username, avatar: user.avatar, isAdmin: !!user.isAdmin });
    io.emit('online_count', { count: onlineUsers.size });
    console.log(`[+] ${user.username} (${socket.id})`);
    log.info({ event: 'connect', userId, username: user.username, isAdmin: !!user.isAdmin, socketId: socket.id, onlineCount: onlineUsers.size });

    socket.emit('public_chat_history', publicChatBuffer);
    if (currentAnnouncement) socket.emit('announcement', currentAnnouncement);

    // Send open tournaments to newly connected user
    const openTournaments = [...tournaments.values()]
      .filter(t => t.status !== 'ended')
      .map(getTournamentPublic);
    if (openTournaments.length) socket.emit('tournament_list', openTournaments);

    // Queue reconnect fix
    matchQueues.forEach((queue) => {
      const entry = queue.find(p => p.userId === userId);
      if (entry && entry.socketId !== socket.id) {
        entry.socketId = socket.id;
        console.log(`[QUEUE] Updated socketId for ${user.username}`);
      }
    });

    // ── MATCHMAKING ────────────────────────────────────────────────
    socket.on('join_queue', async ({ gameTypeId }) => {
      if (!rateOk(rateLimits.queueJoin, userId, 3000)) return;
      if (isLockedInTournament(userId))
        return socket.emit('tournament_lock_error', { message: 'คุณกำลังแข่ง Tournament อยู่ ไม่สามารถจับคู่ได้' });
      console.log(`\n[QUEUE] ${user.username} wants to join queue | gameTypeId=${gameTypeId}`);

      if (!gameTypeId) return;
      const queue = matchQueues.get(gameTypeId) || [];
      if (queue.find((p) => p.userId === userId)) return;
      if ([...activeRooms.values()].some(r => r.players.includes(userId))) return;

      const waiting = queue.find((p) => p.userId !== userId);
      if (waiting) {
        console.log(`[QUEUE] ✅ MATCH! ${user.username} <-> ${waiting.username}`);
        matchQueues.set(gameTypeId, queue.filter((p) => p.userId !== waiting.userId));

        const roomId   = uuidv4();
        const gameType = await GameType.findById(gameTypeId);
        const gameInfo = { _id: gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color };

        try { await Room.create({ roomId, gameTypeId, players: [waiting.userId, userId] }); }
        catch (e) { socket.emit('error', { message: 'Failed to create room' }); return; }
        activeRooms.set(roomId, { players: [waiting.userId, userId] });

        const opponentInfo = onlineUsers.get(waiting.userId) || {};
        io.to(waiting.socketId).emit('match_found', { roomId, gameType: gameInfo, opponent: { _id: userId,         username: user.username,     avatar: user.avatar          } });
        socket.emit(             'match_found', { roomId, gameType: gameInfo, opponent: { _id: waiting.userId, username: waiting.username, avatar: opponentInfo.avatar } });
      } else {
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
        id: `${userId}-${Date.now()}`,
        from: { _id: userId, username: user.username, avatar: user.avatar },
        message: message.trim().slice(0, 300),
        timestamp: new Date().toISOString(),
      };
      publicChatBuffer.push(msg);
      if (publicChatBuffer.length > 50) publicChatBuffer.shift();
      io.emit('public_message', msg);
    });

    socket.on('leave_queue', () => {
      matchQueues.forEach((queue, gameTypeId) => {
        matchQueues.set(gameTypeId, queue.filter((p) => p.userId !== userId));
      });
      socket.emit('queue_left');
    });

    // ── DIRECT CHALLENGE ──────────────────────────────────────────
    socket.on('challenge_by_player_id', async ({ playerId, gameTypeId }) => {
      if (!playerId || !gameTypeId) return;
      if ([...activeRooms.values()].some(r => r.players.includes(userId)))
        return socket.emit('challenge_id_error', { message: 'ไม่สามารถท้าได้ขณะอยู่ในห้องแข่ง' });
      if ([...matchQueues.values()].some(q => q.some(p => p.userId === userId)))
        return socket.emit('challenge_id_error', { message: 'กรุณาออกจากคิวก่อนท้าด้วย Player ID' });
      if (isLockedInTournament(userId))
        return socket.emit('challenge_id_error', { message: 'คุณกำลังแข่ง Tournament อยู่' });

      const targetUser = await User.findByPlayerId(playerId);
      if (!targetUser) return socket.emit('challenge_id_error', { message: 'ไม่พบผู้เล่น ID นี้' });
      if (targetUser._id === userId) return socket.emit('challenge_id_error', { message: 'ไม่สามารถท้าตัวเองได้' });
      const target = onlineUsers.get(targetUser._id);
      if (!target) return socket.emit('challenge_id_error', { message: `${targetUser.username} ออฟไลน์อยู่` });
      if (isLockedInTournament(targetUser._id))
        return socket.emit('challenge_id_error', { message: `${targetUser.username} กำลังแข่ง Tournament อยู่` });

      const challengeId = uuidv4();
      const gameType    = await GameType.findById(gameTypeId);
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
      if (isLockedInTournament(userId))
        return socket.emit('error', { message: 'คุณกำลังแข่ง Tournament อยู่' });
      if (isLockedInTournament(targetUserId))
        return socket.emit('error', { message: 'ผู้เล่นนั้นกำลังแข่ง Tournament อยู่' });

      const challengeId = uuidv4();
      const gameType    = await GameType.findById(gameTypeId);
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

      if (isLockedInTournament(userId) || isLockedInTournament(challenge.from))
        return; // silently drop — tournament takes priority

      const roomId   = uuidv4();
      const gameType = await GameType.findById(challenge.gameTypeId);
      const gameInfo = { _id: challenge.gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color };

      try { await Room.create({ roomId, gameTypeId: challenge.gameTypeId, players: [challenge.from, userId] }); }
      catch (e) { socket.emit('error', { message: 'Failed to create room' }); return; }
      activeRooms.set(roomId, { players: [challenge.from, userId] });

      io.to(fromInfo.socketId).emit('challenge_accepted', { roomId, gameType: gameInfo, opponent: { _id: userId,         username: user.username,     avatar: user.avatar          } });
      socket.emit(             'challenge_accepted', { roomId, gameType: gameInfo, opponent: { _id: challenge.from, username: fromInfo.username, avatar: fromInfo.avatar } });
    });

    // ── WEBRTC SIGNALING ──────────────────────────────────────────
    const inRoom = (roomId) => activeRooms.get(roomId)?.players.includes(userId);
    socket.on('join_room',     ({ roomId }) => { if (!inRoom(roomId)) return; socket.join(roomId); socket.to(roomId).emit('peer_joined', { userId }); });
    socket.on('offer',         ({ roomId, offer })     => { if (!inRoom(roomId)) return; socket.to(roomId).emit('offer',        { offer,     from: userId }); });
    socket.on('answer',        ({ roomId, answer })    => { if (!inRoom(roomId)) return; socket.to(roomId).emit('answer',       { answer,    from: userId }); });
    socket.on('ice_candidate', ({ roomId, candidate }) => { if (!inRoom(roomId)) return; socket.to(roomId).emit('ice_candidate',{ candidate, from: userId }); });

    // ── CHAT ──────────────────────────────────────────────────────
    socket.on('send_message', ({ roomId, message }) => {
      if (!message?.trim()) return;
      if (!inRoom(roomId)) return;
      if (!rateOk(rateLimits.roomMsg, userId, 800)) return;
      io.to(roomId).emit('message_received', {
        from: { _id: userId, username: user.username, avatar: user.avatar },
        message: message.trim().slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    });

    // ── LEAVE ROOM ────────────────────────────────────────────────
    socket.on('leave_room', async ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit('partner_disconnected');
      try { await Room.updateStatus(roomId, 'ended'); } catch {}
      activeRooms.delete(roomId);
      const tm = tourneyMatches.get(roomId);
      if (tm) { clearTimeout(tm.timer); tourneyMatches.delete(roomId); }
      const aw = adminWatching.get(roomId);
      if (aw) { io.to(aw.adminSocketId).emit('spectate_ended', { roomId }); adminWatching.delete(roomId); }
    });

    // ── TOURNAMENT MANAGEMENT (Admin) ─────────────────────────────
    socket.on('create_tournament', async ({ name, gameTypeId, maxPlayers, totalRounds, scheduledAt, scheduledEnd }) => {
      log.info({ event: 'create_tournament', userId, username: user.username, name, gameTypeId, maxPlayers, totalRounds, scheduledAt });
      if (!user.isAdmin) return;
      if (!name?.trim() || !gameTypeId) return socket.emit('tournament_error', { message: 'กรุณากรอกข้อมูลให้ครบ' });
      const id = uuidv4();
      const tournament = {
        id,
        name:             name.trim().slice(0, 100),
        gameTypeId,
        status:           'waiting',
        maxPlayers:       Math.min(Math.max(parseInt(maxPlayers) || 8, 2), 64),
        totalRounds:      Math.min(Math.max(parseInt(totalRounds) || 3, 1), 10),
        currentRound:     0,
        activeMatchCount: 0,
        playedPairs:      new Set(),
        points:           new Map(),
        playerNames:      new Map(), // BUG-07: username cache so standings work when players offline
        createdBy:        userId,
        players:          new Set(),
        scheduledAt:      scheduledAt ? new Date(scheduledAt) : null,
        scheduledEnd:     scheduledEnd ? new Date(scheduledEnd) : null,
      };
      if (tournament.scheduledAt && tournament.scheduledEnd &&
          tournament.scheduledEnd <= tournament.scheduledAt) {
        return socket.emit('tournament_error', { message: 'เวลาจบต้องมาหลังเวลาเริ่ม' });
      }
      tournaments.set(id, tournament);
      try {
        await getPool().query(
          `INSERT INTO Tournaments (id, name, game_type_id, status, max_players, total_rounds, created_by, scheduled_at, scheduled_end) VALUES ($1,$2,$3,'waiting',$4,$5,$6,$7,$8)`,
          [id, tournament.name, gameTypeId, tournament.maxPlayers, tournament.totalRounds, userId, tournament.scheduledAt || null, tournament.scheduledEnd || null]
        );
      } catch (e) { console.error('[create_tournament]', e.message); }
      io.emit('tournament_created', getTournamentPublic(tournament));
      socket.emit('tournament_created_ok', { id });
    });

    // start_round: starts first round OR next round (admin only, all matches must be done first)
    socket.on('start_round', async ({ tournamentId }) => {
      const fallback = setTimeout(() => {
        log.error({ event: 'start_round', step: 'fallback_timeout', tournamentId, userId }, 'start_round timed out after 10s — no response sent');
        socket.emit('tournament_error', { message: 'หมดเวลา กรุณาลองใหม่' });
      }, 10000);
      try {
      log.info({ event: 'start_round', step: 'received', tournamentId, userId, username: user.username });

      if (!user.isAdmin) {
        log.warn({ event: 'start_round', step: 'rejected_not_admin', userId });
        return socket.emit('tournament_error', { message: 'ไม่มีสิทธิ์' });
      }
      const t = tournaments.get(tournamentId);
      if (!t) {
        log.warn({ event: 'start_round', step: 'rejected_not_found', tournamentId });
        return socket.emit('tournament_error', { message: 'ไม่พบ Tournament' });
      }
      log.info({ event: 'start_round', step: 'tournament_state', tournamentId, status: t.status, currentRound: t.currentRound, totalRounds: t.totalRounds, playerCount: t.players?.size, activeMatchCount: t.activeMatchCount });

      if (!['waiting', 'round_complete'].includes(t.status)) {
        log.warn({ event: 'start_round', step: 'rejected_bad_status', tournamentId, status: t.status });
        return socket.emit('tournament_error', { message: 'มีแมตช์ที่ยังไม่จบ หรือ Tournament สิ้นสุดแล้ว' });
      }
      if (!t.players || t.players.size < 2) {
        log.warn({ event: 'start_round', step: 'rejected_not_enough_players', tournamentId, playerCount: t.players?.size });
        return socket.emit('tournament_error', { message: 'ต้องมีผู้เล่นอย่างน้อย 2 คน' });
      }
      if (t.scheduledAt && Date.now() < new Date(t.scheduledAt).getTime()) {
        log.warn({ event: 'start_round', step: 'rejected_not_scheduled_time', tournamentId, scheduledAt: t.scheduledAt });
        return socket.emit('tournament_error', { message: 'ยังไม่ถึงเวลาเริ่มทัวร์นาเมนต์' });
      }
      if (t.currentRound >= t.totalRounds) {
        log.warn({ event: 'start_round', step: 'rejected_all_rounds_done', tournamentId, currentRound: t.currentRound, totalRounds: t.totalRounds });
        return socket.emit('tournament_error', { message: 'ครบทุกรอบแล้ว' });
      }

      if (!t.playedPairs) t.playedPairs = new Set();
      const { pairs, bye } = pairPlayersNoRepeat([...t.players], t.playedPairs);
      log.info({ event: 'start_round', step: 'paired', tournamentId, pairCount: pairs.length, bye: bye || null });

      log.info({ event: 'start_round', step: 'fetching_game_type', tournamentId, gameTypeId: t.gameTypeId });
      let gameType = null;
      try { gameType = await GameType.findById(t.gameTypeId); } catch (e) {
        log.error({ event: 'start_round', step: 'game_type_error', tournamentId, err: e.message });
      }
      const gameInfo  = { _id: t.gameTypeId, name: gameType?.name, nameTh: gameType?.nameTh, color: gameType?.color };

      t.currentRound++;
      t.status = 'active';
      t._roundEndFired = false;
      pairs.forEach(([p1, p2]) => t.playedPairs.add([p1, p2].sort().join('_')));
      t.activeMatchCount = pairs.length;
      const createdMatches = [];

      for (const [p1Id, p2Id] of pairs) {
        const roomId  = uuidv4();
        const matchId = uuidv4();
        const p1Info  = onlineUsers.get(p1Id);
        const p2Info  = onlineUsers.get(p2Id);

        log.info({ event: 'start_round', step: 'creating_room', tournamentId, roomId, p1Id, p2Id, p1Online: !!p1Info, p2Online: !!p2Info });
        try { await Room.create({ roomId, gameTypeId: t.gameTypeId, players: [p1Id, p2Id] }); }
        catch (e) {
          log.error({ event: 'start_round', step: 'room_create_error', tournamentId, roomId, err: e.message });
          t.activeMatchCount--; continue;
        }

        activeRooms.set(roomId, { players: [p1Id, p2Id], isTournament: true });
        tourneyMatches.set(roomId, { matchId, tournamentId, players: [p1Id, p2Id], results: new Map(), phase: 'playing', timer: null });

        log.info({ event: 'start_round', step: 'inserting_match_db', tournamentId, matchId, roomId });
        try {
          await getPool().query(
            `INSERT INTO TournamentMatches (id, tournament_id, room_id, player1_id, player2_id, status, round) VALUES ($1,$2,$3,$4,$5,'playing',$6)`,
            [matchId, tournamentId, roomId, p1Id, p2Id, t.currentRound]
          );
          log.info({ event: 'start_round', step: 'match_db_ok', tournamentId, matchId });
        } catch (e) {
          log.error({ event: 'start_round', step: 'match_db_error', tournamentId, matchId, err: e.message });
        }

        // Remove paired players from matchmaking queues to prevent double match_found
        matchQueues.forEach((queue, gtId) => {
          matchQueues.set(gtId, queue.filter(p => p.userId !== p1Id && p.userId !== p2Id));
        });
        if (p1Info) io.to(p1Info.socketId).emit('match_found', { roomId, gameType: gameInfo, opponent: { _id: p2Id, username: p2Info?.username || '?', avatar: p2Info?.avatar || '' }, isTournament: true, tournamentId, matchId, roundNumber: t.currentRound });
        if (p2Info) io.to(p2Info.socketId).emit('match_found', { roomId, gameType: gameInfo, opponent: { _id: p1Id, username: p1Info?.username || '?', avatar: p1Info?.avatar || '' }, isTournament: true, tournamentId, matchId, roundNumber: t.currentRound });

        createdMatches.push({ matchId, roomId, player1Id: p1Id, player2Id: p2Id });
      }

      if (bye) {
        const byeInfo = onlineUsers.get(bye);
        log.info({ event: 'start_round', step: 'bye_player', tournamentId, byeUserId: bye, byeOnline: !!byeInfo });
        if (byeInfo) io.to(byeInfo.socketId).emit('tournament_bye', { message: `คุณได้รับ BYE รอบที่ ${t.currentRound}`, roundNumber: t.currentRound });
        if (t.activeMatchCount === 0) t.status = 'round_complete';
      }

      log.info({ event: 'start_round', step: 'updating_tournament_db', tournamentId, currentRound: t.currentRound });
      try {
        await getPool().query(
          "UPDATE Tournaments SET status='active', current_round=$1, started_at=COALESCE(started_at,NOW()) WHERE id=$2",
          [t.currentRound, tournamentId]
        );
        log.info({ event: 'start_round', step: 'tournament_db_ok', tournamentId });
      } catch (e) {
        log.error({ event: 'start_round', step: 'tournament_db_error', tournamentId, err: e.message });
      }

      const roundInfo = { tournamentId, roundNumber: t.currentRound, totalRounds: t.totalRounds, matches: createdMatches };
      log.info({ event: 'start_round', step: 'emitting_round_started', tournamentId, roundNumber: t.currentRound, matchCount: createdMatches.length });
      io.emit('round_started', roundInfo);
      io.emit('tournament_updated', getTournamentPublic(t));
      } catch (e) {
        log.error({ event: 'start_round', step: 'unhandled_error', tournamentId, userId, err: e.message, stack: e.stack });
        console.error('[start_round] unhandled error:', e.message, e.stack);
        socket.emit('tournament_error', { message: 'เกิดข้อผิดพลาดในการเริ่มรอบ' });
      } finally {
        clearTimeout(fallback);
      }
    });


    socket.on('close_tournament', async ({ tournamentId }) => {
      if (!user.isAdmin) return;
      const t = tournaments.get(tournamentId);
      if (!t) return;
      t.status = 'ended';
      try { await getPool().query("UPDATE Tournaments SET status='ended', ended_at=NOW() WHERE id=$1", [tournamentId]); } catch {}
      io.emit('tournament_closed', { tournamentId });
      tournaments.delete(tournamentId);
    });

    // Admin: join tournament room as observer (no player registration)
    socket.on('admin_join_tournament_watch', ({ tournamentId }) => {
      if (!user.isAdmin) return;
      const t = tournaments.get(tournamentId);
      if (!t) return socket.emit('tournament_error', { message: 'ไม่พบ Tournament' });
      socket.join(`tournament:${tournamentId}`);
      const standings = buildStandings(t);
      const playersInfo = [...t.players].map(id => {
        const info = onlineUsers.get(id);
        return { userId: id, username: info?.username || '?', avatar: info?.avatar || '', points: t.points.get(id) || 0 };
      });
      socket.emit('tournament_joined_ok', { tournamentId, playersInfo, tournament: getTournamentPublic(t), standings });
    });

    socket.on('admin_leave_tournament_watch', ({ tournamentId }) => {
      if (!user.isAdmin) return;
      socket.leave(`tournament:${tournamentId}`);
    });

    // ── TOURNAMENT LOBBY (Players) ────────────────────────────────
    socket.on('join_tournament', async ({ tournamentId }) => {
      log.info({ event: 'join_tournament', userId, username: user.username, tournamentId });
      const t = tournaments.get(tournamentId);
      if (!t) return socket.emit('tournament_error', { message: 'ไม่พบ Tournament นี้' });
      if (t.status === 'ended') return socket.emit('tournament_error', { message: 'Tournament นี้จบแล้ว' });

      const alreadyIn = t.players.has(userId);
      if (!alreadyIn) {
        if (t.status !== 'waiting') {
          // Not in memory — check DB for prior registration (reconnect case)
          const { rows } = await getPool().query(
            'SELECT 1 FROM TournamentPlayers WHERE tournament_id=$1 AND user_id=$2',
            [tournamentId, userId]
          ).catch(() => ({ rows: [] }));
          if (!rows.length)
            return socket.emit('tournament_error', { message: 'Tournament กำลังแข่งขันอยู่ ไม่รับสมัครเพิ่ม' });
          // Re-entry: registered before but lost in-memory slot (reconnect)
        } else {
          // New registration during waiting phase
          if (t.players.size >= t.maxPlayers) return socket.emit('tournament_error', { message: 'ห้องเต็มแล้ว' });
          // Block if locked in another active tournament
          for (const ot of tournaments.values()) {
            if (ot.id === tournamentId) continue;
            if (ot.status === 'ended') continue;
            if (!ot.players.has(userId)) continue;
            const otLocked = ot.scheduledAt ? Date.now() >= new Date(ot.scheduledAt).getTime() : ot.status !== 'waiting';
            if (otLocked) return socket.emit('tournament_error', { message: 'คุณอยู่ใน Tournament อื่นอยู่แล้ว' });
          }
        }
      }

      // Remove from matchmaking queue to prevent double match_found
      matchQueues.forEach((queue, gtId) => {
        matchQueues.set(gtId, queue.filter(p => p.userId !== userId));
      });

      t.players.add(userId);
      if (!t.playerNames) t.playerNames = new Map();
      t.playerNames.set(userId, user.username); // BUG-07: cache for offline standings
      socket.join(`tournament:${tournamentId}`);

      try {
        await getPool().query(
          `INSERT INTO TournamentPlayers (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [tournamentId, userId]
        );
      } catch {}

      const playersInfo = [...t.players].map(id => {
        const info = onlineUsers.get(id);
        return { userId: id, username: info?.username || '?', avatar: info?.avatar || '' };
      });

      io.to(`tournament:${tournamentId}`).emit('tournament_player_update', { tournamentId, playersInfo, playerCount: t.players.size });
      io.emit('tournament_player_count', { tournamentId, playerCount: t.players.size });
      const standings = buildStandings(t);
      socket.emit('tournament_joined_ok', { tournamentId, playersInfo, tournament: getTournamentPublic(t), standings });
      socket.emit('player_tournament_locked', { tournamentId });
    });

    socket.on('leave_tournament', async ({ tournamentId }) => {
      const t = tournaments.get(tournamentId);
      if (!t) return;
      t.players.delete(userId);
      socket.leave(`tournament:${tournamentId}`);

      try {
        await getPool().query(
          `DELETE FROM TournamentPlayers WHERE tournament_id=$1 AND user_id=$2`,
          [tournamentId, userId]
        );
      } catch {}

      const playersInfo = [...t.players].map(id => {
        const info = onlineUsers.get(id);
        return { userId: id, username: info?.username || '?', avatar: info?.avatar || '' };
      });

      io.to(`tournament:${tournamentId}`).emit('tournament_player_update', { tournamentId, playersInfo, playerCount: t.players.size });
      io.emit('tournament_player_count', { tournamentId, playerCount: t.players.size });
      socket.emit('tournament_left_ok', { tournamentId });
    });

    // ── TOURNAMENT MATCH RESULT ───────────────────────────────────
    socket.on('end_game', ({ roomId }) => {
      log.info({ event: 'end_game', userId, username: user.username, roomId });
      const tm = tourneyMatches.get(roomId);
      if (!tm || tm.phase !== 'playing') return;
      if (!tm.players.includes(userId)) return;

      tm.phase = 'result_reporting';
      const timeoutAt = Date.now() + 60000;
      tm.timer = setTimeout(() => handleMatchTimeout(io, roomId), 60000);

      io.to(roomId).emit('result_phase_started', { endedBy: userId, timeoutAt });
    });

    socket.on('declare_result', ({ roomId, result }) => {
      log.info({ event: 'declare_result', userId, username: user.username, roomId, result });
      const tm = tourneyMatches.get(roomId);
      if (!tm || tm.phase !== 'result_reporting') return;
      if (!tm.players.includes(userId)) return;
      if (!['win', 'lose'].includes(result)) return;

      tm.results.set(userId, result);
      socket.to(roomId).emit('opponent_declared', { userId, result });

      if (tm.results.size === 2) {
        clearTimeout(tm.timer);
        const [p1, p2] = tm.players;
        const r1 = tm.results.get(p1), r2 = tm.results.get(p2);

        if ((r1 === 'win' && r2 === 'lose') || (r1 === 'lose' && r2 === 'win')) {
          const winnerId = r1 === 'win' ? p1 : p2;
          finalizeMatch(io, roomId, tm, winnerId, 'consensus');
        } else {
          tm.phase = 'admin_decision';
          io.to(roomId).emit('match_conflict', {});
          notifyAdmins(io, 'conflict', {
            roomId, matchId: tm.matchId, tournamentId: tm.tournamentId,
            players: tm.players,
            playerNames: tm.players.map(id => onlineUsers.get(id)?.username || '?'),
          });
          // BUG-06: auto-resolve after 10 min if no admin acts
          tm.adminDecisionTimer = setTimeout(() => {
            if (tm.phase !== 'admin_decision') return;
            const winnerId = tm.players[Math.floor(Math.random() * tm.players.length)];
            finalizeMatch(io, roomId, tm, winnerId, 'auto_timeout').catch(() => {});
          }, ADMIN_DECISION_TIMEOUT_MS);
        }
      }
    });

    socket.on('call_admin', ({ roomId }) => {
      const tm = tourneyMatches.get(roomId);
      if (!tm || !tm.players.includes(userId)) return;
      notifyAdmins(io, 'call', {
        roomId, matchId: tm.matchId, tournamentId: tm.tournamentId,
        players: tm.players, calledBy: userId,
      });
      socket.emit('admin_called', { message: 'ส่งสัญญาณเรียก Admin แล้ว กรุณารอสักครู่' });
    });

    socket.on('admin_decide_match', ({ roomId, winnerId }) => {
      log.info({ event: 'admin_decide_match', userId, username: user.username, roomId, winnerId });
      if (!user.isAdmin) return;
      const tm = tourneyMatches.get(roomId);
      if (!tm || !tm.players.includes(winnerId)) return;
      clearTimeout(tm.adminDecisionTimer); // BUG-06
      finalizeMatch(io, roomId, tm, winnerId, 'admin_decision');
    });

    // ── ADMIN SPECTATE ────────────────────────────────────────────
    socket.on('admin_watch_room', ({ roomId }) => {
      if (!user.isAdmin) return;
      const room = activeRooms.get(roomId);
      if (!room) return socket.emit('error', { message: 'ห้องนี้ไม่พบ' });
      const tm = tourneyMatches.get(roomId);
      if (tm?.phase === 'done') return socket.emit('error', { message: 'แมตช์นี้จบแล้ว' });

      // BUG-05: Evict any other admin already watching this room
      const existing = adminWatching.get(roomId);
      if (existing && existing.adminSocketId !== socket.id) {
        io.to(existing.adminSocketId).emit('spectate_ended', { roomId, reason: 'replaced' });
        io.sockets.sockets.get(existing.adminSocketId)?.leave(roomId);
      }

      adminWatching.set(roomId, { adminUserId: userId, adminSocketId: socket.id });
      socket.join(roomId);
      io.to(roomId).emit('admin_watching', { adminUsername: user.username });
    });

    socket.on('admin_stop_watching', ({ roomId }) => {
      if (!user.isAdmin) return;
      const aw = adminWatching.get(roomId);
      if (aw && aw.adminUserId === userId) {
        socket.leave(roomId);
        adminWatching.delete(roomId);
        io.to(roomId).emit('admin_left', {});
      }
    });

    // Admin spectate WebRTC — player sends offer to admin
    socket.on('admin_peer_offer', ({ roomId, offer }) => {
      const aw = adminWatching.get(roomId);
      if (!aw) return;
      if (!activeRooms.get(roomId)?.players.includes(userId)) return;
      io.to(aw.adminSocketId).emit('admin_peer_offer', { from: userId, fromUsername: user.username, offer, roomId });
    });

    // Admin sends answer to a specific player
    socket.on('admin_peer_answer', ({ roomId, targetUserId, answer }) => {
      if (!user.isAdmin) return;
      const playerInfo = onlineUsers.get(targetUserId);
      if (playerInfo) io.to(playerInfo.socketId).emit('admin_peer_answer', { answer, roomId });
    });

    // ICE candidates — either direction
    socket.on('admin_peer_ice', ({ roomId, targetUserId, candidate }) => {
      if (targetUserId) {
        // Admin → Player
        if (!user.isAdmin) return;
        const playerInfo = onlineUsers.get(targetUserId);
        if (playerInfo) io.to(playerInfo.socketId).emit('admin_peer_ice', { candidate, from: 'admin', roomId });
      } else {
        // Player → Admin
        const aw = adminWatching.get(roomId);
        if (!aw) return;
        if (!activeRooms.get(roomId)?.players.includes(userId)) return;
        io.to(aw.adminSocketId).emit('admin_peer_ice', { candidate, from: userId, roomId });
      }
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
          const tm = tourneyMatches.get(roomId);
          if (tm) { clearTimeout(tm.timer); tourneyMatches.delete(roomId); }
          const aw = adminWatching.get(roomId);
          if (aw) { io.to(aw.adminSocketId).emit('spectate_ended', { roomId }); adminWatching.delete(roomId); }
        }
      }
      // Remove from waiting tournaments on disconnect
      for (const t of tournaments.values()) {
        if (t.players.has(userId) && t.status === 'waiting') {
          t.players.delete(userId);
          try { await getPool().query('DELETE FROM TournamentPlayers WHERE tournament_id=$1 AND user_id=$2', [t.id, userId]); } catch {}
          const playersInfo = [...t.players].map(id => {
            const info = onlineUsers.get(id);
            return { userId: id, username: info?.username || '?', avatar: info?.avatar || '' };
          });
          io.to(`tournament:${t.id}`).emit('tournament_player_update', { tournamentId: t.id, playersInfo, playerCount: t.players.size });
          io.emit('tournament_player_count', { tournamentId: t.id, playerCount: t.players.size });
        }
      }
      io.emit('online_count', { count: onlineUsers.size });
      console.log(`[-] ${user.username}`);
      log.info({ event: 'disconnect', userId, username: user.username, onlineCount: onlineUsers.size });
    });
  });

  // Auto-close tournaments past their scheduledEnd
  setInterval(async () => {
    for (const [id, t] of tournaments) {
      if (!t.scheduledEnd || t.status === 'ended') continue;
      if (Date.now() < new Date(t.scheduledEnd).getTime()) continue;
      t.status = 'ended';
      try { await getPool().query("UPDATE Tournaments SET status='ended', ended_at=NOW() WHERE id=$1", [id]); } catch {}
      io.emit('tournament_closed', { tournamentId: id });
      tournaments.delete(id);
      console.log(`[Tournament] Auto-closed ${t.name} (scheduledEnd passed)`);
    }
  }, 60000);
};

const getOnlineUsers  = () => onlineUsers;
const getTournaments  = () => tournaments;
const getTourneyMatchesMap = () => tourneyMatches;

const setAnnouncement = (io, text, author) => {
  if (!text) {
    currentAnnouncement = null;
  } else {
    currentAnnouncement = { text: text.slice(0, 400), author, timestamp: new Date().toISOString() };
  }
  io.emit('announcement', currentAnnouncement);
};
const getAnnouncement = () => currentAnnouncement;

// BUG-01: Restore non-ended tournaments from DB into memory on server restart
const restoreTournamentsFromDB = async () => {
  try {
    const pool = getPool();
    const { rows: tRows } = await pool.query(
      `SELECT * FROM Tournaments WHERE status NOT IN ('ended') ORDER BY created_at ASC`
    );
    for (const row of tRows) {
      if (tournaments.has(row.id)) continue; // already in memory

      const { rows: playerRows } = await pool.query(
        `SELECT tp.user_id, tp.points, u.username
         FROM TournamentPlayers tp
         JOIN Users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1`,
        [row.id]
      );

      const players     = new Set(playerRows.map(p => p.user_id));
      const points      = new Map(playerRows.map(p => [p.user_id, p.points || 0]));
      const playerNames = new Map(playerRows.map(p => [p.user_id, p.username]));

      const { rows: matchRows } = await pool.query(
        'SELECT id, room_id, player1_id, player2_id, status FROM TournamentMatches WHERE tournament_id=$1',
        [row.id]
      );

      const playedPairs = new Set(
        matchRows.map(m => [m.player1_id, m.player2_id].sort().join('_'))
      );

      const playingMatches      = matchRows.filter(m => m.status === 'playing');
      const adminDecisionMatches = matchRows.filter(m => m.status === 'admin_decision');
      const activeMatchCount    = playingMatches.length + adminDecisionMatches.length;

      // If active but all matches finished (no pending left), correct to round_complete
      let status = row.status;
      if (status === 'active' && activeMatchCount === 0) status = 'round_complete';

      tournaments.set(row.id, {
        id:               row.id,
        name:             row.name,
        gameTypeId:       row.game_type_id,
        status,
        maxPlayers:       row.max_players,
        totalRounds:      row.total_rounds || 3,
        currentRound:     row.current_round || 0,
        activeMatchCount,
        playedPairs,
        points,
        playerNames,
        createdBy:        row.created_by,
        players,
        scheduledAt:      row.scheduled_at  ? new Date(row.scheduled_at)  : null,
        scheduledEnd:     row.scheduled_end ? new Date(row.scheduled_end) : null,
        _roundEndFired:   false,
      });

      // Matches that were playing when server died → move to admin_decision in DB
      if (playingMatches.length > 0) {
        await pool.query(
          `UPDATE TournamentMatches SET status='admin_decision' WHERE tournament_id=$1 AND status='playing'`,
          [row.id]
        ).catch(() => {});
        console.log(`[Tournament] ${row.name}: ${playingMatches.length} in-progress match(es) → admin_decision`);
      }

      // BUG-01 fix 1: Restore tourneyMatches so admin_decide_match works after restart
      // Covers both freshly-moved (was playing) and previously-pending admin_decision matches
      const matchesToRestore = [...playingMatches, ...adminDecisionMatches];
      for (const m of matchesToRestore) {
        if (!m.room_id) continue;
        tourneyMatches.set(m.room_id, {
          matchId:            m.id,
          tournamentId:       row.id,
          players:            [m.player1_id, m.player2_id],
          results:            new Map(),
          phase:              'admin_decision',
          timer:              null,
          adminDecisionTimer: null,
        });
      }
      if (matchesToRestore.length > 0) {
        console.log(`[Tournament] ${row.name}: restored ${matchesToRestore.length} match(es) into tourneyMatches`);
      }

      console.log(`[Tournament] Restored: "${row.name}" (${status}, ${players.size} players, round ${row.current_round || 0}/${row.total_rounds || 3})`);
    }
    if (tRows.length > 0) console.log(`[Tournament] Restored ${tRows.length} tournament(s) from DB`);
  } catch (e) {
    console.error('[Tournament] Restore failed:', e.message);
  }
};

module.exports = { setupSocketHandlers, getOnlineUsers, getTournaments, getTourneyMatchesMap, setAnnouncement, getAnnouncement, restoreTournamentsFromDB };
