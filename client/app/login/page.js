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

  const [mode, setMode]         = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [form, setForm]         = useState(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('cg_login_email') || '' : '';
    return { username: '', email: saved, password: '', confirm: '' };
  });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed]   = useState(false);
  const [success, setSuccess]   = useState('');

  const [resetEmail, setResetEmail]   = useState('');
  const [resetCode,  setResetCode]    = useState('');
  const [newPass,    setNewPass]      = useState('');
  const [newPassConf,setNewPassConf]  = useState('');
  const [showNewPass,setShowNewPass]  = useState(false);

  const [otpData, setOtpData] = useState(null);

  const googleConfigured =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
        const result = await register(form.username, form.email, form.password);
        if (result?.requiresOtp) setOtpData({ email: result.email });
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const switchMode = (m) => {
    setMode(m); setError(''); setSuccess('');
    setForm({ username: '', email: '', password: '', confirm: '' });
    setShowPass(false); setShowConf(false);
    setResetCode(''); setNewPass(''); setNewPassConf('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!resetEmail.trim()) return setError(lang === 'th' ? 'กรุณากรอก Email' : 'Please enter your email');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: resetEmail.trim() });
      setMode('reset');
      setSuccess(lang === 'th' ? `ส่ง OTP ไปยัง ${resetEmail} แล้ว` : `OTP sent to ${resetEmail}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (!resetEmail.trim() || loading) return;
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/forgot-password', { email: resetEmail.trim() });
      setSuccess(lang === 'th' ? `ส่ง OTP ใหม่ไปยัง ${resetEmail} แล้ว` : `New OTP sent to ${resetEmail}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (newPass !== newPassConf) return setError(lang === 'th' ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : 'Passwords do not match');
    if (newPass.length < 6) return setError(lang === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password min 6 characters');
    setLoading(true);
    try {
      const { message } = await api.post('/api/auth/reset-password', { email: resetEmail, code: resetCode, newPassword: newPass });
      switchMode('login'); setSuccess(message);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /* ── Reusable: eye-toggle button ── */
  const EyeBtn = ({ show, toggle }) => (
    <button type="button" tabIndex={-1} onClick={toggle}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition flex items-center justify-center"
      style={{ width: 36, height: 36 }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  /* ── Reusable: checkbox ── */
  const Checkbox = ({ checked, onChange }) => (
    <div className="relative flex-shrink-0" style={{ width: 20, height: 20, marginTop: 1 }}>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
        ${checked ? 'bg-purple-500 border-purple-500' : 'border-slate-600 group-hover:border-purple-500'}`}>
        {checked && <svg viewBox="0 0 10 8" width="9" height="9" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
    </div>
  );

  /* ── Reusable: error/success box ── */
  const MsgBox = ({ msg, type }) => msg ? (
    <div className="mb-3 px-3 py-2.5 rounded-xl text-xs leading-relaxed break-words"
      style={type === 'success'
        ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }
        : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
      {msg}
    </div>
  ) : null;

  return (
    <div className="min-h-screen-safe flex items-center justify-center px-3 sm:px-4 relative overflow-hidden py-6">
      <div className="orb w-96 h-96 bg-purple-700/10 top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2" />
      <div className="orb w-72 h-72 bg-violet-600/10 bottom-1/4 right-1/4" style={{ animationDelay: '-4s' }} />

      {otpData && (
        <OTPModal
          email={otpData.email}
          name={form.username}
          lang={lang}
          onSuccess={() => router.push('/lobby')}
          onCancel={() => setOtpData(null)}
        />
      )}

      {/* FIX #1: responsive max-width */}
      <div className="relative z-10 w-full" style={{ maxWidth: 'min(400px, 95vw)' }}>

        {/* Logo */}
        <div className="text-center mb-6 anim-fade-up">
          <div className="inline-flex w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 items-center justify-center text-2xl sm:text-3xl shadow-xl shadow-purple-900/40 mb-3">
            🃏
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">CardMatch</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {lang === 'th' ? 'หาเพื่อนเล่นการ์ดเกมส์' : 'Find Friends to Play Card Games'}
          </p>
        </div>

        {/* FIX #2: tab buttons — taller touch target */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex gap-1 p-1 rounded-xl mb-4 anim-fade-up"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 rounded-lg text-sm font-semibold transition`}
                style={{
                  minHeight: 44,
                  ...(mode === m ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.2)', color: 'white' } : { color: '#64748b' })
                }}>
                {m === 'login' ? t.login : t.register}
              </button>
            ))}
          </div>
        )}

        {/* FIX #3: back button — proper touch target */}
        {(mode === 'forgot' || mode === 'reset') && (
          <div className="flex items-center gap-2 mb-4 anim-fade-up">
            <button onClick={() => switchMode('login')}
              className="text-slate-500 hover:text-white transition flex items-center justify-center rounded-lg"
              style={{ width: 40, height: 40 }}>
              ←
            </button>
            <span className="text-white text-sm font-semibold flex items-center gap-2">
              <KeyRound size={15} className="text-purple-400" />
              {lang === 'th' ? 'ตั้งรหัสผ่านใหม่' : 'Reset Password'}
            </span>
          </div>
        )}

        {/* Step indicator for reset password flow */}
        {(mode === 'forgot' || mode === 'reset') && (() => {
          const resetStep = mode === 'forgot' ? 1 : resetCode.length === 6 ? 3 : 2;
          const steps = [
            { step: 1, label: lang === 'th' ? 'อีเมล' : 'Email' },
            { step: 2, label: 'OTP' },
            { step: 3, label: lang === 'th' ? 'รหัสใหม่' : 'Password' },
          ];
          return (
            <div className="flex items-center justify-center gap-2 mb-4 anim-fade-up">
              {steps.map(({ step, label }, idx) => (
                <div key={step} className="flex items-center gap-2">
                  {idx > 0 && <div className="w-6 h-px bg-slate-700" />}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all"
                      style={step === resetStep
                        ? { background: 'rgba(124,58,237,0.85)', color: 'white', border: '1px solid rgba(124,58,237,0.6)' }
                        : step < resetStep
                          ? { background: 'rgba(74,222,128,0.2)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {step < resetStep ? '✓' : step}
                    </div>
                    <span className={`text-[11px] font-medium ${step === resetStep ? 'text-slate-300' : 'text-slate-600'}`}>
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* FIX #4: card padding responsive */}
        <div className="anim-fade-up delay-100 card p-4 sm:p-5 overflow-hidden"
          style={{ background: 'rgba(15,15,30,0.85)', backdropFilter: 'blur(20px)' }}>

          <MsgBox msg={success} type="success" />

          {/* ── FORGOT ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <p className="text-xs text-slate-500 mb-2 leading-relaxed break-words">
                {lang === 'th' ? 'กรอก Email ที่ใช้สมัคร ระบบจะส่งรหัส OTP เพื่อยืนยันตัวตน' : "Enter your registered email. We'll send an OTP to verify your identity."}
              </p>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" required autoFocus
                  placeholder={lang === 'th' ? 'Email ที่ใช้สมัคร' : 'Registered email'}
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  className="input-base pl-9 text-sm"
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                />
              </div>
              <MsgBox msg={error} type="error" />
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-sm gap-2">
                {loading ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{lang === 'th' ? 'กำลังส่ง...' : 'Sending...'}</span>
                  : <>{lang === 'th' ? 'ส่งรหัส OTP' : 'Send OTP'} <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {/* ── RESET ── */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-3">
              {/* FIX #5: OTP input — remove tracking-widest on small screen */}
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" inputMode="numeric" required maxLength={6} autoFocus
                  placeholder={lang === 'th' ? 'รหัส OTP 6 หลัก' : '6-digit OTP'}
                  value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-base pl-9 text-sm font-mono tracking-[0.25em]"
                />
              </div>
              {/* FIX #6: password inputs — right padding matches eye button */}
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showNewPass ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'รหัสผ่านใหม่ (6+ ตัว)' : 'New password (6+)'}
                  value={newPass} onChange={e => setNewPass(e.target.value)}
                  className="input-base pl-9 pr-10 text-sm" autoComplete="new-password" />
                <EyeBtn show={showNewPass} toggle={() => setShowNewPass(p => !p)} />
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showNewPass ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'}
                  value={newPassConf} onChange={e => setNewPassConf(e.target.value)}
                  className={`input-base pl-9 text-sm ${newPassConf && newPass !== newPassConf ? 'border-red-500/60' : newPassConf && newPass === newPassConf ? 'border-green-500/60' : ''}`}
                  autoComplete="new-password" />
              </div>
              <MsgBox msg={error} type="error" />
              <button type="submit" disabled={loading || resetCode.length !== 6} className="btn-primary w-full py-3 rounded-xl text-sm gap-2 disabled:opacity-40">
                {loading ? <span className="flex items-center justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                  : <><KeyRound size={14} /> {lang === 'th' ? 'ตั้งรหัสผ่านใหม่' : 'Set New Password'}</>}
              </button>
              <button type="button" onClick={handleResendOtp}
                disabled={loading}
                className="w-full text-xs text-slate-600 hover:text-slate-400 transition py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? (lang === 'th' ? 'กำลังส่ง...' : 'Sending...') : (lang === 'th' ? 'ส่ง OTP ใหม่อีกครั้ง' : 'Resend OTP')}
              </button>
            </form>
          )}

          {/* Google */}
          {mode === 'login' && googleConfigured && <GoogleLoginButton lang={lang} />}

          {/* Register notices — FIX #7: break-words for Thai */}
          {mode === 'register' && (
            <>
              <div className="flex items-start gap-2.5 p-3 rounded-xl mb-2"
                style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <CheckCircle size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-300 leading-relaxed break-words">
                  {lang === 'th' ? 'ระบบจะส่งรหัส OTP 6 หลักไปยัง Email เพื่อยืนยัน' : 'A 6-digit OTP will be sent to verify your email'}
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl mb-3"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="flex-shrink-0 mt-0.5">🧪</span>
                <p className="text-xs text-yellow-300/80 leading-relaxed break-words">
                  {lang === 'th'
                    ? 'Beta Test — สมัครได้ไม่จำกัด รองรับผู้เล่นพร้อมกันสูงสุด 1,000 คน'
                    : 'Beta — unlimited signups, max 1,000 concurrent players'}
                </p>
              </div>
            </>
          )}

          <MsgBox msg={error} type="error" />

          {/* Main form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input type="text" required
                  placeholder={lang === 'th' ? 'ชื่อผู้เล่น (3-20 ตัว)' : 'Username (3-20 chars)'}
                  value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                  className="input-base pl-9 text-sm" autoComplete="username"
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                />
              </div>
            )}

            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input type="email" required placeholder={t.email}
                value={form.email} onChange={e => { const v = e.target.value; setForm({ ...form, email: v }); try { sessionStorage.setItem('cg_login_email', v); } catch {} }}
                className="input-base pl-9 text-sm"
                autoComplete={mode === 'login' ? 'email' : 'new-email'}
                onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input type={showPass ? 'text' : 'password'} required
                placeholder={mode === 'register' ? (lang === 'th' ? 'รหัสผ่าน (6+ ตัว)' : 'Password (6+)') : t.password}
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-base pl-9 pr-10 text-sm"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
              <EyeBtn show={showPass} toggle={() => setShowPass(p => !p)} />
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input type={showConf ? 'text' : 'password'} required
                  placeholder={lang === 'th' ? 'ยืนยันรหัสผ่าน' : 'Confirm password'}
                  value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                  className={`input-base pl-9 pr-10 text-sm transition-all
                    ${form.confirm && form.password !== form.confirm ? 'border-red-500/60' : form.confirm && form.password === form.confirm ? 'border-green-500/60' : ''}`}
                  autoComplete="new-password"
                />
                <EyeBtn show={showConf} toggle={() => setShowConf(p => !p)} />
                {form.confirm && (
                  <span className={`absolute right-11 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none
                    ${form.password === form.confirm ? 'text-green-400' : 'text-red-400'}`}>
                    {form.password === form.confirm ? '✓' : '✗'}
                  </span>
                )}
              </div>
            )}

            {/* FIX #8: checkboxes — larger, better touch area */}
            {mode === 'register' && (
              <>
                <label className="flex items-start gap-3 cursor-pointer group py-1">
                  <Checkbox checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} />
                  <span className="text-xs text-slate-500 leading-relaxed pt-0.5">
                    {lang === 'th' ? 'ฉันยืนยันว่ามีอายุ 13 ปีขึ้นไป' : 'I confirm I am at least 13 years old'}
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group py-1">
                  <Checkbox checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                  <span className="text-xs text-slate-500 leading-relaxed pt-0.5 break-words">
                    {lang === 'th' ? 'ฉันยอมรับ ' : 'I agree to the '}
                    {/* FIX #9: links with padding for tap area */}
                    <a href="/terms" target="_blank" className="text-purple-400 hover:text-purple-300 underline py-2 px-1">
                      {lang === 'th' ? 'ข้อกำหนดการใช้งาน' : 'Terms'}
                    </a>
                    {lang === 'th' ? ' และ ' : ' & '}
                    <a href="/privacy" target="_blank" className="text-purple-400 hover:text-purple-300 underline py-2 px-1">
                      {lang === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
                    </a>
                  </span>
                </label>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-sm gap-2">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'register' ? (lang === 'th' ? 'กำลังส่ง OTP...' : 'Sending OTP...') : (lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...')}
                </span>
              ) : (
                <>{mode === 'login' ? t.login : (lang === 'th' ? 'ส่ง OTP ยืนยัน Email' : 'Send OTP to Verify Email')}<ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center mt-3">
              <button onClick={() => { setResetEmail(form.email); switchMode('forgot'); }}
                className="text-xs text-slate-600 hover:text-purple-400 transition py-2 px-3">
                {lang === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p className="text-xs text-slate-700 text-center mt-3">
              {lang === 'th' ? 'ผู้ใช้คนแรกจะได้รับสิทธิ์ Admin อัตโนมัติ' : 'First registered user gets Admin rights'}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">CardMatch © 2026</p>
      </div>
    </div>
  );
}
