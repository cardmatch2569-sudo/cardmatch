'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { api } from '../../../lib/api';
import { Trophy, Users, LogOut, Clock, Loader2, Medal, Play, X, Shield, Bell, Gavel } from 'lucide-react';

// ── Leaderboard ───────────────────────────────────────────────────────
function Leaderboard({ standings, myId, lang }) {
  if (!standings || standings.length === 0) return null;
  return (
    <div className="card p-5 mt-4">
      <h3 className="font-semibold text-white flex items-center gap-2 text-sm mb-3">
        <Medal size={14} className="text-yellow-400" />
        {lang === 'th' ? 'คะแนนสะสม' : 'Standings'}
      </h3>
      <div className="space-y-2">
        {standings.map((p, i) => {
          const isMe = p.userId === myId;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return (
            <div key={p.userId}
              className="flex items-center gap-3 py-2 px-3 rounded-xl"
              style={{
                background: isMe ? 'rgba(124,58,237,0.1)' : i < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: `1px solid ${isMe ? 'rgba(124,58,237,0.25)' : 'transparent'}`,
              }}>
              <span className="text-sm w-6 text-center flex-shrink-0">{medal}</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {p.username[0]?.toUpperCase() || '?'}
              </div>
              <span className={`text-sm flex-1 truncate ${isMe ? 'text-purple-300 font-semibold' : 'text-white'}`}>
                {p.username} {isMe && <span className="text-xs text-purple-500">{lang === 'th' ? '(คุณ)' : '(You)'}</span>}
              </span>
              <span className="text-sm font-bold text-yellow-400 flex-shrink-0">{p.points} <span className="text-xs text-slate-500">pt</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TournamentWaitingRoom() {
  const { id: tournamentId } = useParams();
  const { user, loading: authLoading, lang } = useAuth();
  const { getSocket, connected } = useSocket();
  const router = useRouter();

  const [tournament,  setTournament]  = useState(null);
  const [players,     setPlayers]     = useState([]);
  const [standings,   setStandings]   = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  // status: loading | waiting | round_in_progress | round_complete | bye | tournament_complete | error
  const [status,      setStatus]      = useState('loading');
  const [roundInfo,   setRoundInfo]   = useState(null); // { roundNumber, totalRounds }
  const [errorMsg,    setErrorMsg]    = useState('');
  const leftRef = useRef(false);
  const [alerts,      setAlerts]      = useState([]);
  const [decideMatch, setDecideMatch] = useState(null);
  const [toast,       setToast]       = useState('');
  const langRef     = useRef(lang);
  const hasJoinedRef = useRef(false);
  langRef.current = lang;

  const load = useCallback(async () => {
    try {
      const { tournament: t } = await api.get(`/api/tournament/${tournamentId}`);
      setTournament(t);
      if (t.playersInfo) setPlayers(t.playersInfo);
      // Build standings from playersInfo (sorted by points)
      if (t.playersInfo) setStandings([...t.playersInfo].sort((a, b) => b.points - a.points));
      return t;
    } catch {
      setErrorMsg(langRef.current === 'th' ? 'ไม่พบ Tournament นี้' : 'Tournament not found');
      setStatus('error');
      return null;
    }
  }, [tournamentId]);

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

      if (t.status === 'ended') { setStatus('tournament_complete'); return; }

      // Set initial status from API immediately (don't wait for socket)
      if      (t.status === 'active')         setStatus('round_in_progress');
      else if (t.status === 'round_complete') setStatus('round_complete');
      else                                    setStatus('waiting');

      if (user.isAdmin) {
        socket.emit('admin_join_tournament_watch', { tournamentId });
      } else {
        socket.emit('join_tournament', { tournamentId });
      }
      hasJoinedRef.current = true;
    };

    // ── Socket listeners ────────────────────────────────────────────
    const onJoinedOk = ({ playersInfo, tournament: td, standings: s }) => {
      if (!mounted) return;
      if (playersInfo) setPlayers(playersInfo);
      if (td)         setTournament(prev => ({ ...prev, ...td }));
      if (s)          setStandings(s);

      const sts = td?.status || 'waiting';
      if (sts === 'waiting')        setStatus('waiting');
      else if (sts === 'active')    setStatus('round_in_progress');
      else if (sts === 'round_complete') setStatus('round_complete');
      else if (sts === 'ended')     setStatus('tournament_complete');
    };

    const onPlayerUpdate = ({ tournamentId: tid, playersInfo }) => {
      if (!mounted || tid !== tournamentId) return;
      if (playersInfo) setPlayers(playersInfo);
    };

    const onRoundStarted = ({ tournamentId: tid, roundNumber, totalRounds }) => {
      if (!mounted || tid !== tournamentId) return;
      setRoundInfo({ roundNumber, totalRounds });
      setTournament(prev => prev ? { ...prev, currentRound: roundNumber, totalRounds, status: 'active' } : prev);
      setStatus('round_in_progress');
    };

    const onRoundComplete = ({ tournamentId: tid, roundNumber, totalRounds, standings: s }) => {
      if (!mounted || tid !== tournamentId) return;
      if (s) setStandings(s);
      setRoundInfo({ roundNumber, totalRounds });
      setTournament(prev => prev ? { ...prev, currentRound: roundNumber, status: 'round_complete', activeMatchCount: 0 } : prev);
      setStatus('round_complete');
    };

    const onTournamentComplete = ({ tournamentId: tid, standings: s }) => {
      if (!mounted || tid !== tournamentId) return;
      if (s) setStandings(s);
      setStatus('tournament_complete');
    };

    const onClosed = ({ tournamentId: tid }) => {
      if (!mounted || tid !== tournamentId) return;
      setStatus('error');
      setErrorMsg(langRef.current === 'th' ? 'Admin ปิด Tournament แล้ว' : 'Tournament was closed');
    };

    const onMatchFound = ({ roomId, isTournament, tournamentId: tid, matchId, gameType, roundNumber }) => {
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

    const onBye = ({ message, roundNumber }) => {
      if (!mounted) return;
      setRoundInfo(prev => prev ? prev : { roundNumber, totalRounds: tournament?.totalRounds });
      setStatus('bye');
    };

    const onError = ({ message }) => {
      if (!mounted) return;
      setToast(message);
      setTimeout(() => setToast(''), 5000);
    };

    let onAdminAlert = null;
    if (user?.isAdmin) {
      onAdminAlert = (data) => {
        const alertId = Date.now() + Math.random();
        setAlerts(p => [{ id: alertId, ...data }, ...p.slice(0, 9)]);
        setTimeout(() => setAlerts(p => p.filter(a => a.id !== alertId)), 30000);
      };
      socket.on('admin_match_alert', onAdminAlert);
    }

    socket.on('tournament_joined_ok',    onJoinedOk);
    socket.on('tournament_player_update', onPlayerUpdate);
    socket.on('round_started',           onRoundStarted);
    socket.on('round_complete',          onRoundComplete);
    socket.on('tournament_complete',     onTournamentComplete);
    socket.on('tournament_closed',       onClosed);
    socket.on('match_found',             onMatchFound);
    socket.on('tournament_bye',          onBye);
    socket.on('tournament_error',        onError);

    init();

    return () => {
      mounted = false;
      socket.off('tournament_joined_ok',    onJoinedOk);
      socket.off('tournament_player_update', onPlayerUpdate);
      socket.off('round_started',           onRoundStarted);
      socket.off('round_complete',          onRoundComplete);
      socket.off('tournament_complete',     onTournamentComplete);
      socket.off('tournament_closed',       onClosed);
      socket.off('match_found',             onMatchFound);
      socket.off('tournament_bye',          onBye);
      socket.off('tournament_error',        onError);
      if (onAdminAlert) socket.off('admin_match_alert', onAdminAlert);
      if (user?.isAdmin) {
        socket.emit('admin_leave_tournament_watch', { tournamentId });
      } else if (!leftRef.current) {
        socket.emit('leave_tournament', { tournamentId });
      }
    };
  }, [authLoading, user, tournamentId, router, getSocket, load]);

  // Re-join tournament room when socket reconnects (handles mobile screen-sleep disconnect)
  useEffect(() => {
    if (!connected || !hasJoinedRef.current || authLoading || !user) return;
    const socket = getSocket();
    if (!socket) return;
    if (user.isAdmin) {
      socket.emit('admin_join_tournament_watch', { tournamentId });
    } else {
      socket.emit('join_tournament', { tournamentId });
    }
  }, [connected, tournamentId, user, authLoading, getSocket]);

  const handleLeave = () => {
    if (user?.isAdmin) { router.push('/tournament'); return; }
    leftRef.current = true;
    getSocket()?.emit('leave_tournament', { tournamentId });
    router.push('/tournament');
  };

  const handleStartRound = () => {
    getSocket()?.emit('start_round', { tournamentId });
  };

  const handleCloseTourney = () => {
    if (!confirm(lang === 'th' ? 'ปิด Tournament นี้?' : 'Close this tournament?')) return;
    getSocket()?.emit('close_tournament', { tournamentId });
  };

  const handleDecideMatch = (winnerId) => {
    if (!decideMatch) return;
    getSocket()?.emit('admin_decide_match', { roomId: decideMatch.roomId, winnerId });
    setDecideMatch(null);
    setAlerts(p => p.filter(a => a.roomId !== decideMatch.roomId));
  };

  const dismissAlert = (id) => setAlerts(p => p.filter(a => a.id !== id));

  if (authLoading || pageLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-white font-bold mb-4">{errorMsg || (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'Error')}</p>
        <button onClick={() => router.push('/tournament')} className="btn-ghost px-6 py-2.5 rounded-xl text-sm">
          {lang === 'th' ? 'กลับ' : 'Back'}
        </button>
      </div>
    </div>
  );

  if (status === 'tournament_complete') return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="card p-8 text-center mb-4" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-white font-bold text-2xl mb-1">
          {lang === 'th' ? 'Tournament จบแล้ว!' : 'Tournament Complete!'}
        </h1>
        <p className="text-slate-500 text-sm">
          {tournament?.name} · {tournament?.totalRounds} {lang === 'th' ? 'รอบ' : 'rounds'}
        </p>
      </div>
      <Leaderboard standings={standings} myId={user?._id} lang={lang} />
      <button onClick={() => router.push('/lobby')} className="btn-ghost w-full py-3 rounded-xl text-sm mt-4">
        {lang === 'th' ? 'กลับ Lobby' : 'Back to Lobby'}
      </button>
    </div>
  );

  const t = tournament;
  const currentRound = roundInfo?.roundNumber ?? t?.currentRound ?? 0;
  const totalRounds  = roundInfo?.totalRounds  ?? t?.totalRounds  ?? 3;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">

      {/* ── Toast notification ──────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'rgba(239,68,68,0.9)', border: '1px solid rgba(239,68,68,0.6)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}>
          ⚠️ {toast}
        </div>
      )}

      {/* ── Admin Decide Match Modal ─────────────────────────────── */}
      {decideMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="card w-full max-w-sm p-6 text-center"
            style={{ background: 'rgba(15,10,20,0.99)', borderColor: 'rgba(251,191,36,0.3)' }}>
            <div className="text-4xl mb-3">⚖️</div>
            <h2 className="text-white font-bold text-lg mb-2">
              {lang === 'th' ? 'ตัดสินผลการแข่ง' : 'Decide Match Result'}
            </h2>
            <p className="text-slate-500 text-sm mb-5">{lang === 'th' ? 'เลือกผู้ชนะ' : 'Select the winner'}</p>
            <div className="flex gap-3 justify-center mb-4">
              {decideMatch.players.map((pid, i) => (
                <button key={pid} onClick={() => handleDecideMatch(pid)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition active:scale-95"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                  🏆 {decideMatch.names[i] || `P${i + 1}`}
                </button>
              ))}
            </div>
            <button onClick={() => setDecideMatch(null)} className="btn-ghost w-full py-2 rounded-xl text-xs">
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* ── Admin Control Panel ──────────────────────────────────── */}
      {user?.isAdmin && (
        <div className="space-y-2 mb-4">
          <div className="card p-4" style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.03)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                <Shield size={12} /> Admin
              </span>
              <div className="flex gap-2 flex-wrap">
                {['waiting', 'round_complete'].includes(status) && (t?.currentRound || 0) < (t?.totalRounds || 3) && (
                  <button
                    onClick={handleStartRound}
                    disabled={players.length < 2 || (t?.activeMatchCount || 0) > 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                    <Play size={11} />
                    {lang === 'th'
                      ? `เริ่มรอบ ${(t?.currentRound || 0) + 1}/${t?.totalRounds || 3}`
                      : `Round ${(t?.currentRound || 0) + 1}/${t?.totalRounds || 3}`}
                  </button>
                )}
                <button
                  onClick={handleCloseTourney}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <X size={11} /> {lang === 'th' ? 'ปิด Tournament' : 'Close Tournament'}
                </button>
              </div>
            </div>
            {players.length < 2 && status === 'waiting' && (
              <p className="text-xs text-slate-600 mt-2">
                {lang === 'th' ? 'ต้องการผู้เล่นอย่างน้อย 2 คนเพื่อเริ่ม' : 'Need at least 2 players to start'}
              </p>
            )}
          </div>

          {alerts.map(a => (
            <div key={a.id} className="card p-3 flex items-start gap-3"
              style={{ borderColor: a.type === 'conflict' || a.type === 'timeout' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)' }}>
              <Bell size={14} className={a.type === 'conflict' || a.type === 'timeout' ? 'text-red-400 flex-shrink-0 mt-0.5' : 'text-yellow-400 flex-shrink-0 mt-0.5'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">
                  {a.type === 'call'     && '📣 ผู้เล่นเรียก Admin'}
                  {a.type === 'conflict' && '⚠️ ผลไม่ตรงกัน — ต้องตัดสิน'}
                  {a.type === 'timeout'  && '⏰ หมดเวลา — ต้องตัดสิน'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">Room: {a.roomId?.slice(0, 12)}...</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {(a.type === 'conflict' || a.type === 'timeout') && a.roomId && (
                  <button
                    onClick={() => setDecideMatch({ roomId: a.roomId, players: a.players || [], names: a.playerNames || a.players?.map((_, i) => `P${i+1}`) || [] })}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <Gavel size={10} /> {lang === 'th' ? 'ตัดสิน' : 'Decide'}
                  </button>
                )}
                <button onClick={() => dismissAlert(a.id)} className="text-slate-600 hover:text-slate-400 p-0.5">
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="card p-5 mb-4"
        style={{ borderColor: status === 'round_in_progress' ? 'rgba(251,191,36,0.25)' : 'rgba(124,58,237,0.2)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-base leading-tight truncate">{t?.name || 'Tournament'}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'th' ? 'รอบที่' : 'Round'}{' '}
              <span className="text-white font-semibold">{currentRound}</span>
              {' '}/{' '}{totalRounds}
              {' · '}{players.length} {lang === 'th' ? 'ผู้เล่น' : 'players'}
            </p>
          </div>
          <button onClick={handleLeave}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-red-400 flex-shrink-0 transition hover:bg-red-500/10"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <LogOut size={13} /> {lang === 'th' ? 'ออก' : 'Leave'}
          </button>
        </div>

        {/* Status banner */}
        {status === 'waiting' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <Clock size={14} className="text-yellow-400 animate-pulse flex-shrink-0" />
            <p className="text-sm text-yellow-300">{lang === 'th' ? 'รอ Admin กดเริ่มรอบที่ 1' : 'Waiting for Admin to start Round 1'}</p>
          </div>
        )}

        {status === 'round_in_progress' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <p className="text-sm text-green-300">
              {lang === 'th' ? `กำลังแข่งรอบที่ ${currentRound} — รอผลจากห้องแข่ง` : `Round ${currentRound} in progress — awaiting results`}
            </p>
          </div>
        )}

        {status === 'round_complete' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <Trophy size={14} className="text-purple-400 flex-shrink-0" />
            <p className="text-sm text-purple-300">
              {lang === 'th'
                ? `รอบที่ ${currentRound} จบแล้ว — รอ Admin เริ่มรอบที่ ${currentRound + 1}`
                : `Round ${currentRound} done — waiting for Admin to start Round ${currentRound + 1}`}
            </p>
          </div>
        )}

        {status === 'bye' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <span className="text-lg">😴</span>
            <p className="text-sm text-yellow-300">
              {lang === 'th' ? `คุณได้รับ BYE รอบที่ ${currentRound} — รอรอบถัดไป` : `BYE this round — wait for next round`}
            </p>
          </div>
        )}
      </div>

      {/* Round progress bar */}
      {totalRounds > 0 && (
        <div className="card px-5 py-3 mb-4 flex items-center gap-3">
          <span className="text-xs text-slate-600 flex-shrink-0">{lang === 'th' ? 'ความคืบหน้า' : 'Progress'}</span>
          <div className="flex gap-1 flex-1">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div key={i} className="flex-1 h-2 rounded-full transition-colors"
                style={{
                  background: (i === currentRound - 1 && status === 'round_in_progress')
                    ? 'rgba(251,191,36,0.7)'
                    : i < currentRound
                      ? 'rgba(74,222,128,0.7)'
                      : 'rgba(255,255,255,0.08)',
                }} />
            ))}
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0">{currentRound}/{totalRounds}</span>
        </div>
      )}

      {/* Leaderboard (shown once any round has happened) */}
      {currentRound > 0 && standings.length > 0 && (
        <Leaderboard standings={standings} myId={user?._id} lang={lang} />
      )}

      {/* Players list (shown during waiting phase) */}
      {status === 'waiting' && (
        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
              <Users size={14} className="text-purple-400" />
              {lang === 'th' ? 'ผู้เข้าร่วม' : 'Players'}
            </h3>
            <span className="text-xs text-slate-600">{players.length}/{t?.maxPlayers || 8}</span>
          </div>
          {players.length === 0 ? (
            <p className="text-center text-slate-700 text-sm py-4">{lang === 'th' ? 'รอผู้เล่น...' : 'Waiting for players...'}</p>
          ) : (
            <div className="space-y-2">
              {players.map((p, i) => {
                const isMe = p.userId === user._id;
                return (
                  <div key={p.userId}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl transition"
                    style={{
                      background: isMe ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isMe ? 'rgba(124,58,237,0.2)' : 'transparent'}`,
                    }}>
                    <span className="text-slate-600 text-xs w-5 text-center">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.username[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-white flex-1 truncate">{p.username}</span>
                    {isMe && <span className="text-xs text-purple-400 flex-shrink-0">{lang === 'th' ? '(คุณ)' : '(You)'}</span>}
                    <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
