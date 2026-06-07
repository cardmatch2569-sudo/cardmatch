'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle } from 'lucide-react';

export default function GlobalChallengeModal() {
  const { getSocket, setGlobalChallengeCallbacks } = useSocket();
  const { lang } = useAuth();
  const router = useRouter();
  const [challenge, setChallenge] = useState(null);

  setGlobalChallengeCallbacks({
    onChallengeReceived: (data) => setChallenge(data),
    onChallengeExpired:  ()     => setChallenge(null),
    onChallengeAccepted: ({ roomId, gameType }) => {
      setChallenge(null);
      if (gameType?._id) sessionStorage.setItem('cg_last_game', gameType._id);
      router.push(`/room/${roomId}`);
    },
  });

  useEffect(() => {
    return () => setGlobalChallengeCallbacks({});
  }, [setGlobalChallengeCallbacks]);

  const respond = (accepted) => {
    getSocket()?.emit('challenge_response', { challengeId: challenge.challengeId, accepted });
    if (!accepted) setChallenge(null);
  };

  if (!challenge) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="anim-scale-in card w-full max-w-sm p-6 md:p-8 text-center"
        style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
        <div className="text-4xl md:text-5xl mb-4">⚔️</div>
        <h2 className="text-xl font-bold text-white mb-2">
          {lang === 'th' ? 'ได้รับคำท้า!' : 'Challenge Received!'}
        </h2>
        <p className="text-slate-400 text-sm mb-1">
          <span className="text-purple-300 font-bold">{challenge.from.username}</span>{' '}
          {lang === 'th' ? 'ท้าคุณเล่น' : 'challenges you to'}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-5 text-sm font-bold"
          style={{
            background: `${challenge.gameType?.color || '#7c3aed'}15`,
            color: challenge.gameType?.color || '#a78bfa',
            border: `1px solid ${challenge.gameType?.color || '#7c3aed'}30`,
          }}>
          🃏 {lang === 'th' ? challenge.gameType?.nameTh : challenge.gameType?.name}
        </div>
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
