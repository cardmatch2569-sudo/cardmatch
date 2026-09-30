'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle } from 'lucide-react';

const CHALLENGE_TTL = 10;

function EloRankBadge({ elo, lang }) {
  const r = elo >= 1700 ? { label: 'Diamond', labelTh: 'เพชร',    color: '#818cf8' }
    : elo >= 1500      ? { label: 'Platinum', labelTh: 'แพลทินัม', color: '#67e8f9' }
    : elo >= 1300      ? { label: 'Gold',     labelTh: 'ทอง',      color: '#fbbf24' }
    : elo >= 1100      ? { label: 'Silver',   labelTh: 'เงิน',     color: '#94a3b8' }
    :                    { label: 'Bronze',   labelTh: 'ทองแดง',   color: '#b45309' };
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}44` }}>
      {lang === 'th' ? r.labelTh : r.label}
    </span>
  );
}

export default function GlobalChallengeModal() {
  const { getSocket, setGlobalChallengeCallbacks } = useSocket();
  const { lang } = useAuth();
  const router = useRouter();
  const [challenge, setChallenge] = useState(null);
  const [countdown, setCountdown] = useState(CHALLENGE_TTL);
  const timerRef = useRef(null);

  const startCountdown = () => {
    setCountdown(CHALLENGE_TTL);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    setGlobalChallengeCallbacks({
      onChallengeReceived: (data) => { setChallenge(data); startCountdown(); },
      onChallengeExpired:  ()     => { setChallenge(null); clearInterval(timerRef.current); },
      onChallengeAccepted: ({ roomId, gameType }) => {
        setChallenge(null);
        clearInterval(timerRef.current);
        if (gameType?._id) sessionStorage.setItem('cg_last_game', gameType._id);
        setTimeout(() => router.push(`/room/${roomId}`), 400);
      },
    });
    return () => { setGlobalChallengeCallbacks({}); clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = (accepted) => {
    getSocket()?.emit('challenge_response', { challengeId: challenge.challengeId, accepted });
    if (!accepted) { setChallenge(null); clearInterval(timerRef.current); }
  };

  if (!challenge) return null;

  const pct = (countdown / CHALLENGE_TTL) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="anim-scale-in card w-full max-w-sm p-6 md:p-8 text-center"
        style={{ borderColor: 'rgba(124,58,237,0.3)' }}>

        {/* Countdown bar */}
        <div className="w-full h-1 rounded-full mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: pct > 50 ? '#a78bfa' : pct > 25 ? '#fbbf24' : '#f87171' }} />
        </div>

        <div className="text-4xl md:text-5xl mb-4">⚔️</div>
        <h2 className="text-xl font-bold text-white mb-2">
          {lang === 'th' ? 'ได้รับคำท้า!' : 'Challenge Received!'}
        </h2>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-purple-300 font-bold">{challenge.from.username}</span>
          <EloRankBadge elo={challenge.from.elo || 1000} lang={lang} />
        </div>
        <p className="text-slate-400 text-sm mb-1">
          {lang === 'th' ? 'ท้าคุณเล่น' : 'challenges you to'}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-2 text-sm font-bold"
          style={{
            background: `${challenge.gameType?.color || '#7c3aed'}15`,
            color: challenge.gameType?.color || '#a78bfa',
            border: `1px solid ${challenge.gameType?.color || '#7c3aed'}30`,
          }}>
          🃏 {lang === 'th' ? challenge.gameType?.nameTh : challenge.gameType?.name}
        </div>
        <p className="text-xs text-slate-600 mb-5">
          {lang === 'th' ? `หมดเวลาใน ${countdown}s` : `Expires in ${countdown}s`}
        </p>
        <div className="flex gap-3">
          <button onClick={() => respond(true)}
            className="btn-primary flex-1 py-3 rounded-xl text-sm gap-1.5">
            <CheckCircle size={15} /> {lang === 'th' ? 'ยอมรับ' : 'Accept'}
          </button>
          <button onClick={() => respond(false)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            <XCircle size={15} /> {lang === 'th' ? 'ปฏิเสธ' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
