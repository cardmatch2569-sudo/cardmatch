'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { api } from '../../../lib/api';
import { Trophy, Users, LogOut, Clock, Loader2 } from 'lucide-react';

export default function TournamentWaitingRoom() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading, lang } = useAuth();
  const { getSocket } = useSocket();
  const router = useRouter();

  const [tournament,  setTournament]  = useState(null);
  const [players,     setPlayers]     = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [status,      setStatus]      = useState('loading'); // loading | waiting | started | bye | error
  const [errorMsg,    setErrorMsg]    = useState('');
  const leftRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { tournament: t } = await api.get(`/api/tournament/${tournamentId}`);
      setTournament(t);
      if (t.playersInfo) setPlayers(t.playersInfo);
      return t;
    } catch {
      setErrorMsg(lang === 'th' ? 'ไม่พบ Tournament นี้' : 'Tournament not found');
      setStatus('error');
      return null;
    }
  }, [tournamentId, lang]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    const socket = getSocket();
    if (!socket) return;

    let mounted = true;

    const init = async () => {
      const t = await load();
      if (!mounted || !t) return;
      setPageLoading(false);

      if (t.status === 'ended') {
        setStatus('error');
        setErrorMsg(lang === 'th' ? 'Tournament นี้จบแล้ว' : 'This tournament has ended');
        return;
      }
      if (t.status === 'active') {
        setStatus('started');
        return;
      }

      // Join via socket
      socket.emit('join_tournament', { tournamentId });
    };

    const onJoinedOk = ({ playersInfo, tournament: t }) => {
      if (!mounted) return;
      setPlayers(playersInfo || []);
      if (t) setTournament(prev => ({ ...prev, ...t }));
      setStatus('waiting');
    };

    const onPlayerUpdate = ({ tournamentId: tid, playersInfo }) => {
      if (!mounted || tid !== tournamentId) return;
      setPlayers(playersInfo || []);
    };

    const onStarted = ({ tournamentId: tid }) => {
      if (!mounted || tid !== tournamentId) return;
      setStatus('started');
    };

    const onClosed = ({ tournamentId: tid }) => {
      if (!mounted || tid !== tournamentId) return;
      setStatus('error');
      setErrorMsg(lang === 'th' ? 'Admin ปิด Tournament แล้ว' : 'Tournament was closed by Admin');
    };

    const onMatchFound = ({ roomId, isTournament, tournamentId: tid, matchId, gameType, opponent }) => {
      if (!mounted) return;
      if (isTournament) {
        try {
          sessionStorage.setItem('cg_is_tournament', '1');
          sessionStorage.setItem('cg_tournament_id', tid || tournamentId);
          sessionStorage.setItem('cg_tournament_match_id', matchId || '');
          if (gameType?._id) sessionStorage.setItem('cg_last_game', gameType._id);
        } catch {}
      }
      leftRef.current = true;
      router.push(`/room/${roomId}`);
    };

    const onBye = ({ message }) => {
      if (!mounted) return;
      setStatus('bye');
    };

    const onError = ({ message }) => {
      if (!mounted) return;
      setStatus('error');
      setErrorMsg(message);
    };

    socket.on('tournament_joined_ok',    onJoinedOk);
    socket.on('tournament_player_update', onPlayerUpdate);
    socket.on('tournament_started',      onStarted);
    socket.on('tournament_closed',       onClosed);
    socket.on('match_found',             onMatchFound);
    socket.on('tournament_bye',          onBye);
    socket.on('tournament_error',        onError);

    init();

    return () => {
      mounted = false;
      socket.off('tournament_joined_ok',    onJoinedOk);
      socket.off('tournament_player_update', onPlayerUpdate);
      socket.off('tournament_started',      onStarted);
      socket.off('tournament_closed',       onClosed);
      socket.off('match_found',             onMatchFound);
      socket.off('tournament_bye',          onBye);
      socket.off('tournament_error',        onError);
      if (!leftRef.current) {
        socket.emit('leave_tournament', { tournamentId });
      }
    };
  }, [authLoading, user, tournamentId, router, getSocket, load, lang]);

  const handleLeave = () => {
    leftRef.current = true;
    getSocket()?.emit('leave_tournament', { tournamentId });
    router.push('/tournament');
  };

  if (authLoading || pageLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-white font-bold mb-2">{errorMsg || (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'Error')}</p>
        <button onClick={() => router.push('/tournament')}
          className="btn-ghost px-6 py-2.5 rounded-xl text-sm mt-4">
          {lang === 'th' ? 'กลับ' : 'Back'}
        </button>
      </div>
    </div>
  );

  if (status === 'started') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full p-8 text-center">
        <div className="text-4xl mb-4">⚔️</div>
        <p className="text-white font-bold text-lg mb-2">
          {lang === 'th' ? 'การแข่งเริ่มแล้ว!' : 'Tournament started!'}
        </p>
        <p className="text-slate-500 text-sm mb-4">
          {lang === 'th' ? 'กรุณารอการจับคู่ของคุณ' : 'Waiting for your match pairing'}
        </p>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-yellow-600/30 border-t-yellow-500 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );

  if (status === 'bye') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full p-8 text-center">
        <div className="text-4xl mb-4">😴</div>
        <p className="text-white font-bold text-lg mb-2">
          {lang === 'th' ? 'คุณได้รับ BYE รอบนี้' : 'You received a BYE this round'}
        </p>
        <p className="text-slate-500 text-sm">
          {lang === 'th' ? 'รอดูผลรอบนี้ก่อน' : 'Wait for this round to finish'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header card */}
      <div className="card p-5 mb-4" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Trophy size={20} className="text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-lg leading-tight truncate">
              {tournament?.name || 'Tournament'}
            </h1>
            <p className="text-xs text-slate-600">
              {lang === 'th' ? 'ห้องรอการแข่ง' : 'Waiting Room'}
            </p>
          </div>
          <button onClick={handleLeave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-red-400 transition hover:bg-red-500/10 flex-shrink-0"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <LogOut size={13} />
            {lang === 'th' ? 'ออก' : 'Leave'}
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <Clock size={14} className="text-yellow-400 flex-shrink-0 animate-pulse" />
          <p className="text-sm text-yellow-300">
            {lang === 'th' ? 'รอ Admin กดเริ่ม...' : 'Waiting for Admin to start...'}
          </p>
        </div>
      </div>

      {/* Players list */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
            <Users size={14} className="text-purple-400" />
            {lang === 'th' ? 'ผู้เข้าร่วม' : 'Players'}
          </h3>
          <span className="text-xs text-slate-600">
            {players.length}/{tournament?.maxPlayers || 16}
          </span>
        </div>

        {players.length === 0 ? (
          <p className="text-center text-slate-700 text-sm py-6">
            {lang === 'th' ? 'กำลังโหลด...' : 'Loading...'}
          </p>
        ) : (
          <div className="space-y-2">
            {players.map((p, i) => {
              const isMe = p.userId === user._id;
              return (
                <div key={p.userId}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl transition"
                  style={{
                    background:   isMe ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isMe ? 'rgba(124,58,237,0.2)' : 'transparent'}`,
                  }}>
                  <span className="text-slate-600 text-xs w-5 text-center">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {p.username[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium text-white flex-1 truncate">{p.username}</span>
                  {isMe && (
                    <span className="text-xs text-purple-400 flex-shrink-0">
                      {lang === 'th' ? '(คุณ)' : '(You)'}
                    </span>
                  )}
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
