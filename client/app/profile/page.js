'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import translations from '../../lib/translations';
import { Trophy, Gamepad2, Target, Shield, Calendar, Mail, Copy, Check, Trash2, Lock, Eye, EyeOff, Swords } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading, lang, setUser } = useAuth();
  const router = useRouter();
  const t = translations[lang];
  const [games, setGames]             = useState([]);
  const [gamesError, setGamesError]   = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [historyError, setHistoryError] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePass, setDeletePass]   = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting]       = useState(false);
  const [showDelPass, setShowDelPass] = useState(false);
  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPass,      setCurPass]      = useState('');
  const [newPass,      setNewPass]      = useState('');
  const [newPassConf,  setNewPassConf]  = useState('');
  const [showCurPass,  setShowCurPass]  = useState(false);
  const [showNewPass,  setShowNewPass]  = useState(false);
  const [pwError,      setPwError]      = useState('');
  const [pwSuccess,    setPwSuccess]    = useState('');
  const [pwSaving,     setPwSaving]     = useState(false);
  // Prevent retrying if the endpoint is not yet available
  const pidTriedRef = useRef(false);
  const [pidGenError, setPidGenError] = useState(false);
  const [hideOpponents, setHideOpponents] = useState(false);

  const copyPlayerId = () => {
    if (!user.playerId) return;
    navigator.clipboard.writeText(user.playerId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Generate player_id via dedicated endpoint (once per session)
  const changePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (newPass !== newPassConf) return setPwError(lang === 'th' ? 'รหัสผ่านใหม่ไม่ตรงกัน' : 'Passwords do not match');
    if (newPass.length < 6) return setPwError(lang === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Min 6 characters');
    setPwSaving(true);
    try {
      const { message } = await api.put('/api/users/me/password', { currentPassword: curPass, newPassword: newPass });
      setPwSuccess(message);
      setCurPass(''); setNewPass(''); setNewPassConf('');
      setTimeout(() => { setShowChangePw(false); setPwSuccess(''); }, 2000);
    } catch (err) { setPwError(err.message); }
    finally { setPwSaving(false); }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/api/users/me', { password: deletePass });
      // Log out and redirect
      localStorage.removeItem('cg_token');
      sessionStorage.removeItem('cg_token');
      router.push('/');
    } catch (err) {
      const isGoogle = !user.hasPassword;
      setDeleteError(err.message || (lang === 'th'
        ? (isGoogle ? 'อีเมลไม่ถูกต้อง' : 'รหัสผ่านไม่ถูกต้อง')
        : (isGoogle ? 'Wrong email' : 'Wrong password')));
    } finally { setDeleting(false); }
  };

  const refreshUser = async () => {
    if (pidTriedRef.current) return;
    setRefreshing(true);
    try {
      const { user: fresh } = await api.post('/api/users/generate-player-id', {});
      if (fresh?._id && setUser) { pidTriedRef.current = true; setUser(fresh); }
    } catch { setPidGenError(true); }
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (user) {
      api.get('/api/games').then(({ games }) => setGames(games)).catch(() => setGamesError(true));
      api.get('/api/users/me/history')
        .then(({ matches }) => setMatchHistory(matches || []))
        .catch(() => setHistoryError(true));
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
              <p className="text-[10px] text-slate-500 mb-0.5">
                {t.myPlayerId}
                <span className="ml-1 text-slate-700">
                  {lang === 'th' ? '— แชร์เฉพาะกับคนที่ต้องการท้า' : '— share only with players you want to challenge'}
                </span>
              </p>
              {user.playerId
                ? <p className="text-purple-300 font-mono font-bold tracking-widest text-base">{user.playerId}</p>
                : pidGenError
                  ? <p className="text-red-400 text-xs">{lang === 'th' ? 'สร้าง ID ล้มเหลว — ลองใหม่' : 'Failed to generate — tap Retry'}</p>
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
              <button onClick={() => { setPidGenError(false); pidTriedRef.current = false; refreshUser(); }} disabled={refreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex-shrink-0 disabled:opacity-50"
                style={{ background: pidGenError ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.15)', color: pidGenError ? '#f87171' : '#a78bfa' }}>
                {refreshing
                  ? <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                  : <span>{pidGenError ? (lang === 'th' ? 'ลองใหม่' : 'Retry') : (lang === 'th' ? 'รีเฟรช' : 'Refresh')}</span>}
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

      {/* ── Stats by game type ──────────────────────────────────── */}
      {matchHistory.length > 0 && (() => {
        const byGame = {};
        matchHistory.forEach(m => {
          const key = m.game_name || '?';
          if (!byGame[key]) byGame[key] = { name: m.game_name || '?', nameTh: m.game_name_th || m.game_name || '?', color: m.game_color || '#7c3aed', total: 0, wins: 0 };
          byGame[key].total++;
          if (m.outcome === 'win') byGame[key].wins++;
        });
        const rows = Object.values(byGame);
        if (rows.length < 2) return null;
        return (
          <div className="card p-5 mb-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-widest">
              {lang === 'th' ? 'สถิติแยกตามเกม' : 'Stats by Game'}
            </h2>
            <div className="space-y-3">
              {rows.map(g => {
                const wr = g.total ? Math.round((g.wins / g.total) * 100) : 0;
                return (
                  <div key={g.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                        <span className="text-slate-300 font-medium">{lang === 'th' ? g.nameTh : g.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>{g.wins}W/{g.total - g.wins}L</span>
                        <span className="text-white font-bold">{wr}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${wr}%`, background: g.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Available games */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-widest">
          {lang === 'th' ? 'เกมที่รองรับ' : 'Available Games'}
        </h2>
        <div className="space-y-2">
          {gamesError && (
            <p className="text-red-400 text-sm text-center py-2">{t.failedToLoad}</p>
          )}
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

      {/* ── Match History ───────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Swords size={15} className="text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex-1">
            {lang === 'th' ? 'ประวัติการแข่ง' : 'Match History'}
          </h2>
          {matchHistory.length > 0 && (
            <button onClick={() => setHideOpponents(p => !p)}
              className="text-xs text-slate-600 hover:text-slate-400 transition px-2 py-1 rounded-lg hover:bg-white/5"
              title={hideOpponents ? (lang === 'th' ? 'แสดงชื่อคู่แข่ง' : 'Show opponents') : (lang === 'th' ? 'ซ่อนชื่อคู่แข่ง' : 'Hide opponents')}>
              {hideOpponents ? '👁' : '🙈'} {lang === 'th' ? (hideOpponents ? 'แสดง' : 'ซ่อน') : (hideOpponents ? 'Show' : 'Hide')}
            </button>
          )}
        </div>
        {historyError ? (
          <p className="text-red-400 text-sm text-center py-4">{t.failedToLoad}</p>
        ) : matchHistory.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            {lang === 'th' ? 'ยังไม่มีประวัติการแข่ง' : 'No matches yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {matchHistory.map((m) => {
              const date = m.ended_at ? new Date(m.ended_at) : new Date(m.created_at);
              const dateStr = date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });
              return (
                <div key={m.room_id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--border-2)] transition"
                  style={{ background: 'var(--bg-2)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: m.game_color ? `${m.game_color}18` : 'rgba(124,58,237,0.12)', border: `1px solid ${m.game_color || '#7c3aed'}25` }}>
                    🃏
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {lang === 'th' ? (m.game_name_th || m.game_name || '?') : (m.game_name || '?')}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      vs {hideOpponents ? '???' : (m.opponent_username || '—')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.outcome === 'win' && (
                      <span className="badge badge-green text-[10px]">{lang === 'th' ? 'ชนะ' : 'Win'}</span>
                    )}
                    {m.outcome === 'lose' && (
                      <span className="badge badge-red text-[10px]">{lang === 'th' ? 'แพ้' : 'Lose'}</span>
                    )}
                    <div className="text-xs text-slate-600">{dateStr}</div>
                  </div>
                </div>
              );
            })}
            {matchHistory.length >= 20 && (
              <p className="text-[11px] text-slate-600 text-center pt-1">
                {lang === 'th' ? '· แสดง 20 รายการล่าสุด ·' : '· Showing last 20 matches ·'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Change Password ─────────────────────────────────────── */}
      {user.hasPassword && (
        <div className="pb-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  {lang === 'th' ? 'เปลี่ยนรหัสผ่าน' : 'Change Password'}
                </h3>
              </div>
              <button onClick={() => { setShowChangePw(p => !p); setPwError(''); setPwSuccess(''); setCurPass(''); setNewPass(''); setNewPassConf(''); }}
                className="text-xs text-slate-500 hover:text-purple-400 transition px-2 py-1 rounded-lg hover:bg-purple-500/10">
                {showChangePw ? (lang === 'th' ? 'ยกเลิก' : 'Cancel') : (lang === 'th' ? 'เปลี่ยน' : 'Change')}
              </button>
            </div>

            {showChangePw && (
              <div className="space-y-3">
                {pwSuccess && (
                  <div className="px-3 py-2 rounded-xl text-xs text-green-400" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    ✓ {pwSuccess}
                  </div>
                )}
                {/* Current password */}
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input type={showCurPass ? 'text' : 'password'}
                    value={curPass} onChange={e => { setCurPass(e.target.value); setPwError(''); }}
                    placeholder={lang === 'th' ? 'รหัสผ่านปัจจุบัน' : 'Current password'}
                    className="input-base pl-9 pr-10 text-sm" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowCurPass(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 flex items-center justify-center"
                    style={{ width: 36, height: 36 }}>
                    {showCurPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* New password */}
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input type={showNewPass ? 'text' : 'password'}
                    value={newPass} onChange={e => { setNewPass(e.target.value); setPwError(''); }}
                    placeholder={lang === 'th' ? 'รหัสผ่านใหม่ (6+ ตัว)' : 'New password (6+)'}
                    className="input-base pl-9 pr-10 text-sm" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowNewPass(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 flex items-center justify-center"
                    style={{ width: 36, height: 36 }}>
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Confirm */}
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input type={showNewPass ? 'text' : 'password'}
                    value={newPassConf} onChange={e => { setNewPassConf(e.target.value); setPwError(''); }}
                    placeholder={lang === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'}
                    className={`input-base pl-9 text-sm ${newPassConf && newPass !== newPassConf ? 'border-red-500/60' : newPassConf && newPass === newPassConf ? 'border-green-500/60' : ''}`}
                    autoComplete="new-password" />
                </div>
                {pwError && <p className="text-xs text-red-400">⚠ {pwError}</p>}
                <button onClick={changePassword}
                  disabled={pwSaving || !curPass || !newPass || !newPassConf}
                  className="btn-primary w-full py-2.5 rounded-xl text-sm disabled:opacity-40">
                  {pwSaving
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                    : (lang === 'th' ? '🔐 บันทึกรหัสผ่านใหม่' : '🔐 Save New Password')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="pb-10">
        <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <h3 className="text-sm font-bold text-red-400 mb-1">
            {lang === 'th' ? '⚠️ โซนอันตราย' : '⚠️ Danger Zone'}
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            {lang === 'th'
              ? 'การลบบัญชีจะลบข้อมูลทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้ (สิทธิ์ตาม PDPA มาตรา 33)'
              : 'Deleting your account permanently removes all data and cannot be undone (PDPA Article 33 right)'}
          </p>
          <button onClick={() => { setShowDeleteModal(true); setDeletePass(''); setDeleteError(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Trash2 size={13} /> {lang === 'th' ? 'ลบบัญชีของฉัน' : 'Delete my account'}
          </button>
        </div>
      </div>

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(14px)' }}>
          <div className="anim-scale-in card w-full max-w-sm p-6"
            style={{ background: 'rgba(15,10,20,0.99)', borderColor: 'rgba(239,68,68,0.35)' }}>
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent mb-5" />
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-lg font-bold text-white mb-1">
                {lang === 'th' ? 'ลบบัญชีถาวร?' : 'Delete Account?'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'th'
                  ? 'ข้อมูลทั้งหมดจะถูกลบอย่างถาวร รวมถึงโปรไฟล์ สถิติ และประวัติการแข่งขัน'
                  : 'All data will be permanently deleted including profile, stats, and match history'}
              </p>
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-2">
                {lang === 'th'
                  ? !user.hasPassword
                    ? '📧 ยืนยันด้วยอีเมลของคุณ'
                    : '🔐 ยืนยันด้วยรหัสผ่านของคุณ'
                  : !user.hasPassword
                    ? '📧 Confirm with your email address'
                    : '🔐 Confirm with your password'}
              </label>
              {!user.hasPassword ? (
                <div className="relative">
                  <input type="email"
                    value={deletePass}
                    onChange={e => { setDeletePass(e.target.value); setDeleteError(''); }}
                    onKeyDown={e => e.key === 'Enter' && deletePass && deleteAccount()}
                    placeholder={user.email || (lang === 'th' ? 'อีเมลของคุณ' : 'Your email')}
                    className="input-base pl-4 text-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input type={showDelPass ? 'text' : 'password'}
                    value={deletePass}
                    onChange={e => { setDeletePass(e.target.value); setDeleteError(''); }}
                    onKeyDown={e => e.key === 'Enter' && deletePass && deleteAccount()}
                    placeholder={lang === 'th' ? 'รหัสผ่านของคุณ' : 'Your password'}
                    className="input-base pl-9 pr-10 text-sm"
                    autoFocus
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowDelPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 p-1">
                    {showDelPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}
              {deleteError && <p className="text-red-400 text-xs mt-1.5">⚠ {deleteError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={deleteAccount}
                disabled={deleting || !deletePass}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.85)', color: 'white' }}>
                {deleting
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                  : (lang === 'th' ? '🗑 ลบถาวร' : '🗑 Delete permanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
