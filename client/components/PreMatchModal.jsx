'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, X, Shuffle, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const BAR_COUNT = 16;

export default function PreMatchModal({ lang, gameName, onConfirm, onCancel }) {
  const { connected } = useSocket();
  const videoRef    = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef     = useRef(null);
  const streamRef   = useRef(null);

  const [cameraOk,  setCameraOk]  = useState(false);
  const [micLevel,  setMicLevel]  = useState(0);
  const [micOk,     setMicOk]     = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const startMedia = useCallback(async () => {
    setLoading(true); setError('');

    const isSecure = location.protocol === 'https:' ||
      location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
      setLoading(false);
      setError(lang === 'th'
        ? 'กล้องต้องการ HTTPS — เปิดผ่าน cardmatch-phi.vercel.app'
        : 'Camera requires HTTPS — open via cardmatch-phi.vercel.app');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOk(stream.getVideoTracks().length > 0);

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx; analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg   = data.slice(2, 40).reduce((a, b) => a + b, 0) / 38;
        const level = Math.min(100, avg * 2.5);
        setMicLevel(level); setMicOk(level > 3);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.name === 'NotAllowedError'
        ? (lang === 'th' ? 'กรุณาอนุญาตการเข้าถึงกล้องและไมค์' : 'Please allow camera & mic access')
        : (lang === 'th' ? `ข้อผิดพลาด: ${err.message}` : `Error: ${err.message}`));
    }
  }, [lang]);

  useEffect(() => {
    startMedia();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startMedia]);

  const handleConfirm = () => {
    // Stop all tracks — room page will start its own stream
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    onConfirm();
  };

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const threshold = (i / BAR_COUNT) * 100;
    const lit = micLevel > threshold;
    const color = i < BAR_COUNT * 0.5 ? '#4ade80' : i < BAR_COUNT * 0.75 ? '#fbbf24' : '#f87171';
    return { lit, color };
  });

  // Ready = camera OK + mic OK + socket connected (all 3 required)
  const ready = cameraOk && micOk && connected;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

      <div className="anim-slide-up sm:anim-scale-in w-full sm:max-w-md card overflow-hidden"
        style={{ background: 'rgba(10,10,22,0.98)', borderColor: 'rgba(124,58,237,0.3)',
          borderRadius: '20px 20px 0 0', paddingBottom: 'var(--safe-bottom, 0px)' }}
        onClick={e => e.stopPropagation()}>

        {/* Purple bar */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="font-bold text-white text-base">
              {lang === 'th' ? '🎮 ตรวจสอบอุปกรณ์ก่อนเข้าเล่น' : '🎮 Device Check Before Playing'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'th' ? `เกม: ${gameName}` : `Game: ${gameName}`}
            </p>
          </div>
          <button onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl anim-fade-in"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Camera preview */}
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} />
            {!loading && (
              <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold
                ${cameraOk ? 'bg-green-900/80 text-green-300 border border-green-700/40' : 'bg-red-900/80 text-red-300 border border-red-700/40'}`}>
                {cameraOk ? <Camera size={10} /> : <CameraOff size={10} />}
                {cameraOk ? (lang === 'th' ? 'กล้องพร้อม' : 'Camera OK') : (lang === 'th' ? 'ไม่มีกล้อง' : 'No Camera')}
              </div>
            )}
          </div>

          {/* Socket connection status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium`}
            style={connected
              ? { background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }
              : { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
            {connected
              ? <><Wifi size={12} /> {lang === 'th' ? 'เซิร์ฟเวอร์: เชื่อมต่อแล้ว ✓' : 'Server: Connected ✓'}</>
              : <><WifiOff size={12} className="animate-pulse" /> {lang === 'th' ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์...' : 'Connecting to server...'}</>}
          </div>

          {/* Mic meter */}
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                ${micOk ? 'bg-green-500/15 border border-green-500/25' : 'bg-slate-800 border border-slate-700'}`}>
                {micOk ? <Mic size={13} className="text-green-400" /> : <MicOff size={13} className="text-slate-600" />}
              </div>
              <span className="text-sm font-medium text-white">
                {lang === 'th' ? 'ไมโครโฟน' : 'Microphone'}
              </span>
              <span className={`ml-auto badge text-[10px] ${micOk ? 'badge-green' : ''}`}
                style={!micOk ? { background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' } : {}}>
                {micOk ? (lang === 'th' ? 'รับเสียง ✓' : 'Active ✓') : (lang === 'th' ? 'เงียบ' : 'Silent')}
              </span>
            </div>
            <div className="flex items-end gap-[2px]" style={{ height: '28px' }}>
              {bars.map(({ lit, color }, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                  style={{ background: lit ? color : 'rgba(255,255,255,0.06)', height: `${30 + (i / BAR_COUNT) * 70}%`, opacity: lit ? 1 : 0.4 }} />
              ))}
            </div>
            <p className="text-[10px] text-slate-700 text-center mt-1.5">
              {lang === 'th' ? 'พูดอะไรก็ได้เพื่อทดสอบ' : 'Say something to test'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="btn-ghost flex-1 py-3 rounded-xl text-sm">
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button onClick={handleConfirm}
              disabled={!ready || loading}
              className={`btn-primary flex-1 py-3 rounded-xl text-sm gap-2 ${(!ready || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Shuffle size={15} />
              {ready
                ? (lang === 'th' ? 'พร้อม → จับคู่เลย!' : 'Ready → Find Match!')
                : (lang === 'th' ? 'รอตรวจสอบอุปกรณ์...' : 'Checking devices...')}
            </button>
          </div>

          {!ready && !error && !loading && (
            <p className="text-xs text-slate-600 text-center">
              {!connected
                ? (lang === 'th' ? '⏳ รอการเชื่อมต่อเซิร์ฟเวอร์...' : '⏳ Waiting for server connection...')
                : (!cameraOk || !micOk)
                  ? (lang === 'th' ? '⚠️ กล้องหรือไมค์ยังไม่พร้อม — ตรวจสอบการอนุญาตใน browser' : '⚠️ Camera or mic not ready — check browser permissions')
                  : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
