'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import translations from '../../lib/translations';
import { Shuffle, Search, X, Swords, CheckCircle, XCircle, Loader2, Users, Settings, Hash, Heart } from 'lucide-react';
import Link from 'next/link';
import PreMatchModal from '../../components/PreMatchModal';
import PublicChat from '../../components/PublicChat';

export default function LobbyPage() {
  const { user, loading, lang } = useAuth();
  const { getSocket, safeEmit, setQueueGame, setLobbyCallbacks, onlineCount, connected, serverFull } = useSocket();
  const router = useRouter();
  const t = translations[lang];

  const [games, setGames]               = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  // Pre-detect autoQueue so lobby shows searching state immediately (no flash of game grid)
  const pendingAutoQueue = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('autoQueue') || sessionStorage.getItem('cg_auto_queue') || null
    : null;
  // Restore queue state if user refreshed while waiting
  const restoredQueue = typeof window !== 'undefined'
    ? sessionStorage.getItem('cg_queue_game') || null
    : null;
  const [inQueue, setInQueue] = useState(!!(pendingAutoQueue || restoredQueue));
  const [queueTime, setQueueTime]       = useState(0);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [toast, setToast]               = useState(null);
  const [challenge, setChallenge]         = useState(null);
  const [showPreMatch, setShowPreMatch]   = useState(false);
  const [pidInput, setPidInput]           = useState('');
  const [pidLoading, setPidLoading]       = useState(false);
  const [pidPending, setPidPending]       = useState(null); // { username } — waiting for response
  const pidTimeoutRef = useRef(null);
  const [chatMessages, setChatMessages]   = useState([]);
  const [announcement, setAnnouncement]   = useState(null);
  const [lockedTournament, setLockedTournament] = useState(null); // { id, name, scheduledAt }

  const inQueueRef  = useRef(false);
  const searchTimer = useRef(null);
  // Bug fix: use ref for lang so socket closures read current value without re-registering
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Push fresh callbacks into SocketContext on every render.
  // SocketContext owns the socket.on listeners (registered once at socket creation),
  // and simply delegates to whatever is in lobbyCallbacksRef — no React timing risk.
  setLobbyCallbacks({
    onMatchFound:        ({ roomId, gameType, opponent }) => { showToast(`${langRef.current === 'th' ? 'พบคู่ต่อสู้!' : 'Match found!'} ${opponent.username}`, 'success'); setQueue(false); if (gameType?._id) sessionStorage.setItem('cg_last_game', gameType._id); setTimeout(() => router.push(`/room/${roomId}`), 600); },
    onQueueLeft:         () => setQueue(false),
    onChallengeReceived: (data) => setChallenge(data),
    onChallengeAccepted: ({ roomId, gameType }) => { setPidPending(null); clearTimeout(pidTimeoutRef.current); if (gameType?._id) sessionStorage.setItem('cg_last_game', gameType._id); router.push(`/room/${roomId}`); },
    onChallengeDeclined:  ({ by }) => { setPidPending(null); clearTimeout(pidTimeoutRef.current); showToast(`${by} ${langRef.current === 'th' ? 'ปฏิเสธคำท้า' : 'declined'}`, 'error'); },
    onChallengeIdSent:    ({ to }) => {
      setPidLoading(false); setPidInput('');
      setPidPending({ username: to });
      showToast(`${langRef.current === 'th' ? 'ส่งคำท้าถึง' : 'Challenge sent to'} ${to} — ${langRef.current === 'th' ? 'รอการตอบรับ...' : 'waiting for response...'}`, 'success');
    },
    onChallengeIdError:   ({ message }) => {
      setPidLoading(false);
      clearTimeout(pidTimeoutRef.current);
      showToast(message, 'error');
    },
    onPublicMessage:     (msg)     => { setChatMessages(p => [...p.slice(-49), msg]); },
    onPublicChatHistory: (history) => { setChatMessages(history || []); },
    onAnnouncement:      (data)    => { setAnnouncement(data); },
  });

  // Bug fix: only redirect after auth check completes (not during loading)
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    api.get('/api/games').then(({ games }) => setGames(games)).catch(() => {});
  }, []);

  // Check if player is locked in a tournament
  useEffect(() => {
    if (!user) return;
    api.get('/api/tournament').then(({ tournaments: list }) => {
      const locked = (list || []).find(t => {
        if (!t.isJoined || t.status === 'ended') return false;
        if (t.scheduledAt) return Date.now() >= new Date(t.scheduledAt).getTime();
        return t.status !== 'waiting';
      });
      setLockedTournament(locked || null);
    }).catch(() => {});
  }, [user]);

  // Listen for tournament lock-related socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onTournamentClosed = ({ tournamentId }) => {
      setLockedTournament(prev => prev?.id === tournamentId ? null : prev);
    };
    const onTournamentLockError = ({ message }) => {
      showToast(message, 'error');
    };
    const refreshLock = () => {
      api.get('/api/tournament').then(({ tournaments: list }) => {
        const locked = (list || []).find(t => {
          if (!t.isJoined || t.status === 'ended') return false;
          if (t.scheduledAt) return Date.now() >= new Date(t.scheduledAt).getTime();
          return t.status !== 'waiting';
        });
        setLockedTournament(locked || null);
      }).catch(() => {});
    };
    const onVisibilityChange = () => { if (!document.hidden) refreshLock(); };
    socket.on('tournament_closed',        onTournamentClosed);
    socket.on('tournament_lock_error',    onTournamentLockError);
    socket.on('player_tournament_locked', refreshLock);
    socket.on('round_started',            refreshLock);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      socket.off('tournament_closed',        onTournamentClosed);
      socket.off('tournament_lock_error',    onTournamentLockError);
      socket.off('player_tournament_locked', refreshLock);
      socket.off('round_started',            refreshLock);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSocket]);

  // Auto-queue when coming from a room — skip PreMatchModal, join queue immediately
  useEffect(() => {
    if (!pendingAutoQueue || !games.length) return;
    const game = games.find(g => g._id === pendingAutoQueue);
    if (!game) return;
    sessionStorage.removeItem('cg_auto_queue');
    sessionStorage.removeItem('cg_queue_game'); // also clear restored queue signal
    setSelectedGame(game);
    setQueueGame(game._id);
    safeEmit('join_queue', { gameTypeId: game._id });
    setQueue(true); // FIX: use setQueue() to keep inQueue state + inQueueRef in sync
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  useEffect(() => {
    if (!inQueue) { setQueueTime(0); return; }
    const id = setInterval(() => setQueueTime(p => p + 1), 1000);
    return () => clearInterval(id);
  }, [inQueue]);

  useEffect(() => {
    return () => {
      if (inQueueRef.current) getSocket()?.emit('leave_queue');
      clearTimeout(searchTimer.current);
      clearTimeout(pidTimeoutRef.current);
    };
  }, [getSocket]);

  const setQueue = (val) => {
    inQueueRef.current = val;
    setInQueue(val);
    // Track queue state in SocketContext for reconnect handling
    if (!val) setQueueGame(null);
  };

  // Clear lobby callbacks when unmounting so stale handlers don't linger
  useEffect(() => {
    return () => setLobbyCallbacks({});
  }, [setLobbyCallbacks]);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const handleQuickMatch = () => {
    if (!selectedGame) return showToast(t.selectGameFirst, 'error');
    if (inQueue) {
      // Already in queue → cancel
      getSocket()?.emit('leave_queue');
      setQueue(false);
      return;
    }
    // Show pre-match device check modal before joining queue
    setShowPreMatch(true);
  };

  const handlePreMatchConfirm = () => {
    setShowPreMatch(false);
    if (!selectedGame) return;
    // Track in SocketContext so socket reconnect auto-rejoins queue
    setQueueGame(selectedGame._id);
    // safeEmit waits for socket connection before emitting
    safeEmit('join_queue', { gameTypeId: selectedGame._id });
    setQueue(true);
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q); clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { const { users } = await api.get(`/api/users/search?q=${encodeURIComponent(q.trim())}`); setSearchResults(users); }
      catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, []);

  const handleChallenge = (targetUserId) => {
    if (!selectedGame) return showToast(t.selectGameFirst, 'error');
    safeEmit('challenge_player', { targetUserId, gameTypeId: selectedGame._id });
    showToast(lang === 'th' ? 'ส่งคำท้าแล้ว รอการตอบรับ...' : 'Challenge sent!', 'info');
  };

  const handleChallengeResponse = (accepted) => { getSocket()?.emit('challenge_response', { challengeId: challenge.challengeId, accepted }); setChallenge(null); };

  const sendPublicMessage = (text) => {
    if (!text?.trim()) return;
    safeEmit('public_message', { message: text.trim() });
  };

  const handleChallengeById = () => {
    if (!selectedGame) return showToast(t.selectGameFirst, 'error');
    if (pidInput.length !== 6) return;
    if (inQueue) return showToast(lang === 'th' ? 'ออกจากคิวก่อนท้าด้วย ID' : 'Leave queue before challenging by ID', 'error');
    setPidLoading(true);
    safeEmit('challenge_by_player_id', { playerId: pidInput.toUpperCase(), gameTypeId: selectedGame._id });
    // Auto-reset loading if server doesn't respond within 10s
    clearTimeout(pidTimeoutRef.current);
    pidTimeoutRef.current = setTimeout(() => {
      setPidLoading(false);
      showToast(lang === 'th' ? 'ไม่ได้รับการตอบกลับ ลองอีกครั้ง' : 'No response, please try again', 'error');
    }, 10000);
  };
  const fmtTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Bug fix: show loader while auth check is in progress, not just blank/redirect
  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 overflow-x-hidden w-full">

      {/* Pre-match device check modal */}
      {showPreMatch && selectedGame && (
        <PreMatchModal
          lang={lang}
          gameName={lang === 'th' ? selectedGame.nameTh : selectedGame.name}
          onConfirm={handlePreMatchConfirm}
          onCancel={() => setShowPreMatch(false)}
        />
      )}

      {/* Toast — full width on mobile, fixed width on desktop */}
      {toast && (
        <div className={`fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 anim-fade-up px-4 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-950 border border-green-700/50 text-green-300' :
            toast.type === 'error' ? 'bg-red-950 border border-red-700/50 text-red-300' :
            'bg-purple-950 border border-purple-700/50 text-purple-300'}`}>
          {toast.msg}
        </div>
      )}

      {/* Incoming challenge modal */}
      {challenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="anim-scale-in card w-full max-w-sm p-6 md:p-8 text-center" style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
            <div className="text-4xl md:text-5xl mb-4">⚔️</div>
            <h2 className="text-xl font-bold text-white mb-2">{lang === 'th' ? 'ได้รับคำท้า!' : 'Challenge Received!'}</h2>
            <p className="text-slate-400 text-sm mb-1">
              <span className="text-purple-300 font-bold">{challenge.from.username}</span>{' '}
              {lang === 'th' ? 'ท้าคุณเล่น' : 'challenges you to'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-5 text-sm font-bold"
              style={{ background: `${challenge.gameType?.color||'#7c3aed'}15`, color: challenge.gameType?.color||'#a78bfa', border: `1px solid ${challenge.gameType?.color||'#7c3aed'}30` }}>
              🃏 {lang === 'th' ? challenge.gameType?.nameTh : challenge.gameType?.name}
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleChallengeResponse(true)} className="btn-primary flex-1 py-3 rounded-xl text-sm gap-1.5">
                <CheckCircle size={15} /> {lang === 'th' ? 'ยอมรับ' : 'Accept'}
              </button>
              <button onClick={() => handleChallengeResponse(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                <XCircle size={15} /> {lang === 'th' ? 'ปฏิเสธ' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server full banner */}
      {serverFull && (
        <div className="w-full p-4 rounded-xl mb-6 space-y-3"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div>
            <p className="text-red-400 font-bold text-sm mb-1">
              {lang === 'th' ? '⚠️ ผู้เล่นออนไลน์เต็มจำนวนแล้ว (1000/1000)' : '⚠️ Server is at capacity (1000/1000 players)'}
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              {lang === 'th'
                ? 'ระบบ Beta ในช่วงนี้มีค่าใช้จ่าย Server จำกัดจำนวนผู้เล่นพร้อมกันไว้ที่ 200 คน ขณะนี้ทุกที่นั่งถูกใช้งานอยู่'
                : 'During Beta, server costs limit us to 200 concurrent players. All slots are currently in use.'}
            </p>
          </div>

          {/* Support CTA */}
          <div className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <span className="text-lg flex-shrink-0">💛</span>
            <div className="flex-1 min-w-0">
              <p className="text-yellow-300 text-xs font-semibold mb-0.5">
                {lang === 'th' ? 'ช่วยเราขยาย Server ให้รองรับผู้เล่นได้มากขึ้น' : 'Help us expand the server to support more players'}
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                {lang === 'th'
                  ? 'การสนับสนุนเล็กน้อยช่วยให้เราอัปเกรด Server และเปิดรับผู้เล่นได้มากขึ้นในอนาคต'
                  : 'Even a small contribution helps us upgrade the server and welcome more players in the future.'}
              </p>
              <Link href="/donate"
                className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-pink-400 hover:text-pink-300 transition">
                <Heart size={11} fill="currentColor" />
                {lang === 'th' ? 'สนับสนุนการพัฒนา →' : 'Support the project →'}
              </Link>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => window.location.reload()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {lang === 'th' ? '🔄 Refresh อีกครั้ง' : '🔄 Refresh'}
            </button>
            <p className="flex-1 flex items-center justify-center text-[11px] text-slate-600">
              {lang === 'th' ? 'สมัครบัญชีได้ตลอดเวลา' : 'Registration always open'}
            </p>
          </div>
        </div>
      )}

      {/* ── Announcement ticker ─────────────────────────────────── */}
      {announcement?.text && (
        <div className="w-full overflow-hidden rounded-xl mb-4 flex items-center gap-3 px-3 py-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <span className="text-yellow-400 text-xs font-bold flex-shrink-0">📢</span>
          <div className="flex-1 overflow-hidden">
            <p className="text-yellow-300 text-xs font-medium whitespace-nowrap"
              style={{ animation: 'marquee 35s linear infinite', display: 'inline-block' }}>
              {announcement.text}
            </p>
          </div>
        </div>
      )}

      {/* ── Tournament lock banner ─────────────────────────────── */}
      {lockedTournament && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <div>
            <p className="text-yellow-400 font-semibold text-sm">🔒 {lang === 'th' ? 'กำลังแข่ง Tournament' : 'In Tournament'}</p>
            <p className="text-slate-500 text-xs mt-0.5">{lockedTournament.name} — {lang === 'th' ? 'ไม่สามารถจับคู่ได้ระหว่างนี้' : 'matchmaking disabled'}</p>
          </div>
          <button onClick={() => router.push(`/tournament/${lockedTournament.id}`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
            {lang === 'th' ? 'ไปที่ Tournament →' : 'Go to Tournament →'}
          </button>
        </div>
      )}

      {/* ── How to Play ──────────────────────────────────────────── */}
      {(() => {
        const steps = lang === 'th' ? [
          { icon: '🃏', title: 'เลือกเกม',        desc: 'เลือกประเภทเกมการ์ดที่ต้องการเล่น' },
          { icon: '🔀', title: 'จับคู่',           desc: 'กด "จับคู่สุ่ม" หรือท้าเพื่อนด้วย Player ID' },
          { icon: '📷', title: 'ทดสอบกล้อง',      desc: 'ตรวจสอบกล้องและไมค์ก่อนเข้าเกม' },
          { icon: '🎮', title: 'เริ่มเล่น',        desc: 'เล่นการ์ดจริงผ่านวิดีโอสดกับคู่แข่ง' },
        ] : [
          { icon: '🃏', title: 'Pick a Game',    desc: 'Select the card game type you want to play' },
          { icon: '🔀', title: 'Match Up',       desc: 'Quick Match or challenge via Player ID' },
          { icon: '📷', title: 'Check Camera',   desc: 'Test your camera & mic before entering' },
          { icon: '🎮', title: 'Play Live',      desc: 'Play physical cards via live video call' },
        ];
        return (
          <div className="mb-6 card p-4" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              {lang === 'th' ? '✨ วิธีการเล่น' : '✨ How to Play'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'rgba(124,58,237,0.1)' }}>
                    {s.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-purple-400"
                        style={{ background: 'rgba(124,58,237,0.15)' }}>{i + 1}</span>
                      <p className="text-white text-xs font-semibold">{s.title}</p>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8 gap-2 w-full min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t.lobbyTitle}</h1>
          <p className="text-slate-500 text-sm mt-0.5 hidden sm:block">
            {lang === 'th' ? 'เลือกเกมและหาคู่ต่อสู้' : 'Choose a game and find an opponent'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/setup"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border)', color: '#94a3b8' }}>
            <Settings size={14} />
            <span className="hidden sm:inline">{lang === 'th' ? 'ทดสอบ' : 'Setup'}</span>
          </Link>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}>
            <Users size={13} />
            <span className="font-semibold">{onlineCount}</span>
            <span className="hidden sm:inline text-green-600">{lang === 'th' ? 'ออนไลน์' : 'online'}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 w-full min-w-0">

        {/* Game selection */}
        <div className="lg:col-span-2 min-w-0 overflow-hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{t.selectGame}</p>
          {/* Mobile: horizontal scroll tabs */}
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-3 w-full"
            style={{ WebkitOverflowScrolling: 'touch' }}>
            {games.map((game) => {
              const active = selectedGame?._id === game._id;
              return (
                <button key={game._id} onClick={() => setSelectedGame(game)}
                  className={`flex-shrink-0 snap-start flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition whitespace-nowrap
                    ${active ? 'border-purple-500/50' : 'border-[var(--border)]'}`}
                  style={active ? { background: 'rgba(124,58,237,0.12)', color: game.color } : { background: 'var(--card)', color: '#94a3b8' }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-sm"
                    style={{ background: `${game.color}20` }}>🃏</div>
                  {lang === 'th' ? game.nameTh : game.name}
                </button>
              );
            })}
          </div>
          {/* Desktop: vertical list */}
          <div className="hidden lg:flex flex-col space-y-2">
            {games.map((game) => {
              const active = selectedGame?._id === game._id;
              return (
                <button key={game._id} onClick={() => setSelectedGame(game)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all
                    ${active ? 'border-purple-500/50 shadow-[0_0_20px_rgba(124,58,237,0.15)]' : 'border-[var(--border)] hover:border-[var(--border-2)] hover:bg-white/[0.02]'}`}
                  style={active ? { background: 'rgba(124,58,237,0.08)' } : { background: 'var(--card)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ background: `${game.color}15`, border: `1px solid ${game.color}30` }}>🃏</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{lang === 'th' ? game.nameTh : game.name}</div>
                    <div className="text-xs text-slate-600 truncate mt-0.5">{lang === 'th' ? game.descriptionTh : game.description}</div>
                  </div>
                  {active && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: game.color }} />}
                </button>
              );
            })}
          </div>
          {/* IP disclaimer under game list */}
          <p className="text-[10px] text-slate-700 mt-2 leading-relaxed">
            {lang === 'th'
              ? 'ชื่อเกมเป็นสมบัติของเจ้าของสิทธิ์ CardMatch ไม่ใช่ตัวแทนหรือพันธมิตรของเจ้าของสิทธิ์ใดๆ'
              : 'Game names are property of their respective owners. CardMatch is not affiliated with any rights holder.'}
          </p>
        </div>

        {/* Actions */}
        <div className="lg:col-span-3 space-y-4 min-w-0 w-full">

          {/* Quick Match */}
          <div className="card p-5 md:p-6" style={{ borderColor: inQueue ? 'rgba(124,58,237,0.3)' : 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Shuffle size={17} className="text-purple-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">{t.quickMatch}</h2>
                <p className="text-xs text-slate-600">{t.quickMatchDesc}</p>
              </div>
            </div>

            {selectedGame && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm"
                style={{ background: `${selectedGame.color}10`, border: `1px solid ${selectedGame.color}20`, color: selectedGame.color }}>
                🃏 {lang === 'th' ? selectedGame.nameTh : selectedGame.name}
              </div>
            )}

            {/* Socket connecting indicator */}
            {!connected && !inQueue && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                <Loader2 size={11} className="animate-spin flex-shrink-0" />
                {lang === 'th' ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์...' : 'Connecting to server...'}
              </div>
            )}

            <button onClick={handleQuickMatch}
              disabled={(!connected && !inQueue) || !!lockedTournament}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${inQueue
                  ? 'text-red-300'
                  : connected && !lockedTournament
                    ? 'btn-primary text-white'
                    : 'opacity-50 cursor-wait text-slate-400'}`}
              style={inQueue ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
                : (!connected || lockedTournament) ? { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' } : {}}>
              {inQueue ? (
                <><Loader2 size={16} className="animate-spin" />{t.searching}<span className="font-mono text-red-400">{fmtTime(queueTime)}</span><X size={15} /></>
              ) : !connected ? (
                <><Loader2 size={16} className="animate-spin" />{lang === 'th' ? 'กำลังเชื่อมต่อ...' : 'Connecting...'}</>
              ) : (
                <><Shuffle size={16} />{t.quickMatch}</>
              )}
            </button>
          </div>

          {/* Find Player */}
          <div className="card p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <Search size={17} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">{t.findPlayer}</h2>
                <p className="text-xs text-slate-600">{lang === 'th' ? 'ค้นหาตามชื่อผู้เล่น' : 'Search by username'}</p>
              </div>
            </div>

            <div className="relative mb-4">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                placeholder={t.findPlayerPlaceholder} className="input-base pl-9 text-sm" />
              {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 animate-spin" />}
            </div>

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="text-center py-5 text-slate-600 text-sm">{t.noPlayers}</div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(p => (
                  <div key={p._id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--border-2)] transition" style={{ background: 'var(--bg-2)' }}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {p.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{p.username}</div>
                      <div className="text-xs text-slate-600">{p.stats?.totalGames || 0} {lang === 'th' ? 'เกม' : 'games'}</div>
                    </div>
                    <button onClick={() => handleChallenge(p._id)}
                      disabled={!!lockedTournament}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                      <Swords size={12} /> {t.challenge}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!searchQuery && (
              <div className="text-center py-5 text-slate-700 text-sm">
                {lang === 'th' ? 'พิมพ์ชื่อผู้เล่นเพื่อค้นหา' : 'Type a username to search'}
              </div>
            )}
          </div>

          {/* Challenge by Player ID */}
          <div className="card p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Hash size={17} className="text-purple-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">{t.challengeById}</h2>
                <p className="text-xs text-slate-600">{lang === 'th' ? 'กรอก Player ID เพื่อท้าโดยตรง' : 'Enter Player ID to challenge directly'}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={pidInput}
                  onChange={e => setPidInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder={t.playerIdPlaceholder}
                  className="input-base pl-8 text-sm font-mono tracking-widest uppercase"
                  maxLength={6}
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300)}
                />
              </div>
              <button
                onClick={handleChallengeById}
                disabled={pidInput.length !== 6 || pidLoading || !selectedGame || !!lockedTournament || inQueue}
                className="btn-primary px-4 py-2 rounded-xl text-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                {pidLoading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Swords size={14} /> {t.challengeByIdBtn}</>}
              </button>
            </div>

            <p className="text-[11px] text-slate-700 mt-2 text-center">
              {lang === 'th'
                ? 'Player ID ของคุณอยู่ที่หน้าโปรไฟล์'
                : 'Your Player ID is on your profile page'}
            </p>

            {/* Pending challenge indicator */}
            {pidPending && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Loader2 size={14} className="text-purple-400 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-purple-300 text-xs font-medium">
                    {lang === 'th' ? `รอ ${pidPending.username} ตอบรับ...` : `Waiting for ${pidPending.username}...`}
                  </p>
                  <p className="text-slate-600 text-[10px]">
                    {lang === 'th' ? 'คำท้าจะหมดอายุใน 30 วินาที' : 'Challenge expires in 30 seconds'}
                  </p>
                </div>
                <button onClick={() => { setPidPending(null); clearTimeout(pidTimeoutRef.current); }}
                  className="text-slate-600 hover:text-slate-400 transition p-1">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Floating public chat */}
      <PublicChat
        lang={lang}
        user={user}
        messages={chatMessages}
        onSend={sendPublicMessage}
      />

    </div>
  );
}
