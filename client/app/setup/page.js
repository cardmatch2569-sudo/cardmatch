'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Camera, CameraOff, Mic, MicOff, Volume2,
  CheckCircle, XCircle, RefreshCw, ArrowRight,
  AlertTriangle, Play, Settings, SwitchCamera,
} from 'lucide-react';

const BAR_COUNT = 20;

export default function SetupPage() {
  const { user, loading: authLoading, lang } = useAuth();
  const router = useRouter();

  const videoRef     = useRef(null);
  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);
  const animRef      = useRef(null);
  const streamRef    = useRef(null);

  const [cameraDevices, setCameraDevices] = useState([]);
  const [micDevices,    setMicDevices]    = useState([]);
  const [selCamera,     setSelCamera]     = useState('');
  const [selMic,        setSelMic]        = useState('');

  const [cameraOk,    setCameraOk]    = useState(false);
  const [micOk,       setMicOk]       = useState(false);
  const [micLevel,    setMicLevel]    = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [speakerTest, setSpeakerTest] = useState(false);
  const [allReady,    setAllReady]    = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(list.filter(d => d.kind === 'videoinput'));
      setMicDevices(list.filter(d => d.kind === 'audioinput'));
    } catch {}
  }, []);

  const startMedia = useCallback(async (cameraId, micId) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    streamRef.current?.getTracks().forEach(t => t.stop());

    setLoading(true); setError(''); setCameraOk(false); setMicOk(false); setMicLevel(0);

    // Check if browser can access camera (requires HTTPS or localhost)
    const isSecure = location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';

    if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
      setLoading(false);
      setError(
        lang === 'th'
          ? `❌ กล้องต้องการการเชื่อมต่อที่ปลอดภัย\n\nกรุณาเปิดผ่าน http://localhost:3000\nหรือเปิดใช้งานใน Chrome:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure\nแล้วเพิ่ม http://${location.hostname}:${location.port}`
          : `❌ Camera requires a secure connection\n\nPlease open via http://localhost:3000\nOr enable in Chrome:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure\nAdd: http://${location.hostname}:${location.port}`
      );
      return;
    }

    try {
      const hdBase = { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, min: 15 } };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId }, ...hdBase } : { facingMode: 'user', ...hdBase },
        audio: micId    ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true }
                        : { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOk(stream.getVideoTracks().length > 0);

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx; analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg   = data.slice(2, 60).reduce((a, b) => a + b, 0) / 58;
        const level = Math.min(100, avg * 2.2);
        setMicLevel(level); setMicOk(level > 3);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
      await loadDevices();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.name === 'NotAllowedError'
        ? (lang === 'th' ? '❌ กรุณาอนุญาตการเข้าถึงกล้องและไมค์ในเบราว์เซอร์' : '❌ Please allow camera & mic access')
        : err.name === 'NotFoundError'
          ? (lang === 'th' ? '❌ ไม่พบกล้องหรือไมค์' : '❌ No camera or mic found')
          : `❌ ${err.message}`);
    }
  }, [lang, loadDevices]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) startMedia('', '');
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [authLoading, user, router, startMedia]);

  useEffect(() => { setAllReady(cameraOk && micLevel > 3); }, [cameraOk, micLevel]);

  const testSpeaker = () => {
    if (speakerTest) return;
    setSpeakerTest(true);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
      // Bug fix: close AudioContext after sound ends to prevent hitting browser limit (6 max)
      osc.addEventListener('ended', () => { try { ctx.close(); } catch {} });
    } catch {}
    setTimeout(() => setSpeakerTest(false), 900);
  };

  const goToLobby = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
    router.push('/lobby');
  };

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const threshold = (i / BAR_COUNT) * 100;
    const lit = micLevel > threshold;
    const color = i < BAR_COUNT * 0.5 ? '#4ade80' : i < BAR_COUNT * 0.75 ? '#fbbf24' : '#f87171';
    return { lit, color };
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">

      {/* Header */}
      <div className="text-center mb-6 md:mb-10 anim-fade-up">
        <div className="inline-flex w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 items-center justify-center mb-3 shadow-xl shadow-purple-900/40">
          <Settings size={22} className="text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          {lang === 'th' ? 'ทดสอบอุปกรณ์' : 'Device Setup'}
        </h1>
        <p className="text-slate-500 text-sm">
          {lang === 'th' ? 'ตรวจสอบกล้องและไมโครโฟนก่อนเริ่มเล่น' : 'Check camera and mic before playing'}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="anim-fade-up flex items-start gap-3 p-4 rounded-xl mb-5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {error.split('\n').map((line, i) => (
              <p key={i} className={`text-sm ${i === 0 ? 'text-red-300 font-medium' : 'text-red-400/70 mt-1'}`}>{line}</p>
            ))}
            <button onClick={() => startMedia(selCamera, selMic)}
              className="mt-2 text-xs text-red-400 hover:text-red-200 flex items-center gap-1 transition">
              <RefreshCw size={11} /> {lang === 'th' ? 'ลองใหม่' : 'Try again'}
            </button>
          </div>
        </div>
      )}

      {/* Grid: stacks on mobile, side-by-side on desktop */}
      <div className="grid md:grid-cols-5 gap-4 md:gap-5">

        {/* Camera (full width mobile, 3/5 desktop) */}
        <div className="md:col-span-3 space-y-3">
          {/* On mobile portrait, use 4:3 ratio — taller and more useful */}
          <div className="card overflow-hidden relative bg-black"
            style={{ aspectRatio: 'var(--camera-ratio, 4/3)' }}
            ref={el => {
              if (el) {
                const isPortrait = window.innerHeight > window.innerWidth;
                el.style.setProperty('--camera-ratio', isPortrait ? '4/3' : '16/9');
              }
            }}>
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <RefreshCw size={22} className="text-slate-600 animate-spin mb-2" />
                <p className="text-slate-600 text-sm">{lang === 'th' ? 'เปิดกล้อง...' : 'Opening...'}</p>
              </div>
            )}
            {!loading && !cameraOk && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <CameraOff size={36} className="text-slate-700 mb-2" />
                <p className="text-slate-600 text-sm">{lang === 'th' ? 'ไม่พบกล้อง' : 'No camera'}</p>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} />
            {!loading && (
              <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold
                ${cameraOk ? 'bg-green-900/80 text-green-300 border border-green-700/40' : 'bg-red-900/80 text-red-300 border border-red-700/40'}`}>
                {cameraOk ? <CheckCircle size={10} /> : <XCircle size={10} />}
                {cameraOk ? (lang === 'th' ? 'กล้องพร้อม' : 'Camera OK') : (lang === 'th' ? 'ไม่มีกล้อง' : 'No Camera')}
              </div>
            )}
            {/* Flip camera button — only when multiple cameras available */}
            {cameraDevices.length > 1 && !loading && (
              <button
                onClick={() => {
                  const idx = cameraDevices.findIndex(d => d.deviceId === selCamera);
                  const next = cameraDevices[(idx + 1) % cameraDevices.length];
                  setSelCamera(next.deviceId);
                  startMedia(next.deviceId, selMic);
                }}
                title={lang === 'th' ? 'สลับกล้อง' : 'Flip camera'}
                className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <SwitchCamera size={16} className="text-white" />
              </button>
            )}
          </div>

          {/* Camera selector */}
          <div>
            <label className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-1.5">
              <Camera size={11} />{lang === 'th' ? 'เลือกกล้อง' : 'Camera'}
            </label>
            <select value={selCamera} onChange={e => { setSelCamera(e.target.value); startMedia(e.target.value, selMic); }}
              className="input-base text-sm py-2">
              <option value="">{lang === 'th' ? 'กล้องเริ่มต้น' : 'Default camera'}</option>
              {cameraDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right panel: Mic + Speaker (full width mobile, 2/5 desktop) */}
        <div className="md:col-span-2 space-y-4">

          {/* Mic card */}
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                  ${micOk ? 'bg-green-500/15 border border-green-500/25' : 'bg-slate-800 border border-slate-700'}`}>
                  {micOk ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-slate-600" />}
                </div>
                <span className="text-sm font-semibold text-white">{lang === 'th' ? 'ไมโครโฟน' : 'Microphone'}</span>
              </div>
              <span className={`badge text-xs ${micOk ? 'badge-green' : ''}`}
                style={!micOk ? { background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)' } : {}}>
                {micOk ? (lang === 'th' ? 'รับเสียง ✓' : 'Active ✓') : (lang === 'th' ? 'เงียบ' : 'Silence')}
              </span>
            </div>

            {/* Level bars */}
            <div className="flex items-end gap-[2px] mb-2" style={{ height: '40px' }}>
              {bars.map(({ lit, color }, i) => (
                <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                  style={{ background: lit ? color : 'rgba(255,255,255,0.06)', height: `${30 + (i / BAR_COUNT) * 70}%`, opacity: lit ? 1 : 0.4 }} />
              ))}
            </div>
            <p className="text-xs text-slate-700 text-center">{lang === 'th' ? 'พูดอะไรก็ได้เพื่อทดสอบ' : 'Say something to test'}</p>

            {/* Mic selector */}
            <div className="mt-3">
              <select value={selMic} onChange={e => { setSelMic(e.target.value); startMedia(selCamera, e.target.value); }}
                className="input-base text-xs py-1.5">
                <option value="">{lang === 'th' ? 'ไมค์เริ่มต้น' : 'Default mic'}</option>
                {micDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Speaker test */}
          <div className="card p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
                <Volume2 size={14} className="text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-white">{lang === 'th' ? 'ลำโพง' : 'Speaker'}</span>
            </div>
            <button onClick={testSpeaker} disabled={speakerTest}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: speakerTest ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
              <Play size={14} className={speakerTest ? 'animate-pulse' : ''} />
              {speakerTest ? (lang === 'th' ? 'กำลังเล่น...' : 'Playing...') : (lang === 'th' ? 'ทดสอบเสียง' : 'Test Sound')}
            </button>
          </div>

          {/* Tips — hidden on mobile to save space */}
          <div className="hidden md:block p-4 rounded-xl"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <p className="text-xs text-purple-300 font-semibold mb-2">💡 {lang === 'th' ? 'เคล็ดลับ' : 'Tips'}</p>
            <ul className="text-xs text-slate-500 space-y-1">
              {(lang === 'th'
                ? ['วางกล้องให้หน้าของคุณอยู่กลางภาพ', 'ใช้ในที่มีแสงสว่างเพียงพอ', 'วางการ์ดให้กล้องมองเห็นชัด']
                : ['Center your face in the frame', 'Ensure good lighting', 'Keep cards visible to camera']
              ).map((tip, i) => <li key={i} className="flex gap-1.5"><span className="text-purple-600">•</span>{tip}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Status + CTA */}
      <div className="mt-5 card p-4 md:p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Status */}
          <div className="flex items-center gap-4">
            {[
              { ok: cameraOk, icon: cameraOk ? <Camera size={14} /> : <CameraOff size={14} />, label: lang === 'th' ? 'กล้อง' : 'Camera' },
              { ok: micOk,    icon: micOk    ? <Mic size={14} />    : <MicOff size={14} />,    label: lang === 'th' ? 'ไมค์' : 'Mic' },
            ].map(({ ok, icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center
                  ${ok ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-600 border border-slate-700'}`}>
                  {icon}
                </div>
                <div>
                  <div className={`font-semibold text-sm ${ok ? 'text-green-400' : 'text-slate-600'}`}>{label}</div>
                  <div className="text-xs" style={{ color: ok ? '#4ade80aa' : '#475569' }}>
                    {ok ? (lang === 'th' ? 'พร้อม ✓' : 'Ready ✓') : (lang === 'th' ? 'ตรวจสอบ' : 'Check')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => startMedia(selCamera, selMic)}
              className="btn-ghost flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm gap-1.5" style={{ minHeight: '44px' }}>
              <RefreshCw size={14} />{lang === 'th' ? 'รีเซ็ต' : 'Reset'}
            </button>
            <button onClick={goToLobby}
              className={`btn-primary flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm gap-2 ${!allReady ? 'opacity-75' : ''}`}>
              {allReady ? <CheckCircle size={14} /> : <ArrowRight size={14} />}
              <span className="truncate">
                {lang === 'th' ? (allReady ? 'พร้อม → ล็อบบี้' : 'ข้าม → ล็อบบี้') : (allReady ? 'Ready → Lobby' : 'Skip → Lobby')}
              </span>
            </button>
          </div>
        </div>

        {!allReady && !error && !loading && (
          <p className="text-xs text-slate-700 text-center mt-3">
            {lang === 'th' ? '⚠️ ตรวจสอบการอนุญาตกล้อง/ไมค์ในเบราว์เซอร์' : '⚠️ Check browser permissions for camera & mic'}
          </p>
        )}
      </div>
    </div>
  );
}
