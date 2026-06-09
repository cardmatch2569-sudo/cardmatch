'use client';
import { useEffect, Component } from 'react';

// De-duplicate: at most 1 report per 10s per unique message
const reported = new Map();
const canReport = (key) => {
  const now = Date.now();
  if (now - (reported.get(key) || 0) < 10000) return false;
  reported.set(key, now);
  return true;
};

const sendError = async (event, message, stack = '', url = '', metadata = {}) => {
  const key = `${event}:${String(message).slice(0, 80)}`;
  if (!canReport(key)) return;
  try {
    const token =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cg_token')) ||
      (typeof localStorage   !== 'undefined' && localStorage.getItem('cg_token'));
    if (!token) return; // only report for authenticated users
    const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';
    fetch(`${BASE}/api/errors/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        event,
        message: String(message).slice(0, 500),
        stack:   String(stack).slice(0, 2000),
        url:     url || (typeof window !== 'undefined' ? window.location.pathname : ''),
        metadata,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
};

// Attaches window.onerror + unhandledrejection listeners
function GlobalErrorCapture() {
  useEffect(() => {
    const onError = (e) => {
      sendError('uncaught_error', e.message || 'Unknown error', e.error?.stack || '', e.filename || '');
    };
    const onUnhandled = (e) => {
      const r = e.reason;
      sendError(
        'unhandled_rejection',
        r instanceof Error ? r.message : String(r),
        r instanceof Error ? r.stack  : '',
      );
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);
  return null;
}

// Class component — required for React Error Boundary (hooks can't catch render errors)
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    sendError('react_boundary', error.message, (error.stack || '') + '\n' + (info?.componentStack || ''));
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#07070f', color: '#f87171', textAlign: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '2.5rem' }}>⚠️</div>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>เกิดข้อผิดพลาดที่ไม่คาดคิด</p>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>An unexpected error occurred</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: '0.5rem', padding: '0.6rem 1.5rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          รีเฟรชหน้า / Refresh
        </button>
      </div>
    );
  }
}

export default function ErrorLogger({ children }) {
  return (
    <>
      <GlobalErrorCapture />
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
}
