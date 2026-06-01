'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import translations from '../../lib/translations';
import { Trophy, Gamepad2, Target, Shield, Calendar, Mail, Copy, Check } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading, lang, setUser } = useAuth();
  const router = useRouter();
  const t = translations[lang];
  const [games, setGames]           = useState([]);
  const [copied, setCopied]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const copyPlayerId = () => {
    if (!user.playerId) return;
    navigator.clipboard.writeText(user.playerId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Re-fetch user to get newly-generated player_id (for existing accounts)
  const refreshUser = async () => {
    setRefreshing(true);
    try {
      const { user: fresh } = await api.get('/api/auth/me');
      if (fresh && setUser) setUser(fresh);
    } catch {}
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (user) {
      api.get('/api/games').then(({ games }) => setGames(games)).catch(() => {});
      // Auto-refresh if player_id is missing (server will generate it)
      if (!user.playerId) refreshUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?._id, router]);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const winRate = user.stats?.totalGames
    ? Math.round((user.stats.wins / user.stats.totalGames) * 100) : 0;

  const stats = [
    { label: lang === 'th' ? 'เกมทั้งหมด' : 'Total Games', value: user.stats?.totalGames || 0, icon: <Gamepad2 size={16} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
    { label: lang === 'th' ? 'ชนะ' : 'Wins',               value: user.stats?.wins || 0,       icon: <Trophy size={16} />,   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' },
    { label: lang === 'th' ? 'อัตราชนะ' : 'Win Rate',      value: `${winRate}%`,               icon: <Target size={16} />,   color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Profile card */}
      <div className="card overflow-hidden mb-5">
        {/* Cover gradient */}
        <div className="h-24 bg-gradient-to-r from-purple-900/60 via-violet-900/40 to-purple-800/60 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==')] opacity-50" />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-purple-900/50 border-4 flex-shrink-0"
              style={{ borderColor: 'var(--card)' }}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{user.username}</h1>
                {user.isAdmin && (
                  <span className="badge badge-yellow gap-1">
                    <Shield size={9} /> Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Player ID badge */}
          <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 mb-0.5">{t.myPlayerId}</p>
              {user.playerId
                ? <p className="text-purple-300 font-mono font-bold tracking-widest text-base">{user.playerId}</p>
                : <p className="text-slate-600 text-xs">{lang === 'th' ? 'กำลังสร้าง ID...' : 'Generating ID...'}</p>
              }
            </div>
            {user.playerId ? (
              <button onClick={copyPlayerId}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex-shrink-0"
                style={{ background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(124,58,237,0.15)', color: copied ? '#4ade80' : '#a78bfa' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? t.copied : lang === 'th' ? 'คัดลอก' : 'Copy'}
              </button>
            ) : (
              <button onClick={refreshUser} disabled={refreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                {refreshing
                  ? <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                  : <span>{lang === 'th' ? 'รีเฟรช' : 'Refresh'}</span>}
              </button>
            )}
          </div>

          {/* Info rows */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail size={13} />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={13} />
              <span>
                {lang === 'th' ? 'เป็นสมาชิกตั้งแต่ ' : 'Member since '}
                {new Date(user.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {stats.map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4 text-center card-hover" style={{ borderColor: border }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
              style={{ background: bg, border: `1px solid ${border}`, color }}>
              {icon}
            </div>
            <div className="text-2xl font-black text-white mb-0.5">{value}</div>
            <div className="text-xs text-slate-600">{label}</div>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      {user.stats?.totalGames > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400 font-medium">{lang === 'th' ? 'อัตราชนะ' : 'Win Rate'}</span>
            <span className="text-white font-bold">{winRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-700 mt-1.5">
            <span>{user.stats.wins} {lang === 'th' ? 'ชนะ' : 'wins'}</span>
            <span>{user.stats.losses} {lang === 'th' ? 'แพ้' : 'losses'}</span>
          </div>
        </div>
      )}

      {/* Available games */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-widest">
          {lang === 'th' ? 'เกมที่รองรับ' : 'Available Games'}
        </h2>
        <div className="space-y-2">
          {games.map((game) => (
            <div key={game._id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--border-2)] transition"
              style={{ background: 'var(--bg-2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${game.color}12`, border: `1px solid ${game.color}25` }}>
                🃏
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{lang === 'th' ? game.nameTh : game.name}</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ background: game.color }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
