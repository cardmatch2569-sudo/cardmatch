'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import translations from '../lib/translations';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, LogOut, Shield, Globe, Swords, Eye, EyeOff, Settings, Menu, X, Heart, Trophy, UserPlus, MapPin } from 'lucide-react';
import { api } from '../lib/api';

export default function Navbar() {
  const { user, lang, loading, isAdminMode, viewMode, toggleViewMode, logout, toggleLang } = useAuth();
  const { onlineCount, connected, getSocket, socketReady } = useSocket();
  const router   = useRouter();
  const pathname = usePathname();
  const t = translations[lang];

  const [mobileOpen, setMobileOpen] = useState(false);
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [meetupNotif, setMeetupNotif] = useState(0);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    if (!user) { setFriendReqCount(0); return; }
    api.get('/api/friends/requests').then(d => setFriendReqCount(d.requests?.length || 0)).catch(() => {});
    const socket = getSocket?.();
    if (!socket) return;
    const onReq = () => setFriendReqCount(c => c + 1);
    const onAcc = () => {};
    socket.on('friend_request_received', onReq);
    socket.on('friend_request_accepted', onAcc);
    return () => { socket.off('friend_request_received', onReq); socket.off('friend_request_accepted', onAcc); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    if (!user) { setMeetupNotif(0); return; }
    const refresh = () => api.get('/api/meetup/notifications/count').then(d => setMeetupNotif(d.count || 0)).catch(() => {});
    refresh();
    window.addEventListener('meetup-notif-changed', refresh);
    const socket = getSocket?.();
    const onInterest = () => setMeetupNotif(c => c + 1);
    socket?.on('meetup_interest', onInterest);
    return () => {
      window.removeEventListener('meetup-notif-changed', refresh);
      socket?.off('meetup_interest', onInterest);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, socketReady]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const panel = mobileMenuRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll('a[href], button:not([disabled])');
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [mobileOpen]);

  if (pathname?.startsWith('/room/')) return null;

  const handleLogout = () => { logout(); router.push('/'); setMobileOpen(false); };
  const isActive = (href) => pathname === href;
  const close = () => setMobileOpen(false);

  const navLinks = [
    { href: '/lobby',       label: t.lobby,                                         icon: <Swords size={14} />,         always: true },
    { href: '/meetup',      label: lang === 'th' ? 'นัดเล่น' : 'Meetup',           icon: <MapPin size={14} />,         always: true, meetup: true, badge: meetupNotif },
    { href: '/tournament',  label: lang === 'th' ? 'ทัวร์นาเมนต์' : 'Tournament',  icon: <span className="text-xs">🏆</span>, always: true, tourney: true },
    { href: '/leaderboard', label: lang === 'th' ? 'อันดับ' : 'Leaderboard',       icon: <Trophy size={14} />,         always: true, leaderboard: true },
    { href: '/friends',     label: lang === 'th' ? 'เพื่อน' : 'Friends',           icon: <UserPlus size={14} />,       requireAuth: true, friends: true, badge: friendReqCount },
    { href: '/setup',       label: lang === 'th' ? 'ทดสอบ' : 'Setup',              icon: <Settings size={14} />,       requireAuth: true },
    ...(isAdminMode ? [{ href: '/admin', label: t.admin, icon: <Shield size={14} />, admin: true }] : []),
  ];

  // Guests only get the public Meetup board; everything else needs an account
  const visibleLinks = user ? navLinks : navLinks.filter(l => l.meetup);

  const donateLink = { href: '/donate', label: t.donate, icon: <Heart size={11} fill="currentColor" /> };

  // Per-link color config
  const col = ({ admin, tourney, leaderboard, friends, meetup }) => {
    if (admin)       return { a: 'from-amber-600/[0.18] to-yellow-600/[0.08] text-amber-300 border-amber-500/25',   ia: 'text-amber-500/60 hover:text-amber-300 hover:bg-amber-500/[0.07]',   glow: '0 0 14px rgba(251,191,36,0.18)' };
    if (tourney)     return { a: 'from-yellow-500/[0.18] to-amber-500/[0.08] text-yellow-300 border-yellow-500/25', ia: 'text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-500/[0.07]', glow: '0 0 14px rgba(234,179,8,0.18)' };
    if (leaderboard) return { a: 'from-emerald-600/[0.18] to-teal-600/[0.08] text-emerald-300 border-emerald-500/25', ia: 'text-emerald-500/60 hover:text-emerald-300 hover:bg-emerald-500/[0.07]', glow: '0 0 14px rgba(52,211,153,0.18)' };
    if (friends)     return { a: 'from-blue-600/[0.18] to-indigo-600/[0.08] text-blue-300 border-blue-500/25',      ia: 'text-blue-400/60 hover:text-blue-300 hover:bg-blue-500/[0.07]',         glow: '0 0 14px rgba(96,165,250,0.18)' };
    if (meetup)      return { a: 'from-cyan-600/[0.18] to-sky-600/[0.08] text-cyan-300 border-cyan-500/25',         ia: 'text-cyan-500/60 hover:text-cyan-300 hover:bg-cyan-500/[0.07]',         glow: '0 0 14px rgba(6,182,212,0.18)' };
    return             { a: 'from-purple-600/[0.22] to-violet-600/[0.12] text-purple-300 border-purple-500/25',   ia: 'text-slate-400/80 hover:text-slate-100 hover:bg-white/[0.06]',           glow: '0 0 14px rgba(124,58,237,0.2)' };
  };

  return (
    <>
      {/* ── Main nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ height: 'var(--navbar-h, 4rem)' }}>

        {/* Background: deep dark + blur */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(12,6,28,0.97) 0%, rgba(7,7,15,0.93) 100%)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }} />

        {/* Purple glow line — top edge */}
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.55) 50%, transparent 95%)' }} />

        {/* Bottom border — violet→cyan shimmer */}
        <div className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.3) 30%, rgba(6,182,212,0.3) 70%, transparent 100%)' }} />

        <div className="relative max-w-7xl mx-auto px-4 flex items-center justify-between gap-3"
          style={{ height: '100%', paddingTop: 'var(--safe-top, 0px)' }}>

          {/* ── Logo ──────────────────────────── */}
          <Link href="/" onClick={close} className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-700
              flex items-center justify-center text-sm
              transition-all duration-300
              group-hover:scale-105"
              style={{ boxShadow: '0 0 18px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              🃏
            </div>
            <span className="font-bold text-base tracking-tight">
              <span className="text-white">Card</span>
              <span style={{
                background: 'linear-gradient(135deg, #a78bfa, #818cf8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Match</span>
            </span>
          </Link>

          {/* ── Desktop center nav ────────────── */}
          {!loading && (
            <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
              {visibleLinks.map(({ href, label, icon, admin, tourney, leaderboard, friends, meetup, badge }) => {
                const active = isActive(href);
                const c = col({ admin, tourney, leaderboard, friends, meetup });
                return (
                  <Link key={href} href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => { if (friends) setFriendReqCount(0); }}
                    style={active ? { boxShadow: c.glow } : {}}
                    className={`relative flex items-center gap-1.5 px-3 h-8 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${active
                        ? `bg-gradient-to-r ${c.a} border`
                        : c.ia}`}>
                    {icon}
                    <span>{label}</span>
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-1 min-w-[16px] h-4 px-1 rounded-full
                        bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Right side ───────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Online count */}
            {user && (
              <div className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-all duration-300
                ${connected
                  ? 'text-slate-500 border-white/[0.06] bg-white/[0.025]'
                  : 'text-yellow-500/80 border-yellow-500/20 bg-yellow-500/[0.04]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse
                  ${connected ? 'bg-green-400' : 'bg-yellow-400'}`}
                  style={connected ? { boxShadow: '0 0 4px rgba(74,222,128,0.7)' } : {}} />
                {connected
                  ? <><Users size={10} className="opacity-70" /><span>{onlineCount}</span></>
                  : <span>{lang === 'th' ? 'เชื่อมต่อ...' : 'Connecting'}</span>}
              </div>
            )}

            {/* Divider */}
            {user && <div className="w-px h-5 bg-white/[0.08] mx-0.5 flex-shrink-0" />}

            {/* Admin view toggle */}
            {user?.isAdmin && (
              <button onClick={toggleViewMode}
                className={`hidden md:flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold
                  transition-all duration-200 border
                  ${viewMode === 'admin'
                    ? 'text-amber-300 border-amber-500/25 bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                    : 'text-violet-300 border-purple-500/20 bg-purple-600/[0.08] hover:bg-purple-600/[0.14]'}`}>
                {viewMode === 'admin'
                  ? <><Eye size={12} />{lang === 'th' ? 'ดูผู้ใช้' : 'User view'}</>
                  : <><EyeOff size={12} />Admin</>}
              </button>
            )}

            {/* Donate */}
            <Link href="/donate"
              className={`hidden md:flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold
                transition-all duration-200 border
                ${isActive('/donate')
                  ? 'bg-gradient-to-r from-pink-600/[0.2] to-rose-600/[0.1] text-pink-300 border-pink-500/25'
                  : 'text-pink-400/70 border-pink-600/20 bg-pink-500/[0.04] hover:bg-pink-500/[0.10] hover:text-pink-300'}`}
              style={isActive('/donate') ? { boxShadow: '0 0 12px rgba(236,72,153,0.15)' } : {}}>
              <Heart size={11} fill="currentColor" />
              {t.donate}
            </Link>

            {/* Language toggle */}
            <button onClick={toggleLang}
              aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
              className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-medium
                text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-200">
              <Globe size={12} />
              <span>{lang === 'th' ? 'EN' : 'ไทย'}</span>
            </button>

            {/* Divider */}
            {user && <div className="w-px h-5 bg-white/[0.08] mx-0.5 flex-shrink-0" />}

            {/* User + Logout (desktop) */}
            {!loading && !mobileOpen && (
              <>
                {user ? (
                  <div className="hidden md:flex items-center gap-0.5">
                    <Link href="/profile"
                      className="flex items-center gap-2 h-8 px-2 rounded-xl hover:bg-white/[0.06] transition-all duration-200">
                      <div className="relative flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-violet-600
                          flex items-center justify-center text-[10px] font-bold"
                          style={{ boxShadow: '0 0 8px rgba(124,58,237,0.45)' }}>
                          {user.username[0].toUpperCase()}
                        </div>
                        {connected && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400
                            border-2 border-[#0c061c]"
                            style={{ boxShadow: '0 0 5px rgba(74,222,128,0.7)' }} />
                        )}
                      </div>
                      <span className="text-xs text-slate-300 font-medium hidden md:block">{user.username}</span>
                    </Link>
                    <button onClick={handleLogout}
                      aria-label={lang === 'th' ? 'ออกจากระบบ' : 'Log out'}
                      className="flex items-center justify-center w-8 h-8 rounded-xl
                        text-slate-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200">
                      <LogOut size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <Link href="/login"
                      className="flex items-center h-8 px-3 rounded-xl text-sm text-slate-500
                        hover:text-white hover:bg-white/[0.06] transition-all duration-200">
                      {t.login}
                    </Link>
                    <Link href="/login" className="btn-primary text-sm px-4 h-8 rounded-xl" style={{ minHeight: 'auto' }}>
                      {t.register}
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(p => !p)}
              className="relative md:hidden flex items-center justify-center w-8 h-8 rounded-xl
                text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              aria-label={mobileOpen ? (lang === 'th' ? 'ปิดเมนู' : 'Close menu') : (lang === 'th' ? 'เปิดเมนู' : 'Open menu')}
              aria-expanded={mobileOpen}>
              <div className="transition-transform duration-200" style={{ transform: mobileOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </div>
              {!mobileOpen && (meetupNotif > 0 || friendReqCount > 0) && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"
                  style={{ boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu overlay ───────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40" style={{ top: 0 }} onClick={close}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div
            ref={mobileMenuRef}
            className="absolute left-0 right-0 anim-fade-in"
            style={{
              top: 'var(--navbar-h, 4rem)',
              background: 'linear-gradient(180deg, rgba(12,6,30,0.99) 0%, rgba(9,7,20,0.98) 100%)',
              borderBottom: '1px solid rgba(124,58,237,0.15)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* User info row */}
            {user && (
              <Link href="/profile" onClick={close}
                className="flex items-center gap-3 px-5 py-4 transition-all duration-200 hover:bg-white/[0.04]"
                style={{ borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-violet-600
                    flex items-center justify-center font-bold text-sm"
                    style={{ boxShadow: '0 0 14px rgba(124,58,237,0.5)' }}>
                    {user.username[0].toUpperCase()}
                  </div>
                  {connected && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400
                      border-2 border-[#0c061e]"
                      style={{ boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{user.username}</p>
                  {user.playerId
                    ? <p className="text-xs text-purple-400 font-mono">{user.playerId}</p>
                    : <p className="text-xs text-slate-500 truncate">{user.email}</p>}
                </div>
                {connected && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400/80 flex-shrink-0">
                    <Users size={11} /><span>{onlineCount}</span>
                  </div>
                )}
              </Link>
            )}

            {/* Nav links */}
            {!loading && (
              <div className="px-3 py-2.5 space-y-0.5">
                {visibleLinks.map(({ href, label, icon, admin, tourney, leaderboard, friends, meetup, badge }) => {
                  const active = isActive(href);
                  const c = col({ admin, tourney, leaderboard, friends, meetup });
                  return (
                    <Link key={href} href={href}
                      onClick={() => { close(); if (friends) setFriendReqCount(0); }}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                        ${active
                          ? `bg-gradient-to-r ${c.a} border`
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}
                      style={active ? { boxShadow: c.glow } : {}}>
                      <span className={active ? '' : 'opacity-60'}>{icon}</span>
                      <span>{label}</span>
                      {badge > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold"
                          style={{ boxShadow: '0 0 6px rgba(239,68,68,0.4)' }}>
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Admin view toggle */}
            {user?.isAdmin && (
              <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => { toggleViewMode(); close(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${viewMode === 'admin'
                      ? 'text-amber-300 bg-amber-500/[0.08] border border-amber-500/20'
                      : 'text-violet-300 bg-purple-600/[0.08] border border-purple-500/15'}`}>
                  {viewMode === 'admin' ? <Eye size={15} /> : <EyeOff size={15} />}
                  {viewMode === 'admin'
                    ? (lang === 'th' ? 'ดูในมุมมองผู้ใช้' : 'Preview as User')
                    : (lang === 'th' ? 'กลับมุมมอง Admin' : 'Back to Admin view')}
                </button>
              </div>
            )}

            {/* Donate */}
            <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Link href={donateLink.href} onClick={close}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive('/donate')
                    ? 'bg-gradient-to-r from-pink-600/[0.18] to-rose-600/[0.08] text-pink-300 border border-pink-500/20'
                    : 'text-pink-400/70 hover:text-pink-300 hover:bg-pink-500/[0.07]'}`}>
                <span className="opacity-80">{donateLink.icon}</span>
                {donateLink.label}
                {isActive('/donate') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
              </Link>
            </div>

            {/* Bottom: lang + logout / login */}
            <div className="px-3 pt-2 pb-4 flex items-center gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => { toggleLang(); }}
                aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                  text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-200 border border-white/[0.06]">
                <Globe size={13} />
                {lang === 'th' ? 'EN' : 'ไทย'}
              </button>
              {user ? (
                <button onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                    text-red-400/80 hover:text-red-300 hover:bg-red-500/[0.08] transition-all duration-200
                    border border-red-500/10">
                  <LogOut size={14} />
                  {t.logout}
                </button>
              ) : (
                <div className="flex flex-1 gap-2">
                  <Link href="/login" onClick={close}
                    className="flex-1 py-2.5 text-center text-sm font-medium text-white rounded-xl
                      border border-white/[0.08] hover:bg-white/[0.05] transition-all duration-200">
                    {t.login}
                  </Link>
                  <Link href="/login" onClick={close}
                    className="flex-1 btn-primary py-2.5 rounded-xl text-sm" style={{ minHeight: 'auto' }}>
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
            style={{
              background: 'rgba(109,40,217,0.92)',
              border: '1px solid rgba(167,139,250,0.25)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
            }}>
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
