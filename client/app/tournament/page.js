'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import { Trophy, Users, ChevronRight, RefreshCw } from 'lucide-react';

function TournamentCard({ t, lang, onJoin, joining }) {
  const isFull  = t.playerCount >= t.maxPlayers;
  const canJoin = t.status === 'waiting' && !isFull;
  const isActive = t.status === 'active';

  return (
    <div className="card p-5 flex items-center gap-4 transition"
      style={{ borderColor: isActive ? 'rgba(251,191,36,0.25)' : 'var(--border)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
        style={{
          background: isActive ? 'rgba(251,191,36,0.1)' : 'rgba(124,58,237,0.1)',
          border: `1px solid ${isActive ? 'rgba(251,191,36,0.2)' : 'rgba(124,58,237,0.2)'}`,
        }}>
        {isActive ? '⚔️' : '🏆'}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-white truncate text-base">{t.name}</h3>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs font-semibold ${isActive ? 'text-yellow-400' : isFull ? 'text-red-400' : 'text-green-400'}`}>
            {isActive
              ? (lang === 'th' ? '⚔️ กำลังแข่ง' : '⚔️ In Progress')
              : isFull
                ? (lang === 'th' ? '❌ เต็ม' : '❌ Full')
                : (lang === 'th' ? '✅ รับสมัคร' : '✅ Open')}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users size={10} /> {t.playerCount}/{t.maxPlayers}
          </span>
          {t.isJoined && !isActive && (
            <span className="text-xs text-purple-400 font-semibold">
              {lang === 'th' ? '(เข้าร่วมแล้ว)' : '(Joined)'}
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
    </div>
  );
}

export default function TournamentListPage() {
  const { user, loading: authLoading, lang } = useAuth();
  const { getSocket } = useSocket();
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [joining,     setJoining]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { tournaments: list } = await api.get('/api/tournament');
      setTournaments(list || []);
    } catch {} finally { setLoading(false); }
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
    const onStarted = ({ tournamentId }) =>
      setTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'active' } : x));

    socket.on('tournament_created',      onCreated);
    socket.on('tournament_closed',       onClosed);
    socket.on('tournament_player_count', onCount);
    socket.on('tournament_started',      onStarted);

    return () => {
      socket.off('tournament_created',      onCreated);
      socket.off('tournament_closed',       onClosed);
      socket.off('tournament_player_count', onCount);
      socket.off('tournament_started',      onStarted);
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
  const active = tournaments.filter(t => t.status === 'active');

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
                <TournamentCard key={t.id} t={t} lang={lang} onJoin={handleJoin} joining={joining} />
              ))}
            </>
          )}
          {active.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-1 mt-6">
                {lang === 'th' ? 'กำลังแข่งอยู่' : 'In Progress'}
              </p>
              {active.map(t => (
                <TournamentCard key={t.id} t={t} lang={lang} onJoin={handleJoin} joining={joining} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
