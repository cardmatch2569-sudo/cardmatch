'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import translations from '../../lib/translations';
import GoogleLoginButton from '../../components/GoogleLoginButton';
import OTPModal from '../../components/OTPModal';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, register, verifyOTP, lang } = useAuth();
  const t = translations[lang];
  const router = useRouter();

  const [mode, setMode]         = useState('login');   // 'login' | 'register' | 'forgot' | 'reset'
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [form, setForm]         = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed]   = useState(false);
  const [success, setSuccess]   = useState('');

  // Forgot / Reset password flow
  const [resetEmail, setResetEmail]   = useState('');
  const [resetCode,  setResetCode]    = useState('');
  const [newPass,    setNewPass]      = useState('');
  const [newPassConf,setNewPassConf]  = useState('');
  const [showNewPass,setShowNewPass]  = useState(false);

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
    if (mode === 'register' && !ageConfirmed) {
      setError(lang === 'th' ? 'กรุณายืนยันว่าคุณมีอายุ 13 ปีขึ้นไป' : 'Please confirm you are at least 13 years old');
      return;
    }
    if (mode === 'register' && !termsAccepted) {
      setError(lang === 'th' ? 'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อน' : 'Please accept the Terms of Service and Privacy Policy');
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
    setSuccess('');
    setForm({ username: '', email: '', password: '', confirm: '' });
    setShowPass(false);
    setShowConf(false);
    setResetCode('');
    setNewPass('');
    setNewPassConf('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!resetEmail.trim()) return setError(lang === 'th' ? 'กรุณากรอก Email' : 'Please enter your email');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: resetEmail.trim() });
      setMode('reset');
      setSuccess(lang === 'th' ? `ส่ง OTP ไปยัง ${resetEmail} แล้ว` : `OTP sent to ${resetEmail}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass !== newPassConf) return setError(lang === 'th' ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match');
    if (newPass.length < 6) return setError(lang === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password min 6 characters');
    setLoading(true);
    try {
      const { message } = await api.post('/api/auth/reset-password', { email: resetEmail, code: resetCode, newPassword: newPass });
      switchMode('login');
      setSuccess(message);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
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

        {/* Tab switcher — hidden in forgot/reset mode */}
        {(mode === 'login' || mode === 'register') && (
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
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <div className="flex items-center gap-2 mb-5 anim-fade-up">
            <button onClick={() => switchMode('login')} className="text-slate-500 hover:text-white transition p-1">
              ←
            </button>
            <span className="text-white text-sm font-semibold flex items-center gap-2">
              <KeyRound size={15} className="text-purple-400" />
              {lang === 'th' ? 'ตั้งรหัสผ่านใหม่' : 'Reset Password'}
            </span>
          </div>
        )}

        {/* Card */}
        <div className="anim-fade-up delay-100 card p-5 overflow-hidden"
          style={{ background: 'rgba(15,15,30,0.85)', backdropFilter: 'blur(20px)' }}>

          {/* Success message */}
          {success && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-sm flex items-center gap-2"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
              <CheckCircle size={14} /> {success}
            </div>
          )}

          {/* ── FORGOT PASSWORD ─────────────────────────────────── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                {lang === 'th'
                  ? 'กรอก Email ที่ใช้สมัคร ระบบจะส่งรหัส OTP เพื่อยืนยันตัวตน'
                  : 'Enter your registered email. We\'ll send an OTP to verify your identity.'}
              </p>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" required autoFocus
                  placeholder={lang === 'th' ? 'Email ที่ใช้สมัคร' : 'Registered email'}
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="input-base pl-10 text-sm"
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                />
              </div>
              {error && <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-sm gap-2">
                {loading
                  ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{lang === 'th' ? 'กำลังส่ง...' : 'Sending...'}</span>
                  : <>{lang === 'th' ? 'ส่งรหัส OTP' : 'Send OTP'} <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {/* ── RESET PASSWORD ──────────────────────────────────── */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" inputMode="numeric" required maxLength={6} autoFocus
                  placeholder={lang === 'th' ? 'รหัส OTP 6 หลักจาก Email' : '6-digit OTP from email'}
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-base pl-10 text-sm tracking-widest font-mono"
                />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showNewPass ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)' : 'New password (min 6 chars)'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="input-base pl-10 pr-10 text-sm"
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNewPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition p-1">
                  {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showNewPass ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'}
                  value={newPassConf}
                  onChange={e => setNewPassConf(e.target.value)}
                  className={`input-base pl-10 text-sm ${newPassConf && newPass !== newPassConf ? 'border-red-500/60' : newPassConf && newPass === newPassConf ? 'border-green-500/60' : ''}`}
                  autoComplete="new-password"
                />
              </div>
              {error && <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>}
              <button type="submit" disabled={loading || resetCode.length !== 6} className="btn-primary w-full py-3 rounded-xl text-sm gap-2 disabled:opacity-40">
                {loading
                  ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                  : <><KeyRound size={14} /> {lang === 'th' ? 'ตั้งรหัสผ่านใหม่' : 'Set New Password'}</>}
              </button>
              <button type="button" onClick={() => { setResetCode(''); handleForgotSubmit({ preventDefault: () => {} }); }}
                className="w-full text-xs text-slate-600 hover:text-slate-400 transition py-1">
                {lang === 'th' ? 'ส่ง OTP ใหม่อีกครั้ง' : 'Resend OTP'}
              </button>
            </form>
          )}

          {/* Google Button (login mode only) */}
          {mode === 'login' && googleConfigured && (
            <>
              <GoogleLoginButton lang={lang} />
              {/* divider removed */}
            </>
          )}

          {/* Registration notice */}
          {mode === 'register' && (
            <>
              <div className="flex items-start gap-2.5 p-3 rounded-xl mb-2"
                style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <CheckCircle size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-300 leading-relaxed">
                  {lang === 'th'
                    ? 'ระบบจะส่งรหัส OTP 6 หลักไปยัง Email ที่กรอก เพื่อยืนยันว่า Email มีจริง'
                    : 'A 6-digit OTP code will be sent to your email to verify it exists'}
                </p>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl mb-4"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="text-yellow-400 text-xs flex-shrink-0 mt-0.5">🧪</span>
                <p className="text-xs text-yellow-300/80 leading-relaxed">
                  {lang === 'th'
                    ? 'ขณะนี้ระบบอยู่ใน ช่วง Beta Test — สามารถสมัครได้ไม่จำกัด แต่รองรับผู้เล่นออนไลน์พร้อมกันสูงสุด 200 คน'
                    : 'The system is in Beta — registration is unlimited, but the server supports up to 200 concurrent players'}
                </p>
              </div>
            </>
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

            {/* Age confirmation — register only */}
            {mode === 'register' && (
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} className="sr-only" />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                    ${ageConfirmed ? 'bg-purple-500 border-purple-500' : 'border-slate-600 group-hover:border-purple-500'}`}>
                    {ageConfirmed && <svg viewBox="0 0 10 8" width="8" height="8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'th' ? 'ฉันยืนยันว่ามีอายุ 13 ปีขึ้นไป' : 'I confirm that I am at least 13 years old'}
                </span>
              </label>
            )}

            {/* Terms consent — register only */}
            {mode === 'register' && (
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="sr-only" />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                    ${termsAccepted ? 'bg-purple-500 border-purple-500' : 'border-slate-600 group-hover:border-purple-500'}`}>
                    {termsAccepted && <svg viewBox="0 0 10 8" width="8" height="8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                <span className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'th' ? 'ฉันอ่านและยอมรับ ' : 'I have read and agree to the '}
                  <a href="/terms" target="_blank" className="text-purple-400 hover:text-purple-300 underline">{lang === 'th' ? 'ข้อกำหนดการใช้งาน' : 'Terms of Service'}</a>
                  {lang === 'th' ? ' และ ' : ' and '}
                  <a href="/privacy" target="_blank" className="text-purple-400 hover:text-purple-300 underline">{lang === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}</a>
                </span>
              </label>
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

          {/* Forgot password link — login mode only */}
          {mode === 'login' && (
            <p className="text-center mt-3">
              <button onClick={() => { setResetEmail(form.email); switchMode('forgot'); }}
                className="text-xs text-slate-600 hover:text-purple-400 transition">
                {lang === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
              </button>
            </p>
          )}

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
