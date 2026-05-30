'use client';
import { useState, useRef, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import OTPModal from './OTPModal';

// Google OAuth only works on proper domains (localhost or real domain).
// IP addresses are blocked by Google — detect and handle gracefully.
function isGoogleOAuthAllowed() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export default function GoogleLoginButton({ lang }) {
  const { loginWithGoogle } = useAuth();
  const router  = useRouter();
  const wrapRef = useRef(null);

  const [btnWidth,  setBtnWidth]  = useState(320);
  const [pending,   setPending]   = useState(false);
  const [otpData,   setOtpData]   = useState(null);
  const [error,     setError]     = useState('');
  const [allowed,   setAllowed]   = useState(true);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    // Check origin on client side
    setAllowed(isGoogleOAuthAllowed());
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setBtnWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Don't render if client ID not configured
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') return null;

  // Don't render if accessed via IP address — show friendly message instead
  if (!allowed) {
    return (
      <div className="w-full p-3 rounded-xl text-center"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <p className="text-xs text-yellow-400 font-medium mb-1">
          {lang === 'th' ? '🔒 Google Login ไม่รองรับการเข้าถึงผ่าน IP' : '🔒 Google Login unavailable via IP address'}
        </p>
        <p className="text-xs text-yellow-700">
          {lang === 'th'
            ? 'กรุณาใช้ Email/Password ด้านล่าง หรือเปิดผ่าน localhost'
            : 'Please use Email/Password below, or open via localhost'}
        </p>
      </div>
    );
  }

  const handleSuccess = async (res) => {
    setError('');
    setPending(true);
    try {
      const result = await loginWithGoogle(res.credential);
      if (result?.requiresOtp) {
        setOtpData({ email: result.email, name: result.name });
      } else {
        router.push('/lobby');
      }
    } catch (err) {
      setError(err.message || (lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'));
    } finally {
      setPending(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {otpData && (
        <OTPModal
          email={otpData.email}
          name={otpData.name}
          lang={lang}
          onSuccess={() => router.push('/lobby')}
          onCancel={() => setOtpData(null)}
        />
      )}

      <div
        ref={wrapRef}
        className="w-full overflow-hidden"
        style={{ opacity: pending ? 0.55 : 1, pointerEvents: pending ? 'none' : 'auto' }}
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError(lang === 'th' ? 'Google login ล้มเหลว' : 'Google login failed')}
          width={btnWidth}
          theme="filled_black"
          size="large"
          text="continue_with"
          shape="rectangular"
          locale={lang === 'th' ? 'th' : 'en'}
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center mt-2 anim-fade-in">{error}</p>
      )}
    </GoogleOAuthProvider>
  );
}
