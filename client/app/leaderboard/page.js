'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Trophy, TrendingUp, Swords, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

function EloRankBadge({ elo }) {
  const rank = elo >= 1800 ? { label: 'Diamond', color: '#818cf8' }
    : elo >= 1600 ? { label: 'Platinum', color: '#67e8f9' }
    : elo >= 1400 ? { label: 'Gold', color: '#fbbf24' }
    : elo >= 1200 ? { label: 'Silver', color: '#94a3b8' }
    : { label: 'Bronze', color: '#b45309' };
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: `${rank.color}22`, color: rank.color, border: `1px solid ${rank.color}44` }}>
      {rank.label}
    </span>
  );
}

export default function LeaderboardPage() {
  const { lang, user } = useAuth();
  const [board, setBoard]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [myRank, setMyRank]   = useState(null);

  const load = async () => {
    setLoading(true); setError(false);
    try {
      const data = await api.get('/api/leaderboard?limit=50');
      setBoard(data.leaderboard || []);
      if (user) {
        const idx = (data.leaderboard || []).findIndex(r => r.userId === user._id);
        setMyRank(idx >= 0 ? idx + 1 : null);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const th = lang === 'th';

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Trophy size={20} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">{th ? 'อันดับผู้เล่น' : 'Leaderboard'}</h1>
              <p className="text-xs text-slate-500">{th ? 'เรียงตามคะแนน ELO' : 'Ranked by ELO rating'}</p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {th ? 'รีเฟรช' : 'Refresh'}
          </button>
        </div>

        {/* My rank banner */}
        {user && myRank && (
          <div className="mb-5 p-4 rounded-xl flex items-center gap-3"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-sm text-white font-semibold">
                {th ? `คุณอยู่อันดับที่ ${myRank}` : `You are ranked #${myRank}`}
              </p>
              <p className="text-xs text-slate-500">
                ELO: <span className="text-purple-400 font-bold">{user.elo || 1000}</span>
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">{th ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-sm text-red-400">{th ? 'โหลดข้อมูลไม่ได้' : 'Failed to load'}</p>
            <button onClick={load} className="mt-3 text-xs text-slate-400 hover:text-white underline">{th ? 'ลองใหม่' : 'Retry'}</button>
          </div>
        ) : board.length === 0 ? (
          <div className="text-center py-20">
            <Trophy size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{th ? 'ยังไม่มีผู้เล่นที่แข่งขันแล้ว' : 'No ranked players yet — play some matches!'}</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Top 3 highlight */}
            {board.length >= 3 && (
              <div className="flex items-end justify-center gap-4 p-6 pb-4"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(124,58,237,0.05) 100%)' }}>
                {[1, 0, 2].map((boardIdx) => {
                  const p = board[boardIdx];
                  if (!p) return null;
                  const isCenter = boardIdx === 0;
                  return (
                    <div key={p.userId} className={`flex flex-col items-center gap-2 ${isCenter ? 'order-2 -mb-2' : boardIdx === 1 ? 'order-1' : 'order-3'}`}>
                      <span className="text-3xl">{RANK_LABELS[boardIdx]}</span>
                      <div className={`rounded-full flex items-center justify-center font-black text-white flex-shrink-0 ${isCenter ? 'w-16 h-16 text-xl' : 'w-12 h-12 text-sm'}`}
                        style={{ background: `linear-gradient(135deg, ${RANK_COLORS[boardIdx]}80, ${RANK_COLORS[boardIdx]}40)`, border: `2px solid ${RANK_COLORS[boardIdx]}60` }}>
                        {p.avatar ? <img src={p.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : p.username[0].toUpperCase()}
                      </div>
                      <div className="text-center">
                        <p className={`font-bold text-white truncate max-w-[80px] ${isCenter ? 'text-sm' : 'text-xs'}`}>{p.username}</p>
                        <p className="text-xs font-black" style={{ color: RANK_COLORS[boardIdx] }}>{p.elo}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full list */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {board.map((p) => {
                const isMe = p.userId === user?._id;
                return (
                  <div key={p.userId}
                    className={`flex items-center gap-3 px-4 py-3 transition ${isMe ? 'bg-purple-600/10' : 'hover:bg-white/[0.03]'}`}>
                    {/* Rank */}
                    <div className="w-8 text-center flex-shrink-0">
                      {p.rank <= 3
                        ? <span className="text-lg">{RANK_LABELS[p.rank - 1]}</span>
                        : <span className="text-sm font-bold text-slate-500">#{p.rank}</span>}
                    </div>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                      {p.avatar ? <img src={p.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : p.username[0].toUpperCase()}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>{p.username}</span>
                        {isMe && <span className="text-[9px] bg-purple-600/30 text-purple-300 px-1.5 rounded-full">{th ? 'คุณ' : 'you'}</span>}
                        <EloRankBadge elo={p.elo} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-slate-500">
                          <Swords size={9} className="inline mr-0.5" />{p.totalGames} {th ? 'แมตช์' : 'matches'}
                        </span>
                        <span className="text-[11px] text-emerald-600">{p.winRate}% {th ? 'ชนะ' : 'win'}</span>
                      </div>
                    </div>
                    {/* ELO */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} className="text-emerald-400" />
                        <span className="text-base font-black text-white">{p.elo}</span>
                      </div>
                      <div className="text-[10px] text-slate-600">{p.wins}W {p.losses}L</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-700 mt-6">
          {th ? 'ELO คำนวณจากทุกแมตช์ ทั้ง Quick Match และ Tournament' : 'ELO is calculated from all matches including Quick Match and Tournament'}
        </p>
      </div>
    </main>
  );
}
