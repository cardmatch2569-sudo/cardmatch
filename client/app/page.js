'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../lib/api';
import translations from '../lib/translations';
import { Camera, Shuffle, Search, ArrowRight, Zap, Shield, Users } from 'lucide-react';

export default function HomePage() {
  const { user, lang } = useAuth();
  const { onlineCount } = useSocket();
  const t = translations[lang];
  const [games, setGames] = useState([]);

  useEffect(() => {
    api.get('/api/games').then(({ games }) => setGames(games)).catch(() => {});
  }, []);

  const features = [
    { icon: <Camera size={20} />, label: lang === 'th' ? 'วิดีโอสด' : 'Live Video', color: '#a78bfa' },
    { icon: <Shuffle size={20} />, label: lang === 'th' ? 'จับคู่สุ่ม' : 'Random Match', color: '#f472b6' },
    { icon: <Search size={20} />, label: lang === 'th' ? 'ค้นหาผู้เล่น' : 'Find Players', color: '#60a5fa' },
    { icon: <Shield size={20} />, label: lang === 'th' ? 'ปลอดภัย' : 'Secure', color: '#4ade80' },
  ];

  const steps = [
    {
      n: '01', icon: '🎮',
      title: t.step1Title, desc: t.step1Desc,
      grad: 'from-violet-600/20 to-purple-600/10',
      border: 'border-violet-500/20',
    },
    {
      n: '02', icon: '⚔️',
      title: t.step2Title, desc: t.step2Desc,
      grad: 'from-rose-600/20 to-pink-600/10',
      border: 'border-rose-500/20',
    },
    {
      n: '03', icon: '📷',
      title: t.step3Title, desc: t.step3Desc,
      grad: 'from-sky-600/20 to-blue-600/10',
      border: 'border-sky-500/20',
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-[100vh] flex flex-col items-center justify-center px-4 text-center overflow-hidden">

        {/* Animated orbs */}
        <div className="orb w-[500px] h-[500px] bg-purple-600/15 top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '0s' }} />
        <div className="orb w-[400px] h-[400px] bg-violet-500/10 bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2" style={{ animationDelay: '-6s' }} />
        <div className="orb w-[300px] h-[300px] bg-fuchsia-600/10 top-1/2 right-1/3" style={{ animationDelay: '-3s' }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] pointer-events-none opacity-50" />

        <div className="relative z-10 max-w-4xl mx-auto">

          {/* Live badge */}
          <div className="anim-fade-up inline-flex items-center gap-2.5 bg-purple-950/60 border border-purple-700/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            {onlineCount > 0 ? `${onlineCount} ${lang === 'th' ? 'คนออนไลน์' : 'players online'}` : 'CardMatch Platform'}
          </div>

          {/* Headline */}
          <h1 className="anim-fade-up delay-100 text-5xl md:text-7xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            {lang === 'th' ? (
              <>หาคู่เล่น<br /><span className="gradient-text text-glow">การ์ดเกม</span></>
            ) : (
              <>Find Your<br /><span className="gradient-text text-glow">Card Rival</span></>
            )}
          </h1>

          <p className="anim-fade-up delay-200 text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t.heroSubtitle}
          </p>

          {/* CTA Buttons */}
          <div className="anim-fade-up delay-300 flex flex-wrap gap-4 justify-center mb-12">
            <Link
              href={user ? '/lobby' : '/login'}
              className="btn-primary text-base px-7 py-3.5 rounded-xl"
            >
              {t.heroBtn}
              <ArrowRight size={18} />
            </Link>
            {!user && (
              <Link
                href="/login"
                className="btn-ghost text-base px-7 py-3.5 rounded-xl"
              >
                {t.login}
              </Link>
            )}
          </div>

          {/* Feature pills */}
          <div className="anim-fade-up delay-400 flex flex-wrap justify-center gap-3">
            {features.map(({ icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}25`,
                  color,
                }}
              >
                {icon}
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-600">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-slate-600" />
          <span className="text-xs uppercase tracking-widest">scroll</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 text-sm font-semibold tracking-widest uppercase mb-3">
              {lang === 'th' ? 'เริ่มเล่นใน 3 ขั้นตอน' : '3 Simple Steps'}
            </p>
            <h2 className="text-4xl font-bold text-white">{t.howItWorks}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`relative card card-hover p-7 bg-gradient-to-br ${step.grad} border ${step.border} overflow-hidden`}
              >
                <div className="absolute top-4 right-5 text-6xl font-black text-white/[0.04] select-none leading-none">
                  {step.n}
                </div>
                <div className="text-4xl mb-5">{step.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GAMES ─────────────────────────────────────────────── */}
      {games.length > 0 && (
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-purple-400 text-sm font-semibold tracking-widest uppercase mb-3">
                {lang === 'th' ? 'เกมที่รองรับ' : 'Supported Games'}
              </p>
              <h2 className="text-4xl font-bold text-white">{t.availableGames}</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {games.map((game) => (
                <div
                  key={game._id}
                  className="card card-hover group p-6 cursor-pointer"
                  style={{ borderColor: `${game.color}20` }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110"
                    style={{ background: `${game.color}15`, border: `1px solid ${game.color}30` }}
                  >
                    🃏
                  </div>
                  <div
                    className="inline-block w-1.5 h-1.5 rounded-full mb-3"
                    style={{ background: game.color }}
                  />
                  <h3 className="font-bold text-white mb-1">
                    {lang === 'th' ? game.nameTh : game.name}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {lang === 'th' ? game.descriptionTh : game.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA BANNER ────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative card p-10 md:p-14 text-center overflow-hidden"
            style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(109,40,217,0.04))' }}>
            <div className="orb w-64 h-64 bg-purple-600/20 -top-8 -right-8 pointer-events-none" style={{ animationDelay: '-2s' }} />
            <Zap size={40} className="text-purple-400 mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {lang === 'th' ? 'พร้อมเริ่มเล่นแล้วหรือยัง?' : 'Ready to Play?'}
            </h2>
            <p className="text-slate-400 mb-8">
              {lang === 'th'
                ? 'สมัครด้วย Google แล้วหาคู่ต่อสู้ได้ทันที'
                : 'Sign in with Google and find an opponent instantly'}
            </p>
            <Link
              href={user ? '/lobby' : '/login'}
              className="btn-primary text-base px-8 py-3.5 rounded-xl mx-auto"
            >
              {user ? (lang === 'th' ? 'ไปที่ล็อบบี้' : 'Go to Lobby') : t.heroBtn}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] py-10 text-center">
        <p className="text-slate-600 text-sm">
          <span className="text-slate-500 font-semibold">CardMatch</span>
          {' '}© 2026 —{' '}
          {lang === 'th' ? 'จับคู่ผู้เล่นการ์ดเกมทั่วไทย' : 'Card Game Matchmaking Platform'}
        </p>
      </footer>
    </div>
  );
}
