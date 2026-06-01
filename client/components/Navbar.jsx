'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import translations from '../lib/translations';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, LogOut, Shield, Globe, Swords, Eye, EyeOff, Settings, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, lang, loading, isAdminMode, viewMode, toggleViewMode, logout, toggleLang } = useAuth();
  const { onlineCount, connected } = useSocket();
  const router   = useRouter();
  const pathname = usePathname();
  const t = translations[lang];

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Room page has its own full-screen UI — hide Navbar completely
  if (pathname?.startsWith('/room/')) return null;

  const handleLogout = () => { logout(); router.push('/'); setMobileOpen(false); };
  const isActive = (href) => pathname === href;
  const close = () => setMobileOpen(false);

  const navLinks = [
    { href: '/lobby', label: t.lobby,                       icon: <Swords size={15} />,   always: true },
    { href: '/setup', label: lang === 'th' ? 'ทดสอบ' : 'Setup', icon: <Settings size={15} />, always: true },
    ...(isAdminMode ? [{ href: '/admin', label: t.admin, icon: <Shield size={15} />, admin: true }] : []),
  ];

  return (
    <>
      {/* ── Main nav bar ─────────────────────────────────────── */}
      {/* height accounts for iPhone notch via --safe-top */}
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ height: 'var(--navbar-h, 4rem)' }}>
        <div className="absolute inset-0 glass border-b border-white/[0.06]" />
        <div className="relative max-w-7xl mx-auto px-4 flex items-end justify-between gap-3 pb-3"
          style={{ height: '100%', paddingTop: 'calc(var(--safe-top, 0px) + 0.5rem)' }}>

          {/* Logo */}
          <Link href="/" onClick={close} className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-sm shadow-lg shadow-purple-900/40 transition-transform group-hover:scale-105">
              🃏
            </div>
            <span className="font-bold text-base md:text-lg tracking-tight text-white group-hover:text-purple-300 transition-colors">
              Card<span className="text-purple-400">Match</span>
            </span>
          </Link>

          {/* Desktop center nav */}
          {user && (
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {navLinks.map(({ href, label, icon, admin }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${isActive(href)
                      ? admin
                        ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/20'
                        : 'bg-purple-600/20 text-purple-300 border border-purple-600/20'
                      : admin
                        ? 'text-yellow-500 hover:text-yellow-300 hover:bg-yellow-500/5'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {icon}{label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-1.5 flex-shrink-0">

            {/* Online count / connecting status — desktop only */}
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-[var(--card)]"
                style={{ borderColor: connected ? 'var(--border)' : 'rgba(251,191,36,0.3)', color: connected ? '#64748b' : '#fbbf24' }}>
                {connected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <Users size={11} /><span>{onlineCount}</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                    <span>{lang === 'th' ? 'เชื่อมต่อ...' : 'Connecting'}</span>
                  </>
                )}
              </div>
            )}

            {/* Admin view toggle — desktop */}
            {user?.isAdmin && (
              <button onClick={toggleViewMode}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border
                  ${viewMode === 'admin'
                    ? 'text-yellow-400 border-yellow-600/20 bg-yellow-500/5 hover:bg-yellow-500/10'
                    : 'text-purple-300 border-purple-600/30 bg-purple-600/10 hover:bg-purple-600/15'}`}>
                {viewMode === 'admin' ? <><Eye size={12} />{lang === 'th' ? 'ดูผู้ใช้' : 'User'}</> : <><EyeOff size={12} />Admin</>}
              </button>
            )}

            {/* Language toggle */}
            <button onClick={toggleLang}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition px-2 py-1.5 rounded-lg hover:bg-white/5">
              <Globe size={13} />
              <span className="font-medium">{lang === 'th' ? 'EN' : 'ไทย'}</span>
            </button>

            {/* User / Login (desktop) */}
            {!loading && !mobileOpen && (
              <>
                {user ? (
                  <div className="hidden md:flex items-center gap-1">
                    <Link href="/profile"
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold shadow-md">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-300 hidden lg:block font-medium">{user.username}</span>
                    </Link>
                    <button onClick={handleLogout}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
                      <LogOut size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <Link href="/login" className="text-sm text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5">
                      {t.login}
                    </Link>
                    <Link href="/login" className="btn-primary text-sm px-4 py-1.5 rounded-lg" style={{ minHeight: 'auto' }}>
                      {t.register}
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setMobileOpen(p => !p)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu overlay ───────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ top: 0 }} onClick={close}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Menu panel */}
          <div
            className="absolute left-0 right-0 anim-fade-in"
            style={{ top: 'var(--navbar-h, 4rem)', background: 'rgba(10,10,20,0.98)', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* User info — tap to go to profile */}
            {user && (
              <Link href="/profile" onClick={close}
                className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] hover:bg-white/5 transition">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{user.username}</p>
                  {user.playerId
                    ? <p className="text-xs text-purple-400 font-mono">{user.playerId}</p>
                    : <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  }
                </div>
                {connected && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <Users size={11} />{onlineCount}
                  </div>
                )}
              </Link>
            )}

            {/* Nav links */}
            {user && (
              <div className="px-3 py-2 space-y-1">
                {navLinks.map(({ href, label, icon, admin }) => (
                  <Link key={href} href={href} onClick={close}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition
                      ${isActive(href)
                        ? admin ? 'bg-yellow-600/15 text-yellow-300' : 'bg-purple-600/15 text-purple-300'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>
                    <span className={admin ? 'text-yellow-400' : 'text-purple-400'}>{icon}</span>
                    {label}
                    {isActive(href) && <div className="ml-auto w-2 h-2 rounded-full bg-current opacity-60" />}
                  </Link>
                ))}
              </div>
            )}

            {/* Admin view toggle (mobile) */}
            {user?.isAdmin && (
              <div className="px-3 py-2 border-t border-[var(--border)]">
                <button onClick={() => { toggleViewMode(); close(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition
                    ${viewMode === 'admin' ? 'text-yellow-400 bg-yellow-500/8' : 'text-purple-300 bg-purple-600/8'}`}>
                  {viewMode === 'admin' ? <Eye size={16} /> : <EyeOff size={16} />}
                  {viewMode === 'admin'
                    ? (lang === 'th' ? 'ดูในมุมมองผู้ใช้' : 'Preview as User')
                    : (lang === 'th' ? 'กลับมุมมอง Admin' : 'Back to Admin view')}
                </button>
              </div>
            )}

            {/* Bottom actions */}
            <div className="px-3 py-3 border-t border-[var(--border)]">
              {user ? (
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition">
                  <LogOut size={16} /> {t.logout}
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link href="/login" onClick={close}
                    className="flex-1 py-3 text-center text-sm font-medium text-white rounded-xl border border-[var(--border)] hover:bg-white/5 transition">
                    {t.login}
                  </Link>
                  <Link href="/login" onClick={close}
                    className="flex-1 btn-primary py-3 rounded-xl text-sm" style={{ minHeight: 'auto' }}>
                    {t.register}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User-preview banner */}
      {user?.isAdmin && viewMode === 'user' && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 anim-fade-up w-[calc(100%-2rem)] max-w-sm"
          style={{ bottom: 'calc(1rem + var(--safe-bottom, 0px))' }}>
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium"
            style={{ background: 'rgba(124,58,237,0.92)', border: '1px solid rgba(167,139,250,0.3)', backdropFilter: 'blur(12px)' }}>
            <Eye size={14} className="text-purple-200 flex-shrink-0" />
            <span className="text-white text-xs flex-1 truncate">
              {lang === 'th' ? 'กำลังดูมุมมองผู้ใช้' : 'Previewing as user'}
            </span>
            <button onClick={toggleViewMode}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-900 bg-white hover:bg-purple-100 transition">
              {lang === 'th' ? 'กลับ' : 'Back'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
