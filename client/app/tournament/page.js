'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import { Trophy, Users, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import translations from '../../lib/translations';

function useCountdown(targetDate, lang) {
  const [diff, setDiff] = useState(() => targetDate ? new Date(targetDate) - Date.now() : null);
  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setDiff(new Date(targetDate) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  if (diff === null || diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const isTh = lang !== 'en';
  if (h > 24) return isTh ? `${Math.floor(h/24)} วัน` : `${Math.floor(h/24)}d`;
  if (h > 0) return isTh ? `${h}ชม. ${m}น.` : `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2,'0')}${isTh ? ' น.' : ''}`;
}

function TournamentCard({ t, lang, onJoin, joining, user }) {
  const tl = translations[lang];
  const countdown = useCountdown(t.scheduledAt, lang);
  const isFull  = t.playerCount >= t.maxPlayers;
  const canJoin = t.status === 'waiting' && !isFull;
  const isActive = t.status === 'active';
  const isRoundComplete = t.status === 'round_complete';

  return (
    <div className="card p-5 flex items-center gap-4 transition"
      style={{ borderColor: isActive || isRoundComplete ? 'rgba(251,191,36,0.25)' : 'var(--border)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
        style={{
          background: isActive || isRoundComplete ? 'rgba(251,191,36,0.1)' : 'rgba(124,58,237,0.1)',
          border: `1px solid ${isActive || isRoundComplete ? 'rgba(251,191,36,0.2)' : 'rgba(124,58,237,0.2)'}`,
        }}>
        {isActive ? '⚔️' : isRoundComplete ? '🔄' : '🏆'}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-white truncate text-base">{t.name}</h3>
        {(t.gameTypeNameTh || t.gameTypeName) && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            🎮 {lang === 'th' ? (t.gameTypeNameTh || t.gameTypeName) : (t.gameTypeName || t.gameTypeNameTh)}
            {t.totalRounds > 0 && (
              <span className="ml-2 text-slate-600">
                · {isActive || isRoundComplete
                  ? (lang === 'th' ? `รอบ ${t.currentRound}/${t.totalRounds}` : `Round ${t.currentRound}/${t.totalRounds}`)
                  : (lang === 'th' ? `${t.totalRounds} รอบ` : `${t.totalRounds} rounds`)}
              </span>
            )}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs font-semibold ${isActive ? 'text-yellow-400' : isRoundComplete ? 'text-purple-400' : isFull ? 'text-red-400' : 'text-green-400'}`}>
            {isActive
              ? tl.tourneyStatusActive
              : isRoundComplete
                ? tl.tourneyStatusBetween
                : isFull
                  ? (lang === 'th' ? '❌ เต็ม' : '❌ Full')
                  : tl.tourneyStatusOpen}
          </span>
          {isRoundComplete && (
            <span className="text-[10px] text-slate-500">{tl.waitingAdminNextRound}</span>
          )}
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users size={10} /> {t.playerCount}/{t.maxPlayers}
          </span>
          {t.isJoined && !isActive && (
            <span className="text-xs text-purple-400 font-semibold">
              {lang === 'th' ? '(เข้าร่วมแล้ว)' : '(Joined)'}
            </span>
          )}
          {t.scheduledAt && (
            <span className="text-xs text-slate-500">
              ⏰ {countdown !== null ? `เหลือ ${countdown}` : new Date(t.scheduledAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'}
            </span>
          )}
        </div>
      </div>

      {t.status === 'waiting' && (
        <button
          onClick={() => onJoin(t)}
          disabled={(!canJoin && !t.isJoined) || joining === t.id}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition active:scale-95 disabled:opacity-40"
          style={
            t.isJoined
              ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }
              : isFull
                ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                : { background: 'rgba(124,58,237,0.8)', color: 'white' }
          }>
          {joining === t.id
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : t.isJoined
              ? <>{lang === 'th' ? 'เข้าห้องรอ' : 'Enter Room'}<ChevronRight size={14} /></>
              : isFull
                ? (lang === 'th' ? 'เต็ม' : 'Full')
                : <>{lang === 'th' ? 'เข้าร่วม' : 'Join'}<ChevronRight size={14} /></>}
        </button>
      )}
      {t.status !== 'waiting' && t.isJoined && (
        <button
          onClick={() => onJoin(t)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition active:scale-95"
          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
          {lang === 'th' ? 'เข้าดู' : 'View'}<ChevronRight size={14} />
        </button>
      )}
      {t.status !== 'waiting' && !t.isJoined && (
        user?.isAdmin ? (
          <button
            onClick={() => onJoin(t)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition active:scale-95"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
            {lang === 'th' ? 'ดูการแข่ง' : 'Watch'}<ChevronRight size={14} />
          </button>
        ) : (
          <span className="text-xs text-slate-500 px-4 py-2 flex-shrink-0">
            {lang === 'th' ? 'ไม่สามารถเข้าร่วม' : 'In progress'}
          </span>
        )
      )}
    </div>
  );
}

export default function TournamentListPage() {
  const { user, loading: authLoading, lang } = useAuth();
  const { getSocket } = useSocket();
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [joining,     setJoining]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { tournaments: list } = await api.get('/api/tournament');
      setTournaments(list || []);
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    load();
  }, [authLoading, user, router, load]);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCreated = (t) => setTournaments(p => [{ ...t, playerCount: t.playerCount || 0 }, ...p.filter(x => x.id !== t.id)]);
    const onClosed  = ({ tournamentId }) => setTournaments(p => p.filter(x => x.id !== tournamentId));
    const onCount   = ({ tournamentId, playerCount }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, playerCount } : x));
    const onStarted  = ({ tournamentId }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'active' } : x));
    const onUpdated  = ({ id, status }) =>
      setTournaments(p => p.map(x => x.id === id ? { ...x, status } : x));

    socket.on('tournament_created',      onCreated);
    socket.on('tournament_closed',       onClosed);
    socket.on('tournament_player_count', onCount);
    socket.on('round_started',           onStarted);
    socket.on('tournament_updated',      onUpdated);

    return () => {
      socket.off('tournament_created',      onCreated);
      socket.off('tournament_closed',       onClosed);
      socket.off('tournament_player_count', onCount);
      socket.off('round_started',           onStarted);
      socket.off('tournament_updated',      onUpdated);
    };
  }, [getSocket]);

  const handleJoin = (t) => {
    setJoining(t.id);
    router.push(`/tournament/${t.id}`);
  };

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const open   = tournaments.filter(t => t.status === 'waiting');
  const active = tournaments.filter(t => ['active', 'round_complete'].includes(t.status));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Trophy size={20} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {lang === 'th' ? 'ทัวร์นาเมนต์' : 'Tournaments'}
            </h1>
            <p className="text-xs text-slate-600">
              {lang === 'th' ? 'ห้องแข่งที่เปิดอยู่' : 'Open tournament rooms'}
            </p>
          </div>
        </div>
        <button onClick={load}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/5 transition">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="text-slate-600 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="card p-10 text-center">
          <p className="text-slate-400 font-semibold mb-3">
            {translations[lang].failedToLoad}
          </p>
          <button onClick={load}
            className="btn-ghost px-5 py-2 rounded-xl text-sm">
            {translations[lang].retryBtn}
          </button>
        </div>
      ) : open.length === 0 && active.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-slate-400 font-semibold">
            {lang === 'th' ? 'ยังไม่มีทัวร์นาเมนต์ที่เปิดรับ' : 'No open tournaments right now'}
          </p>
          <p className="text-slate-700 text-sm mt-1">
            {lang === 'th' ? 'Admin จะเปิดทัวร์นาเมนต์เมื่อพร้อม' : 'Admin will open one when ready'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1">
                {lang === 'th' ? 'รับสมัครอยู่' : 'Open for Registration'}
              </p>
              {open.map(t => (
                <TournamentCard key={t.id} t={t} lang={lang} onJoin={handleJoin} joining={joining} user={user} />
              ))}
            </>
          )}
          {active.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1 mt-6">
                {lang === 'th' ? 'กำลังแข่งอยู่' : 'In Progress'}
              </p>
              {active.map(t => (
                <TournamentCard key={t.id} t={t} lang={lang} onJoin={handleJoin} joining={joining} user={user} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
