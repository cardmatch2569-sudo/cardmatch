'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import translations from '../../lib/translations';
import GoogleLoginButton from '../../components/GoogleLoginButton';
import OTPModal from '../../components/OTPModal';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, register, verifyOTP, lang } = useAuth();
  const t = translations[lang];
  const router = useRouter();

  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [form, setForm]         = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // OTP flow for email registration
  const [otpData, setOtpData]   = useState(null);  // { email, devCode }

  const googleConfigured =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate confirm password before calling API
    if (mode === 'register' && form.password !== form.confirm) {
      setError(lang === 'th' ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        router.push('/lobby');
      } else {
        // Register → sends OTP to email
        const result = await register(form.username, form.email, form.password);
        if (result?.requiresOtp) {
          setOtpData({ email: result.email });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setForm({ username: '', email: '', password: '', confirm: '' });
    setShowPass(false);
    setShowConf(false);
  };

  return (
    <div className="min-h-screen-safe flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb w-96 h-96 bg-purple-700/10 top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
      <div className="orb w-72 h-72 bg-violet-600/10 bottom-1/4 right-1/4" style={{ animationDelay: '-4s' }} />

      {/* OTP Modal for email registration */}
      {otpData && (
        <OTPModal
          email={otpData.email}
          name={form.username}
          lang={lang}
          onSuccess={() => router.push('/lobby')}
          onCancel={() => setOtpData(null)}
        />
      )}

      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo */}
        <div className="text-center mb-7 anim-fade-up">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 items-center justify-center text-3xl shadow-xl shadow-purple-900/40 mb-3">
            🃏
          </div>
          <h1 className="text-2xl font-bold text-white">CardMatch</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lang === 'th' ? 'หาคู่เล่นการ์ดเกม' : 'Card Game Matchmaking'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-5 anim-fade-up"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition
              ${mode === 'login' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            style={mode === 'login' ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.2)' } : {}}>
            {t.login}
          </button>
          <button onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition
              ${mode === 'register' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            style={mode === 'register' ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.2)' } : {}}>
            {t.register}
          </button>
        </div>

        {/* Card */}
        <div className="anim-fade-up delay-100 card p-5 overflow-hidden"
          style={{ background: 'rgba(15,15,30,0.85)', backdropFilter: 'blur(20px)' }}>

          {/* Google Button (login mode only) */}
          {mode === 'login' && googleConfigured && (
            <>
              <GoogleLoginButton lang={lang} />
              {/* divider removed */}
            </>
          )}

          {/* Registration notice */}
          {mode === 'register' && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl mb-4"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <CheckCircle size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-purple-300 leading-relaxed">
                {lang === 'th'
                  ? 'ระบบจะส่งรหัส OTP 6 หลักไปยัง Email ที่กรอก เพื่อยืนยันว่า Email มีจริง'
                  : 'A 6-digit OTP code will be sent to your email to verify it exists'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Username (register only) */}
            {mode === 'register' && (
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type="text" required
                  placeholder={lang === 'th' ? 'ชื่อแสดง / ชื่อผู้เล่น (3-20 ตัว)' : 'Display name / Username (3-20 chars)'}
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="input-base pl-10 text-sm"
                  autoComplete="username"
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                type="email" required
                placeholder={t.email}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input-base pl-10 text-sm"
                autoComplete={mode === 'login' ? 'email' : 'new-email'}
                onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'} required
                placeholder={mode === 'register'
                  ? (lang === 'th' ? 'รหัสผ่าน (อย่างน้อย 6 ตัว)' : 'Password (min 6 chars)')
                  : t.password}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-base pl-10 pr-10 text-sm"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPass(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition p-1">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type={showConf ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'ยืนยันรหัสผ่านอีกครั้ง' : 'Confirm password'}
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  className={`input-base pl-10 pr-10 text-sm transition-all
                    ${form.confirm && form.password !== form.confirm
                      ? 'border-red-500/60 focus:border-red-500'
                      : form.confirm && form.password === form.confirm
                        ? 'border-green-500/60 focus:border-green-500'
                        : ''}`}
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowConf(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition p-1">
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                {/* Inline match indicator */}
                {form.confirm && (
                  <span className={`absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium
                    ${form.password === form.confirm ? 'text-green-400' : 'text-red-400'}`}>
                    {form.password === form.confirm
                      ? (lang === 'th' ? '✓ ตรงกัน' : '✓ Match')
                      : (lang === 'th' ? '✗ ไม่ตรง' : '✗ No match')}
                  </span>
                )}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 rounded-xl text-sm gap-2">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'register'
                    ? (lang === 'th' ? 'กำลังส่ง OTP...' : 'Sending OTP...')
                    : (lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...')}
                </span>
              ) : (
                <>
                  {mode === 'login' ? t.login : (lang === 'th' ? 'ส่ง OTP ยืนยัน Email' : 'Send OTP to Verify Email')}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* First user note */}
          {mode === 'register' && (
            <p className="text-xs text-slate-700 text-center mt-3">
              {lang === 'th' ? 'ผู้ใช้คนแรกจะได้รับสิทธิ์ Admin อัตโนมัติ' : 'First registered user gets Admin rights'}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">CardMatch © 2026</p>
      </div>
    </div>
  );
}
