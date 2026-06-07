'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Mic, MicOff, X, Shuffle, Wifi, WifiOff, RefreshCw, SwitchCamera } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const BAR_COUNT = 18;

export default function PreMatchModal({ lang, gameName, onConfirm, onCancel }) {
  const { connected } = useSocket();

  const videoRef    = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef     = useRef(null);
  const streamRef   = useRef(null);

  const [cameraOk,      setCameraOk]      = useState(false);
  const [micLevel,      setMicLevel]      = useState(0);
  const [micOk,         setMicOk]         = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [camError,      setCamError]      = useState('');
  const [facingMode,    setFacingMode]    = useState('user');
  const [hasFlipCamera, setHasFlipCamera] = useState(false);
  const [flipping,      setFlipping]      = useState(false);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devs => setHasFlipCamera(devs.filter(d => d.kind === 'videoinput').length > 1))
      .catch(() => {});
  }, []);

  const startMedia = useCallback(async (facing = 'user') => {
    // Stop existing stream first
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}

    setLoading(true); setCamError(''); setCameraOk(false); setMicLevel(0); setMicOk(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width:     { ideal: 1280 },
          height:    { ideal: 720  },
          frameRate: { ideal: 30   },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOk(stream.getVideoTracks().length > 0);

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS Safari suspends AudioContext until user gesture — resume immediately
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.7;
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
      setCamError(err.name === 'NotAllowedError'
        ? (lang === 'th' ? 'กรุณาอนุญาตกล้อง/ไมค์ในเบราว์เซอร์' : 'Allow camera/mic in browser settings')
        : (lang === 'th' ? 'ไม่พบกล้อง — สามารถจับคู่ได้โดยไม่มีกล้อง' : 'No camera — you can still match without it'));
    }
  }, [lang]);

  // Centralized cleanup — prevents double-close of AudioContext
  const cleanupMedia = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (audioCtxRef.current) {
      // Null FIRST to prevent double-close from useEffect cleanup
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      ctx.close().catch(() => {}); // handle async rejection silently
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startMedia();
    return cleanupMedia; // cleanup on unmount
  }, [startMedia, cleanupMedia]);

  const handleConfirm = () => {
    cleanupMedia(); // cleanup BEFORE onConfirm to prevent React re-render conflict
    onConfirm();
  };

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const threshold = (i / BAR_COUNT) * 100;
    const lit = micLevel > threshold;
    const color = i < BAR_COUNT * 0.5 ? '#4ade80' : i < BAR_COUNT * 0.75 ? '#fbbf24' : '#f87171';
    return { lit, color };
  });

  // Ready = socket connected (camera is optional — don't block matching if no camera)
  const canConfirm = connected && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

      <div className="anim-slide-up sm:anim-scale-in w-full sm:max-w-md card overflow-hidden"
        style={{ background: 'rgba(10,10,22,0.98)', borderColor: 'rgba(124,58,237,0.3)',
          borderRadius: '20px 20px 0 0', paddingBottom: 'var(--safe-bottom, 0px)' }}>

        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="font-bold text-white text-base">
              🎮 {lang === 'th' ? 'ทดสอบอุปกรณ์ก่อนเล่น' : 'Device Check Before Playing'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{lang === 'th' ? `เกม: ${gameName}` : `Game: ${gameName}`}</p>
          </div>
          <button onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">

          {/* Server connection status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium`}
            style={connected
              ? { background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }
              : { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
            {connected
              ? <><Wifi size={11} /> {lang === 'th' ? 'เซิร์ฟเวอร์พร้อม ✓' : 'Server ready ✓'}</>
              : <><WifiOff size={11} className="animate-pulse" /> {lang === 'th' ? 'กำลังเชื่อมต่อ...' : 'Connecting...'}</>}
          </div>

          {/* Camera preview */}
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />

            {/* Camera status badge */}
            {!loading && (
              <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold
                ${cameraOk ? 'bg-green-900/80 text-green-300 border border-green-700/40' : 'bg-red-900/80 text-red-300 border border-red-700/40'}`}>
                {cameraOk ? <Camera size={9} /> : <CameraOff size={9} />}
                {cameraOk ? (lang === 'th' ? 'กล้องพร้อม' : 'Camera OK') : (lang === 'th' ? 'ไม่มีกล้อง' : 'No Camera')}
              </div>
            )}

            {/* Flip camera button */}
            {hasFlipCamera && !loading && (
              <button
                disabled={flipping}
                onClick={async () => {
                  const next = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(next);
                  setFlipping(true);
                  await startMedia(next);
                  setFlipping(false);
                }}
                title={lang === 'th' ? 'สลับกล้อง' : 'Flip camera'}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {flipping
                  ? <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <SwitchCamera size={14} className="text-white" />}
              </button>
            )}

            {/* Retry button */}
            {!loading && camError && (
              <button onClick={() => startMedia(facingMode)}
                className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white transition"
                style={{ background: 'rgba(124,58,237,0.5)', border: '1px solid rgba(124,58,237,0.4)' }}>
                <RefreshCw size={9} /> {lang === 'th' ? 'ลองใหม่' : 'Retry'}
              </button>
            )}
          </div>

          {/* Camera error (non-blocking info) */}
          {camError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <span className="text-blue-400 text-xs flex-shrink-0 mt-0.5">ℹ</span>
              <p className="text-xs text-blue-300">{camError}</p>
            </div>
          )}

          {/* Mic meter */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                  ${micOk ? 'bg-green-500/15 border border-green-500/25' : 'bg-slate-800 border border-slate-700'}`}>
                  {micOk ? <Mic size={11} className="text-green-400" /> : <MicOff size={11} className="text-slate-600" />}
                </div>
                <span className="text-xs font-medium text-white">{lang === 'th' ? 'ไมโครโฟน' : 'Microphone'}</span>
              </div>
              <span className={`badge text-[9px] ${micOk ? 'badge-green' : ''}`}
                style={!micOk ? { background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' } : {}}>
                {micOk ? (lang === 'th' ? 'รับเสียง ✓' : 'Active ✓') : (lang === 'th' ? 'เงียบ' : 'Silent')}
              </span>
            </div>
            <div className="flex items-end gap-[2px]" style={{ height: '22px' }}
              role="meter" aria-label={lang === 'th' ? 'ระดับเสียงไมโครโฟน' : 'Microphone level'}
              aria-valuenow={Math.round(micLevel)} aria-valuemin={0} aria-valuemax={100}>
              {bars.map(({ lit, color }, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                  style={{ background: lit ? color : 'rgba(255,255,255,0.06)', height: `${30 + (i / BAR_COUNT) * 70}%`, opacity: lit ? 1 : 0.4 }} />
              ))}
            </div>
            {!loading && !camError && (
              <p className="text-[10px] text-slate-700 text-center mt-1">
                {lang === 'th' ? 'พูดอะไรก็ได้เพื่อทดสอบ' : 'Say something to test'}
              </p>
            )}
          </div>

          {/* Privacy notice — video P2P, no recording */}
          <div className="flex items-start gap-2 px-2 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-slate-600 flex-shrink-0 text-[10px] mt-0.5">🔒</span>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              {lang === 'th'
                ? 'วิดีโอและเสียงเป็นแบบ Peer-to-Peer โดยตรง — ระบบไม่บันทึกและไม่จัดเก็บ ห้ามบันทึกหน้าจอผู้เล่นอื่นโดยไม่ได้รับอนุญาต'
                : 'Video & audio are Peer-to-Peer — not recorded or stored by the system. Do not record other players without consent.'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} className="btn-ghost flex-1 py-3 rounded-xl text-sm">
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button onClick={handleConfirm} disabled={!canConfirm}
              className={`btn-primary flex-1 py-3 rounded-xl text-sm gap-2 ${!canConfirm ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <Shuffle size={14} />
              {!connected
                ? (lang === 'th' ? 'รอเซิร์ฟเวอร์...' : 'Connecting...')
                : loading
                  ? (lang === 'th' ? 'เปิดกล้อง...' : 'Opening...')
                  : (lang === 'th' ? 'พร้อม → จับคู่!' : 'Ready → Match!')}
            </button>
          </div>

          {canConfirm && !cameraOk && (
            <p className="text-[10px] text-slate-600 text-center">
              {lang === 'th' ? '💡 สามารถจับคู่ได้แม้ไม่มีกล้อง' : '💡 You can match without a camera'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
