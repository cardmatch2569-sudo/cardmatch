'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import translations from '../../lib/translations';
import {
  Shield, Users, Gamepad2, Radio, Plus, Pencil, Trash2, X, Save,
  ToggleLeft, ToggleRight, Search, RefreshCw, Crown, UserX,
  Activity, Clock, CheckCircle, XCircle, Loader2, Trophy, Play, Eye, Gavel, Bell,
} from 'lucide-react';

const TABS = ['overview', 'users', 'games', 'rooms', 'tournament'];
const EMPTY_GAME = { name: '', nameTh: '', description: '', descriptionTh: '', imageUrl: '', color: '#7c3aed', isActive: true };
const EMPTY_TOURNEY = { name: '', gameTypeId: '', maxPlayers: 8, totalRounds: 3, scheduledAt: '', scheduledEnd: '' };

export default function AdminPage() {
  const { user, loading: authLoading, lang, isAdminMode, toggleViewMode } = useAuth();
  const router = useRouter();

  const [tab,       setTab]       = useState('overview');
  const [annText,   setAnnText]   = useState('');
  const [annActive, setAnnActive] = useState(null);
  const [annSaving, setAnnSaving] = useState(false);
  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage,  setUserPage]  = useState(1);
  const [userSearch,setUserSearch]= useState('');
  const [games,     setGames]     = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [online,    setOnline]    = useState([]);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState(EMPTY_GAME);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  // Delete user
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError,    setDeleteError]    = useState('');
  const [deleting,       setDeleting]       = useState(false);

  // Tournament state
  const [tournaments,     setTournaments]     = useState([]);
  const [tourneyForm,     setTourneyForm]     = useState(EMPTY_TOURNEY);
  const [tourneyCreating, setTourneyCreating] = useState(false);
  const [tourneyError,    setTourneyError]    = useState('');
  const [alerts,          setAlerts]          = useState([]); // { id, type, roomId, matchId, players }
  // Spectate state
  const [spectateRoomId,  setSpectateRoomId]  = useState(null);
  const spectateRoomIdRef  = useRef(null);      // ref mirror — always current in closures
  const [spectatePlayer1, setSpectatePlayer1] = useState('');
  const [spectatePlayer2, setSpectatePlayer2] = useState('');
  const spectateVideo1Ref  = useRef(null);
  const spectateVideo2Ref  = useRef(null);
  const spectateConnsRef   = useRef(new Map()); // userId → RTCPeerConnection
  // Decide match state
  const [decideMatch, setDecideMatch] = useState(null); // { roomId, players: [p1Id, p2Id], names: [n1, n2] }

  // Bug fix: debounce ref for user search
  const searchTimer = useRef(null);

  // Bug fix: check loading before redirecting
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!user.isAdmin) { router.push('/lobby'); }
  }, [authLoading, user, router]);

  const loadStats  = useCallback(async () => { try { const d = await api.get('/api/admin/stats');  setStats(d); } catch {} }, []);
  const loadAnnouncement = useCallback(async () => { try { const { announcement } = await api.get('/api/admin/announcement'); setAnnActive(announcement); if (announcement?.text) setAnnText(announcement.text); } catch {} }, []);
  const saveAnnouncement = async () => { if (!annText.trim()) return; setAnnSaving(true); try { const { announcement } = await api.post('/api/admin/announcement', { text: annText }); setAnnActive(announcement); } catch {} setAnnSaving(false); };
  const clearAnnouncement = async () => { try { await api.delete('/api/admin/announcement'); setAnnActive(null); setAnnText(''); } catch {} };
  const loadUsers  = useCallback(async (page = 1, search = '') => {
    setTableLoading(true);
    try {
      const d = await api.get(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}&limit=15`);
      setUsers(d.users); setUserTotal(d.total); setUserPage(page);
    } catch {} finally { setTableLoading(false); }
  }, []);
  const loadGames  = useCallback(async () => { try { const { games } = await api.get('/api/games/all'); setGames(games); } catch {} }, []);
  const loadRooms  = useCallback(async () => { try { const { rooms }  = await api.get('/api/admin/rooms');  setRooms(rooms); } catch {} }, []);
  const loadOnline = useCallback(async () => { try { const { online } = await api.get('/api/admin/online'); setOnline(online); } catch {} }, []);

  const loadTournaments = useCallback(async () => {
    try { const { tournaments: list } = await api.get('/api/tournament'); setTournaments(list || []); } catch {}
  }, []);

  useEffect(() => { if (user?.isAdmin) { loadStats(); loadOnline(); loadAnnouncement(); loadTournaments(); loadGames(); } }, [user, loadStats, loadOnline, loadAnnouncement, loadTournaments, loadGames]);
  useEffect(() => { if (tab === 'users')      loadUsers(1, ''); },    [tab, loadUsers]);
  useEffect(() => { if (tab === 'games')      loadGames(); },          [tab, loadGames]);
  useEffect(() => { if (tab === 'rooms')      loadRooms(); },          [tab, loadRooms]);
  useEffect(() => { if (tab === 'tournament') loadTournaments(); }, [tab, loadTournaments]);
  useEffect(() => { if (tab === 'overview')   { loadStats(); loadOnline(); } }, [tab, loadStats, loadOnline]);

  // Tournament socket: admin match alerts + real-time updates
  const { getSocket } = useSocket();
  useEffect(() => {
    if (!user?.isAdmin) return;
    const socket = getSocket();
    if (!socket) return;

    const onAlert = (data) => {
      const alertId = Date.now() + Math.random();
      setAlerts(p => [{ id: alertId, ...data }, ...p.slice(0, 9)]);
      setTimeout(() => setAlerts(p => p.filter(a => a.id !== alertId)), 30000);
    };
    const onCreated = (t) => setTournaments(p => [t, ...p.filter(x => x.id !== t.id)]);
    const onClosed  = ({ tournamentId }) => setTournaments(p => p.filter(x => x.id !== tournamentId));
    const onCount   = ({ tournamentId, playerCount }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, playerCount } : x));
    const onRoundStarted = ({ tournamentId, roundNumber, totalRounds }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'active', currentRound: roundNumber, totalRounds } : x));
    const onRoundComplete = ({ tournamentId, roundNumber }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'round_complete', currentRound: roundNumber, activeMatchCount: 0 } : x));
    const onTournamentComplete = ({ tournamentId }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'ended' } : x));

    // Admin spectate WebRTC
    const onSpectateOffer = ({ from, fromUsername, offer, roomId }) => {
      if (roomId !== spectateRoomIdRef.current) return;
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
        ],
      });
      pc.ontrack = ({ streams }) => {
        const existing = spectateConnsRef.current.size;
        if (existing === 0) {
          if (spectateVideo1Ref.current) spectateVideo1Ref.current.srcObject = streams[0];
          setSpectatePlayer1(fromUsername);
        } else {
          if (spectateVideo2Ref.current) spectateVideo2Ref.current.srcObject = streams[0];
          setSpectatePlayer2(fromUsername);
        }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('admin_peer_ice', { roomId, targetUserId: from, candidate });
      };
      pc.setRemoteDescription(new RTCSessionDescription(offer));
      pc.createAnswer().then(answer => {
        pc.setLocalDescription(answer);
        socket.emit('admin_peer_answer', { roomId, targetUserId: from, answer });
      }).catch(() => {});
      spectateConnsRef.current.set(from, pc);
    };
    const onSpectateIce = ({ candidate, from }) => {
      const pc = spectateConnsRef.current.get(from);
      try { pc?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };
    const onSpectateEnded = () => stopSpectating();

    socket.on('admin_match_alert',   onAlert);
    socket.on('tournament_created',  onCreated);
    socket.on('tournament_closed',   onClosed);
    socket.on('tournament_player_count', onCount);
    socket.on('round_started',       onRoundStarted);
    socket.on('round_complete',      onRoundComplete);
    socket.on('tournament_complete', onTournamentComplete);
    socket.on('admin_peer_offer',    onSpectateOffer);
    socket.on('admin_peer_ice',      onSpectateIce);
    socket.on('spectate_ended',      onSpectateEnded);

    return () => {
      socket.off('admin_match_alert',   onAlert);
      socket.off('tournament_created',  onCreated);
      socket.off('tournament_closed',   onClosed);
      socket.off('tournament_player_count', onCount);
      socket.off('round_started',       onRoundStarted);
      socket.off('round_complete',      onRoundComplete);
      socket.off('tournament_complete', onTournamentComplete);
      socket.off('admin_peer_offer',    onSpectateOffer);
      socket.off('admin_peer_ice',      onSpectateIce);
      socket.off('spectate_ended',      onSpectateEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, getSocket]);

  // Bug fix: debounced user search
  const handleUserSearch = (q) => {
    setUserSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadUsers(1, q), 350);
  };

  const handleToggleAdmin = async (id, name) => {
    if (!confirm(`${translations[lang].toggleAdminPfx} "${name}"?`)) return;
    try {
      const { isAdmin } = await api.put(`/api/admin/users/${id}/role`, {});
      setUsers(p => p.map(u => u._id === id ? { ...u, isAdmin } : u));
      loadStats();
    } catch (err) { alert(err.message); }
  };

  const openAdd  = () => { setForm(EMPTY_GAME); setEditId(null); setFormError(''); setModal('game'); };
  const openEdit = (g) => {
    setForm({ name: g.name, nameTh: g.nameTh, description: g.description || '', descriptionTh: g.descriptionTh || '', imageUrl: g.imageUrl || '', color: g.color || '#7c3aed', isActive: g.isActive });
    setEditId(g._id); setFormError(''); setModal('game');
  };
  const handleSaveGame = async () => {
    if (!form.name || !form.nameTh) {
      setFormError(translations[lang].bothNamesRequired);
      return;
    }
    setSaving(true);
    try {
      if (modal === 'game' && !editId) await api.post('/api/games', form);
      else await api.put(`/api/games/${editId}`, form);
      await loadGames(); setModal(null);
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteGame = async (id, name) => {
    if (!confirm(`${translations[lang].deleteGame} "${name}"?`)) return;
    try { await api.delete(`/api/games/${id}`); await loadGames(); } catch {}
  };

  const openDeleteUser = (u) => {
    setDeleteTarget(u);
    setDeletePassword('');
    setDeleteError('');
    setModal('delete-user');
  };

  const handleDeleteUser = async () => {
    if (!deletePassword || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/admin/users/${deleteTarget._id}`, { password: deletePassword });
      setUsers(p => p.filter(u => u._id !== deleteTarget._id));
      setUserTotal(p => p - 1);
      loadStats();
      setModal(null);
      setDeleteTarget(null);
      setDeletePassword('');
    } catch (err) {
      setDeleteError(err.message || translations[lang].wrongPassword);
    } finally { setDeleting(false); }
  };

  const closeDeleteModal = () => { setModal(null); setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); };

  // Tournament actions
  const handleCreateTourney = () => {
    setTourneyError('');
    if (!tourneyForm.name.trim()) {
      setTourneyError(translations[lang].tourneyNameRequired);
      return;
    }
    if (!tourneyForm.gameTypeId) {
      setTourneyError(translations[lang].tourneyGameRequired);
      return;
    }
    if (tourneyForm.scheduledAt && new Date(tourneyForm.scheduledAt) <= new Date()) {
      setTourneyError(translations[lang].tourneyStartFuture);
      return;
    }
    if (tourneyForm.scheduledAt && tourneyForm.scheduledEnd &&
        new Date(tourneyForm.scheduledEnd) <= new Date(tourneyForm.scheduledAt)) {
      setTourneyError(translations[lang].tourneyEndAfterStart);
      return;
    }
    setTourneyCreating(true);
    const socket = getSocket();
    if (!socket) {
      setTourneyError(translations[lang].notConnected);
      setTourneyCreating(false);
      return;
    }
    const toUTC = (s) => s ? new Date(s).toISOString() : null;
    socket.emit('create_tournament', {
      name: tourneyForm.name.trim(),
      gameTypeId: tourneyForm.gameTypeId,
      maxPlayers: tourneyForm.maxPlayers,
      totalRounds: tourneyForm.totalRounds,
      scheduledAt:  toUTC(tourneyForm.scheduledAt),
      scheduledEnd: toUTC(tourneyForm.scheduledEnd),
    });
    const onOk = () => {
      socket.off('tournament_error', onFail);
      setTourneyForm(EMPTY_TOURNEY);
      setTourneyCreating(false);
      setTourneyError('');
      loadTournaments();
    };
    const onFail = ({ message }) => {
      socket.off('tournament_created_ok', onOk);
      setTourneyError(message);
      setTourneyCreating(false);
    };
    socket.once('tournament_created_ok', onOk);
    socket.once('tournament_error', onFail);
    // Timeout fallback — clean up both listeners
    setTimeout(() => {
      socket.off('tournament_created_ok', onOk);
      socket.off('tournament_error', onFail);
      setTourneyCreating(false);
    }, 8000);
  };

  const handleStartRound = (tournamentId) => {
    getSocket()?.emit('start_round', { tournamentId });
  };

  const handleCloseTourney = (tournamentId) => {
    if (!confirm(translations[lang].closeTourneyConfirm)) return;
    getSocket()?.emit('close_tournament', { tournamentId });
  };

  const startSpectating = (roomId) => {
    spectateRoomIdRef.current = roomId;
    setSpectateRoomId(roomId);
    setSpectatePlayer1('');
    setSpectatePlayer2('');
    spectateConnsRef.current.forEach(pc => pc.close());
    spectateConnsRef.current = new Map();
    if (spectateVideo1Ref.current) spectateVideo1Ref.current.srcObject = null;
    if (spectateVideo2Ref.current) spectateVideo2Ref.current.srcObject = null;
    getSocket()?.emit('admin_watch_room', { roomId });
  };

  const stopSpectating = () => {
    const rid = spectateRoomIdRef.current;
    if (rid) getSocket()?.emit('admin_stop_watching', { roomId: rid });
    spectateRoomIdRef.current = null;
    spectateConnsRef.current.forEach(pc => pc.close());
    spectateConnsRef.current = new Map();
    setSpectateRoomId(null);
    setSpectatePlayer1('');
    setSpectatePlayer2('');
  };

  const handleDecideMatch = (winnerId) => {
    if (!decideMatch) return;
    getSocket()?.emit('admin_decide_match', { roomId: decideMatch.roomId, winnerId });
    setDecideMatch(null);
    setAlerts(p => p.filter(a => a.roomId !== decideMatch.roomId));
  };

  const dismissAlert = (id) => setAlerts(p => p.filter(a => a.id !== id));

  if (authLoading || !user?.isAdmin) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const t = translations[lang];

  // Short labels for mobile, full for desktop
  const tabLabels = {
    overview:   <><span className="hidden sm:inline">📊 </span><span className="sm:hidden">📊</span><span className="hidden sm:inline">{t.overview}</span></>,
    users:      <><span className="hidden sm:inline">👥 </span><span className="sm:hidden">👥</span><span className="hidden sm:inline">{t.users}</span></>,
    games:      <><span className="hidden sm:inline">🃏 </span><span className="sm:hidden">🃏</span><span className="hidden sm:inline">{t.games}</span></>,
    rooms:      <><span className="hidden sm:inline">🎮 </span><span className="sm:hidden">🎮</span><span className="hidden sm:inline">{t.rooms}</span></>,
    tournament: (
      <span className="relative flex items-center gap-1">
        <span>🏆</span>
        <span className="hidden sm:inline">{t.tournament}</span>
        {alerts.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">{alerts.length}</span>
        )}
      </span>
    ),
  };

  const statCards = stats ? [
    { label: t.totalUsers,  value: stats.totalUsers,  icon: <Users size={18} />,    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)' },
    { label: t.onlineNow,   value: stats.onlineUsers, icon: <Radio size={18} />,    color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)' },
    { label: t.totalRooms,  value: stats.totalRooms,  icon: <Gamepad2 size={18} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
    { label: t.activeRooms, value: stats.activeRooms, icon: <Activity size={18} />, color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)' },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Delete User modal ───────────────────────────────── */}
      {modal === 'delete-user' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(14px)' }}>
          <div className="anim-scale-in card w-full max-w-sm p-6"
            style={{ background: 'rgba(15,10,20,0.99)', borderColor: 'rgba(239,68,68,0.35)' }}>
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent mb-6" />

            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-bold text-white mb-1">
                {t.deleteUserTitle}
              </h2>
              <p className="text-sm text-slate-400 mb-1">
                {t.deleteUserLabel}{' '}
                <span className="text-red-400 font-bold">"{deleteTarget.username}"</span>
                {' '}{t.deleteUserMsg}
              </p>
              <p className="text-xs text-slate-600">
                {t.deleteUserNote}
              </p>
            </div>

            {user?.googleId && !user?.password ? (
              <div className="mb-5 px-3 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                ⚠️ {lang === 'th'
                  ? 'บัญชี Admin Google ไม่รองรับการลบผู้ใช้ กรุณาล็อกอินด้วยบัญชี Admin ที่มีรหัสผ่าน'
                  : 'Google-only Admin accounts cannot delete users. Please log in with a password-enabled Admin account.'}
              </div>
            ) : (
              <div className="mb-5">
                <label className="text-xs text-slate-400 block mb-2 font-medium">
                  {lang === 'th' ? '🔐 ยืนยันด้วยรหัสผ่านของคุณ (Admin)' : '🔐 Confirm with your Admin password'}
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                  onKeyDown={e => e.key === 'Enter' && deletePassword && handleDeleteUser()}
                  placeholder={lang === 'th' ? 'รหัสผ่านของคุณ (Admin)' : 'Your Admin password'}
                  className="input-base text-sm"
                  autoFocus
                />
                {deleteError && (
                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                    <span>⚠</span> {deleteError}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={closeDeleteModal}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                {t.cancel}
              </button>
              <button onClick={handleDeleteUser}
                disabled={(user?.googleId && !user?.password) || !deletePassword || deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(239,68,68,0.85)', color: 'white' }}>
                {deleting
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t.deleteUserDeleting}</span>
                  : t.deleteUserConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Spectate modal ─────────────────────────────────────── */}
      {spectateRoomId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Eye size={18} className="text-yellow-400" />
                {t.watchingMatch}
              </h2>
              <button onClick={stopSpectating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-red-400 transition hover:bg-red-500/10"
                style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
                <X size={14} /> {t.stopWatching}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ ref: spectateVideo1Ref, name: spectatePlayer1 }, { ref: spectateVideo2Ref, name: spectatePlayer2 }].map((v, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden aspect-video bg-black"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <video ref={v.ref} autoPlay playsInline muted={false}
                    className="w-full h-full object-cover" />
                  {!v.name && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                  )}
                  {v.name && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold text-white"
                      style={{ background: 'rgba(0,0,0,0.65)' }}>
                      {v.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {decideMatch && (
              <div className="mt-4 card p-4 text-center" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
                <p className="text-yellow-300 font-semibold text-sm mb-3">
                  {t.conflictChooseWinner}
                </p>
                <div className="flex gap-3 justify-center">
                  {decideMatch.players.map((pid, i) => (
                    <button key={pid} onClick={() => handleDecideMatch(pid)}
                      className="px-6 py-2.5 rounded-xl font-semibold text-sm transition active:scale-95"
                      style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                      🏆 {decideMatch.names[i] || `Player ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Decide match modal ──────────────────────────────────── */}
      {decideMatch && !spectateRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="anim-scale-in card w-full max-w-sm p-6 text-center"
            style={{ background: 'rgba(15,10,20,0.99)', borderColor: 'rgba(251,191,36,0.3)' }}>
            <div className="text-4xl mb-3">⚖️</div>
            <h2 className="text-white font-bold text-lg mb-2">
              {t.decideMatch}
            </h2>
            <p className="text-slate-500 text-sm mb-5">
              {t.selectWinner}
            </p>
            <div className="flex gap-3 justify-center mb-4">
              {decideMatch.players.map((pid, i) => (
                <button key={pid} onClick={() => handleDecideMatch(pid)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition active:scale-95"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                  🏆 {decideMatch.names[i] || `P${i + 1}`}
                </button>
              ))}
            </div>
            <button onClick={() => setDecideMatch(null)}
              className="btn-ghost w-full py-2 rounded-xl text-xs">
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Game modal */}
      {modal === 'game' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="anim-scale-in card w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(15,15,30,0.98)', borderColor: 'rgba(124,58,237,0.25)' }}>
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">{editId ? t.editGame : t.addGame}</h2>
                <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition"><X size={15} /></button>
              </div>
              {formError && <div className="badge badge-red w-full justify-center py-2 rounded-lg text-xs mb-4">{formError}</div>}
              <div className="space-y-3">
                {[
                  { key: 'name',          label: t.gameName },
                  { key: 'nameTh',        label: t.gameNameTh },
                  { key: 'description',   label: t.gameDesc },
                  { key: 'descriptionTh', label: t.gameDescTh },
                  { key: 'imageUrl',      label: t.gameImageUrl },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500 block mb-1.5 font-medium">{label}</label>
                    <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-base text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5 font-medium">{t.colorLabel}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer p-0.5"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }} />
                    <div className="flex-1 flex items-center gap-2 input-base text-sm">
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: /^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : 'transparent' }} />
                      <input
                        type="text"
                        key={form.color}
                        defaultValue={form.color}
                        maxLength={7}
                        placeholder="#7c3aed"
                        onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setForm({ ...form, color: e.target.value }); }}
                        className="flex-1 bg-transparent outline-none font-mono text-slate-400 min-w-0"
                      />
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl border transition"
                  style={{ background: form.isActive ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', borderColor: form.isActive ? 'rgba(74,222,128,0.2)' : 'var(--border)' }}>
                  <span className="text-sm text-slate-300">{t.active}</span>
                  {form.isActive ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} className="text-slate-600" />}
                </button>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setModal(null)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">{t.cancel}</button>
                <button onClick={handleSaveGame} disabled={saving} className="btn-primary flex-1 py-2.5 rounded-xl text-sm gap-1.5">
                  <Save size={14} /> {saving ? '...' : t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Shield size={18} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-white leading-tight">Admin</h1>
            <p className="text-slate-600 text-[11px]">CardMatch</p>
          </div>
        </div>
        <button onClick={toggleViewMode}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.1)', borderColor: 'rgba(124,58,237,0.25)', color: '#a78bfa' }}>
          👤 <span className="hidden sm:inline">{t.previewUser}</span>
          <span className="sm:hidden">{t.previewUserShort}</span>
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          {statCards.map(({ label, value, icon, color, bg, border }) => (
            <div key={label} className="card p-5" style={{ borderColor: border }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
                <span className="text-3xl font-black text-white">{value}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Announcement ────────────────────────────────────────── */}
      <div className="card p-4 md:p-5 mb-5" style={{ borderColor: annActive ? 'rgba(251,191,36,0.3)' : 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📢</span>
          <h3 className="font-bold text-white text-sm">{t.announcement}</h3>
          {annActive && <span className="badge badge-yellow text-[10px]">{t.announcementLive}</span>}
        </div>
        {annActive && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-yellow-300 overflow-hidden"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <span className="font-medium">{t.announcementCurrent}</span>{annActive.text}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={annText}
            onChange={e => setAnnText(e.target.value.slice(0, 400))}
            onKeyDown={e => e.key === 'Enter' && saveAnnouncement()}
            placeholder={t.announcementPlaceholder}
            className="input-base text-sm flex-1 py-2"
          />
          <button onClick={saveAnnouncement} disabled={!annText.trim() || annSaving}
            className="btn-primary px-4 py-2 rounded-xl text-sm flex-shrink-0 disabled:opacity-40">
            {annSaving ? '...' : t.announcementSend}
          </button>
          {annActive && (
            <button onClick={clearAnnouncement}
              className="px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {t.announcementClear}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-700 mt-1.5 text-right">{annText.length}/400</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            title={{ overview: t.overview, users: t.users, games: t.games, rooms: t.rooms, tournament: t.tournament }[tabKey]}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center whitespace-nowrap px-2
              ${tab === tabKey ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            style={tab === tabKey ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.2)' } : {}}>
            {tabLabels[tabKey]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Radio size={15} className="text-green-400" />{t.onlineNowTitle}</h3>
              <button onClick={loadOnline} className="text-slate-600 hover:text-slate-400 transition"><RefreshCw size={13} /></button>
            </div>
            {online.length === 0
              ? <p className="text-slate-700 text-sm text-center py-4">{t.noUsersOnline}</p>
              : <div className="space-y-2 max-h-52 overflow-y-auto">
                  {online.map(u => (
                    <div key={u.userId} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-slate-300">{u.username}</span>
                    </div>
                  ))}
                </div>}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Activity size={15} className="text-purple-400" />{t.recentRooms}</h3>
              <button onClick={loadRooms} className="text-slate-600 hover:text-slate-400 transition"><RefreshCw size={13} /></button>
            </div>
            {rooms.length === 0
              ? <p className="text-slate-700 text-sm text-center py-4">{t.noRooms}</p>
              : <div className="space-y-2 max-h-52 overflow-y-auto">
                  {rooms.slice(0, 8).map(r => (
                    <div key={r.RoomId} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.GameColor || '#7c3aed' }} />
                      <span className="text-slate-500 font-mono">{r.RoomId.slice(0, 8)}</span>
                      <span className="text-slate-400 flex-1 truncate">{lang === 'th' ? r.GameNameTh : r.GameName}</span>
                      <span className={`badge text-[10px] ${r.Status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.Status}</span>
                    </div>
                  ))}
                </div>}
          </div>

          <div className="card p-5 md:col-span-2">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Activity size={15} className="text-blue-400" />{t.systemStatus}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'API Server', status: true },
                { label: 'SQL Server', status: true },
                { label: 'Socket.IO',  status: true },
                { label: 'Google OAuth', status: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE' },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: status ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${status ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  {status ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                  <span className="text-xs font-medium" style={{ color: status ? '#4ade80' : '#f87171' }}>{label}</span>
                </div>
              ))}
            </div>
            {stats?.pendingOTPs > 0 && (
              <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                <Clock size={12} />
                {`${t.pendingOTPs}: ${stats.pendingOTPs}${t.pendingOTPsSuffix ? ' ' + t.pendingOTPsSuffix : ''}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USERS ────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={userSearch}
                onChange={e => handleUserSearch(e.target.value)}
                placeholder={t.userSearchPlaceholder}
                className="input-base text-sm pl-9"
              />
            </div>
            <div className="text-xs text-slate-600 flex-shrink-0">
              {t.userTotal} {userTotal} {t.userTotalSuffix}
            </div>
          </div>

          <div className="card overflow-hidden table-wrap">
            {tableLoading
              ? <div className="flex justify-center py-12"><Loader2 size={24} className="text-slate-600 animate-spin" /></div>
              : <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {[t.colUser, 'Email', 'Status', t.colGames, t.colRole, ''].map((h, i) => (
                        <th key={i} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {u.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1">
                                {u.username}
                                {u.hasGoogle && <span className="text-[10px] text-blue-400">G</span>}
                              </div>
                              <div className="text-xs text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-[180px] truncate">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${u.isOnline ? 'text-green-400' : 'text-slate-600'}`}
                            style={u.isOnline ? { background: 'rgba(74,222,128,0.1)' } : {}}>
                            {u.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                            {u.isOnline ? t.online : t.statusOffline}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{u.stats.totalGames}</td>
                        <td className="px-4 py-3">
                          {u.isAdmin
                            ? <span className="badge badge-yellow text-[10px]"><Crown size={9} /> Admin</span>
                            : <span className="text-xs text-slate-600">{t.roleUser}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u._id !== user._id && (
                            <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition">
                              <button onClick={() => handleToggleAdmin(u._id, u.username)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition"
                                style={{ background: u.isAdmin ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)', color: u.isAdmin ? '#f87171' : '#fbbf24', border: `1px solid ${u.isAdmin ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
                                {u.isAdmin ? <UserX size={11} /> : <Crown size={11} />}
                                <span className="hidden sm:inline">{u.isAdmin ? t.removeAdmin : t.setAdmin}</span>
                              </button>
                              <button onClick={() => openDeleteUser(u)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition"
                                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <Trash2 size={11} />
                                <span className="hidden sm:inline">{t.deleteShort}</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>

          {userTotal > 15 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button onClick={() => loadUsers(userPage - 1, userSearch)} disabled={userPage === 1}
                className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-30">
                ← {t.prevPage}
              </button>
              <span className="text-slate-600">
                {t.pageXOfY.replace('{page}', userPage).replace('{total}', Math.ceil(userTotal / 15))}
              </span>
              <button onClick={() => loadUsers(userPage + 1, userSearch)} disabled={userPage >= Math.ceil(userTotal / 15)}
                className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-30">
                {t.nextPage} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GAMES ────────────────────────────────────────────── */}
      {tab === 'games' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openAdd} className="btn-primary text-sm gap-1.5 px-4 py-2.5 rounded-xl">
              <Plus size={15} /> {t.addGame}
            </button>
          </div>
          <div className="card overflow-hidden table-wrap">
            {games.length === 0
              ? <div className="text-center py-12 text-slate-600"><div className="text-4xl mb-3">🃏</div><p>{t.noGames}</p></div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t.colGame}</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">{t.colThai}</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t.colStatus}</th>
                      <th className="px-4 py-3.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map(g => (
                      <tr key={g._id} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${g.color}15`, border: `1px solid ${g.color}30` }}>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                            </div>
                            <span className="font-semibold text-white text-sm leading-tight">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-[140px]">
                          <span className="line-clamp-2">{g.nameTh}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge text-[10px] ${g.isActive ? 'badge-green' : 'badge-red'}`}>
                            {g.isActive ? t.statusOn : t.statusOff}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition">
                            <button onClick={() => openEdit(g)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition active:scale-95" title={t.editTitle}><Pencil size={14} /></button>
                            <button onClick={() => handleDeleteGame(g._id, g.name)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition active:scale-95" title={t.deleteTitle}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        </div>
      )}

      {/* ── ROOMS ────────────────────────────────────────────── */}
      {tab === 'rooms' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={loadRooms} className="btn-ghost text-sm gap-1.5 px-3 py-2 rounded-lg">
              <RefreshCw size={14} /> {t.refresh}
            </button>
          </div>
          <div className="card overflow-hidden table-wrap">
            {rooms.length === 0
              ? <div className="text-center py-12 text-slate-600"><div className="text-4xl mb-3">🎮</div><p>{t.noRooms}</p></div>
              : <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {['Room ID', t.colGame2, t.colStatusR, t.colTime].map((h, i) => (
                        <th key={i} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.RoomId} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{r.RoomId.slice(0, 12)}...</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: r.GameColor || '#7c3aed' }} />
                            <span className="text-slate-300">{lang === 'th' ? r.GameNameTh : r.GameName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`badge text-xs ${r.Status === 'active' ? 'badge-green' : r.Status === 'waiting' ? 'badge-yellow' : 'badge-red'}`}>{r.Status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {new Date(r.CreatedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        </div>
      )}
      {/* ── TOURNAMENT ──────────────────────────────────────────── */}
      {tab === 'tournament' && (
        <div className="space-y-5">

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className="card p-4 flex items-start gap-3 overflow-hidden"
                  style={{ borderColor: a.type === 'conflict' || a.type === 'timeout' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', transformOrigin: 'left', background: a.type === 'conflict' || a.type === 'timeout' ? 'rgba(239,68,68,0.5)' : 'rgba(251,191,36,0.5)', animation: 'countdown-bar 30s linear forwards' }} />
                  <Bell size={16} className={a.type === 'conflict' || a.type === 'timeout' ? 'text-red-400 flex-shrink-0 mt-0.5' : 'text-yellow-400 flex-shrink-0 mt-0.5'} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {a.type === 'call'      && t.alertPlayerCalled}
                      {a.type === 'conflict'  && t.alertConflict}
                      {a.type === 'timeout'   && t.alertTimeout}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Room: {a.roomId?.slice(0, 12)}...</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(a.type === 'conflict' || a.type === 'timeout') && a.roomId && (
                      <button
                        onClick={() => setDecideMatch({ roomId: a.roomId, players: a.players || [], names: a.playerNames || a.players?.map((_, i) => `Player ${i+1}`) || [] })}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                        style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                        <Gavel size={11} /> {t.decideBtn}
                      </button>
                    )}
                    {a.roomId && (
                      <button onClick={() => startSpectating(a.roomId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <Eye size={11} /> {t.watchBtn}
                      </button>
                    )}
                    <button onClick={() => dismissAlert(a.id)} className="text-slate-600 hover:text-slate-400 p-1">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create tournament form */}
          <div className="card p-5">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
              <Plus size={15} className="text-purple-400" />
              {t.createTournament}
            </h3>
            {tourneyError && (
              <div className="px-3 py-2 rounded-lg text-xs text-red-400 mb-1"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠ {tourneyError}
              </div>
            )}
            <div className="space-y-3">
              <input
                value={tourneyForm.name}
                onChange={e => { setTourneyForm(f => ({ ...f, name: e.target.value.slice(0, 100) })); setTourneyError(''); }}
                placeholder={t.tournamentName}
                className="input-base text-sm"
              />
              <div className="relative">
                <select
                  value={tourneyForm.gameTypeId}
                  onChange={e => { setTourneyForm(f => ({ ...f, gameTypeId: e.target.value })); setTourneyError(''); }}
                  className="input-base text-sm w-full pr-8"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', background: 'var(--bg-2,#0f0f1e)', color: 'var(--text,#e2e8f0)' }}>
                  <option value="" style={{ background: '#0f0f1e', color: '#94a3b8' }}>
                    {games.length === 0 ? t.loadingGames : t.selectGame2}
                  </option>
                  {games.map(g => (
                    <option key={g._id} value={g._id} style={{ background: '#0f0f1e', color: '#e2e8f0' }}>{g.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  ▾
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-slate-500 flex-shrink-0">{t.maxPlayers}</label>
                {[8, 16, 32].map(n => (
                  <button key={n} onClick={() => setTourneyForm(f => ({ ...f, maxPlayers: n }))}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                    style={tourneyForm.maxPlayers === n
                      ? { background: 'rgba(124,58,237,0.3)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.5)' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-slate-500 flex-shrink-0">{t.roundsLabel}</label>
                {[3, 5, 7].map(n => (
                  <button key={n} onClick={() => setTourneyForm(f => ({ ...f, totalRounds: n }))}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                    style={tourneyForm.totalRounds === n
                      ? { background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.5)' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {n} {t.roundsUnit}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500 block">{t.startTimeLock}</label>
                <input
                  type="datetime-local"
                  value={tourneyForm.scheduledAt}
                  onChange={e => setTourneyForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="input-base text-sm w-full"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500 block">{t.endTimeAuto} <span className="text-slate-700">{t.optional}</span></label>
                <input
                  type="datetime-local"
                  value={tourneyForm.scheduledEnd}
                  onChange={e => setTourneyForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                  className="input-base text-sm w-full"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>
            <button
              onClick={handleCreateTourney}
              disabled={!tourneyForm.name.trim() || !tourneyForm.gameTypeId || tourneyCreating}
              className="btn-primary w-full py-2.5 rounded-xl text-sm mt-4 gap-1.5 disabled:opacity-40">
              {tourneyCreating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t.creating}</>
                : <><Trophy size={14} /> {t.createTournament}</>}
            </button>
          </div>

          {/* Active tournaments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Trophy size={14} className="text-yellow-400" />
                {t.activeTournaments}
              </h3>
              <button onClick={loadTournaments} className="text-slate-600 hover:text-slate-400 transition">
                <RefreshCw size={13} />
              </button>
            </div>

            {tournaments.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-slate-700 text-sm">{t.noTournaments}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tournaments.map(tourney => (
                  <div key={tourney.id} className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white truncate">{tourney.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-semibold ${tourney.status === 'active' ? 'text-yellow-400' : tourney.status === 'round_complete' ? 'text-purple-400' : 'text-green-400'}`}>
                            {tourney.status === 'active'
                              ? t.tourneyStatusActive
                              : tourney.status === 'round_complete'
                                ? t.tourneyStatusBetween
                                : t.tourneyStatusOpen}
                          </span>
                          <span className="text-xs text-slate-600">
                            <Users size={10} className="inline mr-0.5" />
                            {tourney.playerCount}/{tourney.maxPlayers}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {['waiting', 'round_complete'].includes(tourney.status) && tourney.currentRound < (tourney.totalRounds || 3) && (
                          <button
                            onClick={() => handleStartRound(tourney.id)}
                            disabled={(tourney.playerCount || 0) < 2 || (tourney.activeMatchCount || 0) > 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-40"
                            style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                            <Play size={11} />
                            {`${t.startRound} ${(tourney.currentRound || 0) + 1}/${tourney.totalRounds || 3}`}
                          </button>
                        )}
                        <button
                          onClick={() => handleCloseTourney(tourney.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <X size={11} /> {t.closeTourney}
                        </button>
                      </div>
                    </div>

                    {(tourney.playerCount || 0) < 2 && tourney.status === 'waiting' && (
                      <p className="text-xs text-slate-600 mt-1">
                        {t.needMorePlayers}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
