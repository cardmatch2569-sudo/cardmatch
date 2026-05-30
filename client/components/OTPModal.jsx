'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Mail, RefreshCw, X, ShieldCheck } from 'lucide-react';

export default function OTPModal({ email, name, lang, onSuccess, onCancel }) {
  const { verifyOTP } = useAuth();
  const [digits, setDigits]     = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]       = useState('');
  const [timeLeft, setTimeLeft] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const [success, setSuccess]   = useState(false);
  const inputs          = useRef([]);
  const timerRef        = useRef(null);
  // Bug fix: store canResend timeout in ref so it can be cleared on unmount / restart
  const canResendRef    = useRef(null);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(canResendRef.current);
    setTimeLeft(600);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((p) => { if (p <= 1) { clearInterval(timerRef.current); return 0; } return p - 1; });
    }, 1000);
    canResendRef.current = setTimeout(() => setCanResend(true), 60000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(canResendRef.current);
    };
  }, [startTimer]);

  useEffect(() => { setTimeout(() => inputs.current[0]?.focus(), 200); }, []);

  const fmt = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits]; next[i] = val.slice(-1); setDigits(next); setError('');
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const next = pasted.split('').concat(['','','','','','']).slice(0, 6);
      setDigits(next);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < 6) { setError(lang === 'th' ? 'กรุณากรอกรหัส 6 หลักให้ครบ' : 'Enter all 6 digits'); return; }
    setLoading(true); setError('');
    try {
      await verifyOTP(email, code);
      setSuccess(true);
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      setError(err.message || (lang === 'th' ? 'รหัสไม่ถูกต้อง กรุณาลองใหม่' : 'Invalid code'));
      setDigits(['','','','','','']);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true); setError('');
    try {
      const res = await api.post('/api/auth/resend-otp', { email });
      setDigits(['','','','','','']);
      startTimer();
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } catch (err) { setError(err.message); }
    finally { setResending(false); }
  };

  const masked = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 6)) + c);
  const filled = digits.join('').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

      {/* Smaller padding on mobile (p-4), normal on desktop (p-7) */}
      <div className="anim-scale-in w-full max-w-sm card relative overflow-hidden"
        style={{ background: 'rgba(15,15,30,0.95)', borderColor: 'rgba(124,58,237,0.25)' }}>

        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        <button onClick={onCancel}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition">
          <X size={15} />
        </button>

        <div className="p-4 sm:p-7">
          {/* Success state */}
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={28} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                {lang === 'th' ? 'ยืนยันสำเร็จ!' : 'Verified!'}
              </h2>
              <p className="text-slate-400 text-sm">
                {lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Logging you in...'}
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <Mail size={24} className="text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {lang === 'th' ? 'ยืนยันอีเมล' : 'Verify Email'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {lang === 'th' ? 'รหัส 6 หลักถูกส่งไปที่' : 'A 6-digit code was sent to'}
                </p>
                <p className="text-purple-300 text-sm font-semibold mt-0.5">{masked}</p>
              </div>

              {/* OTP inputs — responsive: smaller on very small screens */}
              <div className="flex gap-1.5 sm:gap-2 justify-center mb-4" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputs.current[i] = el)}
                    type="text" inputMode="numeric" maxLength={1}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`text-center font-bold rounded-xl border-2 transition-all focus:outline-none
                      ${d ? 'border-purple-500 text-white' : 'border-[var(--border)] text-white'}
                      ${error ? 'border-red-500/70' : ''}
                      focus:border-purple-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]`}
                    style={{
                      width: 'clamp(36px, 12vw, 48px)',
                      height: 'clamp(44px, 13vw, 54px)',
                      fontSize: 'clamp(16px, 4vw, 22px)',
                      background: d ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                  />
                ))}
              </div>

              {/* Progress bar */}
              <div className="h-0.5 rounded-full bg-[var(--border)] mb-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-300"
                  style={{ width: `${(filled / 6) * 100}%` }}
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center mb-3 anim-fade-in">{error}</p>
              )}

              {/* Timer */}
              <div className="text-center mb-5">
                {timeLeft > 0 ? (
                  <p className="text-xs text-slate-600">
                    {lang === 'th' ? 'รหัสหมดอายุใน' : 'Expires in'}{' '}
                    <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-slate-400'}`}>
                      {fmt(timeLeft)}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-red-400">
                    {lang === 'th' ? 'รหัสหมดอายุแล้ว' : 'Code expired'}
                  </p>
                )}
              </div>

              {/* Verify button */}
              <button onClick={handleVerify}
                disabled={loading || filled < 6 || timeLeft === 0}
                className="btn-primary w-full py-3 rounded-xl mb-3 text-sm">
                {loading ? (lang === 'th' ? 'กำลังยืนยัน...' : 'Verifying...') : (lang === 'th' ? 'ยืนยันรหัส' : 'Verify Code')}
              </button>

              {/* Resend + Cancel */}
              <div className="flex gap-2">
                <button onClick={handleResend} disabled={!canResend || resending}
                  className="btn-ghost flex-1 py-2 text-xs rounded-lg gap-1.5 disabled:opacity-35">
                  <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                  {lang === 'th' ? 'ส่งใหม่' : 'Resend'}
                </button>
                <button onClick={onCancel} className="btn-ghost flex-1 py-2 text-xs rounded-lg">
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
              </div>

              <p className="text-xs text-slate-700 text-center mt-4">
                {lang === 'th' ? 'ไม่เห็นอีเมล? ตรวจ Spam/Junk' : "Can't find it? Check Spam/Junk"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
