'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import translations from '../../../lib/translations';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Send,
  MessageSquare, ChevronDown, Wifi, WifiOff, Maximize2, Minimize2, RotateCw, SwitchCamera,
} from 'lucide-react';

// Returns absolute-position + size style for a full-screen rotated video element
function fullscreenRotateStyle(deg) {
  const r = ((deg % 360) + 360) % 360;
  if (r === 0)   return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  if (r === 180) return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'rotate(180deg)' };
  // 90° or 270° — swap vw/vh so video still fills the viewport after rotation
  return { position: 'absolute', width: '100vh', height: '100vw', top: '50%', left: '50%', objectFit: 'cover', transform: `translate(-50%,-50%) rotate(${r}deg)` };
}

function ChatPanel({ messages, msgInput, setMsgInput, onSend, onClose, user, lang, chatEndRef }) {
  const t = translations[lang];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">{t.chat}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
          <ChevronDown size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-700 mt-8">
            {lang === 'th' ? 'ยังไม่มีข้อความ' : 'No messages yet'}
          </p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.from._id === user._id;
          return (
            <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                ${isMe ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-slate-200'}`}
                style={isMe
                  ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {msg.message}
              </div>
              <span className="text-[10px] text-slate-700 mt-0.5 px-1">{msg.from.username}</span>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <input type="text" value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300)}
            placeholder={t.typeMessage}
            className="input-base text-sm flex-1 py-2" style={{ minHeight: '44px' }}
            enterKeyHint="send" />
          <button onClick={onSend} disabled={!msgInput.trim()}
            className="w-11 h-11 rounded-lg flex items-center justify-center transition flex-shrink-0 disabled:opacity-40"
            style={{ background: 'rgba(124,58,237,0.8)', color: 'white' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { id: roomId } = useParams();
  const { user, loading, lang } = useAuth();
  const { getSocket } = useSocket();
  const router = useRouter();
  const t = translations[lang];

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const localStreamRef = useRef(null);
  const leftRef        = useRef(false);
  const chatOpenRef    = useRef(false);

  const [messages,      setMessages]      = useState([]);
  const [msgInput,      setMsgInput]      = useState('');
  const [cameraOn,      setCameraOn]      = useState(true);
  const [micOn,         setMicOn]         = useState(true);
  const [partnerLeft,   setPartnerLeft]   = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [mediaError,    setMediaError]    = useState('');
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [forcedLandscape, setForcedLandscape] = useState(false);
  // Track system orientation to avoid double-rotation when iOS auto-rotates
  const [systemLandscape, setSystemLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  );
  // Track remote video orientation to counter-rotate if needed
  const [remoteIsLandscape, setRemoteIsLandscape] = useState(false);
  // Manual rotation offsets (multiples of 90°) — user can adjust each independently
  const [remoteRotation, setRemoteRotation] = useState(0);
  const [localRotation,  setLocalRotation]  = useState(0);
  // Camera flip (front/back)
  const [facingMode,      setFacingMode]      = useState('user');
  const [hasFlipCamera,   setHasFlipCamera]   = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      setUnread(0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [chatOpen]);

  // Sync fullscreen state with browser
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Detect system orientation — cancel CSS rotation if device is already landscape
  useEffect(() => {
    const onResize = () => setSystemLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Detect if device has multiple cameras (front + back)
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devs => setHasFlipCamera(devs.filter(d => d.kind === 'videoinput').length > 1))
      .catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(async () => {
    // Exit forced-landscape CSS mode first
    if (forcedLandscape) { setForcedLandscape(false); return; }
    // Exit native fullscreen
    if (document.fullscreenElement) {
      await document.exitFullscreen?.().catch(() => {});
      screen.orientation?.unlock?.();
      return;
    }
    // Try native fullscreen API (desktop + Android Chrome)
    try {
      if (!document.documentElement.requestFullscreen) throw new Error('no-api');
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape').catch(() => {});
    } catch {
      // iOS Safari fallback: rotate the whole container 90° via CSS
      setForcedLandscape(true);
    }
  }, [forcedLandscape]);

  const startMedia = useCallback(async () => {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
      setMediaError(lang === 'th'
        ? `กล้องต้องการการเชื่อมต่อที่ปลอดภัย\nกรุณาเปิดผ่าน http://localhost:3000`
        : `Camera requires a secure connection\nOpen via http://localhost:3000`);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMediaError('');
      return stream;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? (lang === 'th' ? 'กรุณาอนุญาตการเข้าถึงกล้องและไมค์' : 'Please allow camera & mic access')
        : err.name === 'NotFoundError'
          ? (lang === 'th' ? 'ไม่พบกล้องหรือไมค์' : 'No camera or mic found')
          : (lang === 'th' ? `เปิดกล้องไม่ได้: ${err.message}` : `Camera error: ${err.message}`);
      setMediaError(msg);
      return null;
    }
  }, [lang]);

  const createPeer = useCallback((initiator, stream) => {
    const socket = getSocket();
    if (!socket || !stream) return null;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      ],
      iceCandidatePoolSize: 10,
    });
    stream.getTracks().forEach(tk => pc.addTrack(tk, stream));
    pc.onicecandidate = ({ candidate }) => { if (candidate) socket.emit('ice_candidate', { roomId, candidate }); };
    pc.ontrack = ({ streams }) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
        remoteVideoRef.current.onloadedmetadata = () => {
          const v = remoteVideoRef.current;
          if (v) setRemoteIsLandscape(v.videoWidth > v.videoHeight);
        };
      }
      setPeerConnected(true);
    };
    pc.onconnectionstatechange = () => { if (['disconnected','failed'].includes(pc.connectionState)) setPeerConnected(false); };
    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { roomId, offer });
        } catch (e) { console.warn('[WebRTC] createOffer failed:', e.message); }
      })();
    }
    peerRef.current = pc;
    return pc;
  }, [roomId, getSocket]);

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const init = async () => { await startMedia(); socket.emit('join_room', { roomId }); };
    const onPeerJoined = () => createPeer(true, localStreamRef.current);
    const onOffer = async ({ offer }) => {
      if (!peerRef.current) createPeer(false, localStreamRef.current);
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    };
    const onAnswer = async ({ answer }) => { if (peerRef.current) await peerRef.current.setRemoteDescription(answer); };
    const onIce = async ({ candidate }) => { try { if (peerRef.current && candidate) await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {} };
    const onMessage = (msg) => {
      setMessages(p => [...p, msg]);
      setUnread(p => chatOpenRef.current ? 0 : p + 1);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };
    const onPartnerLeft = () => {
      setPartnerLeft(true);
      setPeerConnected(false);
      if (remoteVideoRef.current) {
        const s = remoteVideoRef.current.srcObject;
        if (s) s.getTracks().forEach(tk => tk.stop());
        remoteVideoRef.current.srcObject = null;
      }
    };

    socket.on('peer_joined', onPeerJoined); socket.on('offer', onOffer); socket.on('answer', onAnswer);
    socket.on('ice_candidate', onIce); socket.on('message_received', onMessage); socket.on('partner_disconnected', onPartnerLeft);
    init();

    return () => {
      socket.off('peer_joined', onPeerJoined); socket.off('offer', onOffer); socket.off('answer', onAnswer);
      socket.off('ice_candidate', onIce); socket.off('message_received', onMessage); socket.off('partner_disconnected', onPartnerLeft);
      localStreamRef.current?.getTracks().forEach(tk => tk.stop());
      if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
      if (!leftRef.current) socket.emit('leave_room', { roomId });
    };
  }, [loading, user, roomId, router, getSocket, startMedia, createPeer]);

  const handleLeave = () => {
    leftRef.current = true;
    setForcedLandscape(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    getSocket()?.emit('leave_room', { roomId });
    localStreamRef.current?.getTracks().forEach(tk => tk.stop());
    peerRef.current?.close();
    router.push('/lobby');
  };

  const toggleCamera = () => { const tk = localStreamRef.current?.getVideoTracks()[0]; if (tk) { tk.enabled = !tk.enabled; setCameraOn(tk.enabled); } };
  const toggleMic    = () => { const tk = localStreamRef.current?.getAudioTracks()[0];  if (tk) { tk.enabled = !tk.enabled; setMicOn(tk.enabled); } };

  const flipCamera = useCallback(async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    try {
      // Try exact facingMode first, fallback to non-exact for older devices
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      }
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      // Replace track in active peer connection without renegotiation
      if (peerRef.current) {
        const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
      }
      // Stop old video track and swap in new one
      const oldTrack = localStreamRef.current?.getVideoTracks()[0];
      if (oldTrack) { localStreamRef.current.removeTrack(oldTrack); oldTrack.stop(); }
      if (localStreamRef.current) localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next);
      setCameraOn(true);
    } catch (e) { console.warn('[flipCamera]', e.message); }
  }, [facingMode]);
  const sendMessage  = () => { if (!msgInput.trim()) return; getSocket()?.emit('send_message', { roomId, message: msgInput }); setMsgInput(''); };

  if (loading || !user) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  // CSS rotation is active when forced landscape but system hasn't rotated yet
  const cssLandscapeActive = forcedLandscape && !systemLandscape;
  const isExpanded = isFullscreen || forcedLandscape;

  const safeTop    = 'env(safe-area-inset-top,    0px)';
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';
  const safeLeft   = 'env(safe-area-inset-left,   0px)';
  const safeRight  = 'env(safe-area-inset-right,  0px)';

  // cssLandscapeActive → CSS rotate 90°; system already landscape → normal fixed
  return (
    <div className="z-50 bg-black overflow-hidden"
      style={cssLandscapeActive ? {
        position: 'fixed',
        width: '100vh',
        height: '100vw',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(90deg)',
      } : { position: 'fixed', inset: 0 }}>

      {/* ── Opponent video fills the ENTIRE background ── */}
      <video ref={remoteVideoRef} autoPlay playsInline className="object-cover"
        style={fullscreenRotateStyle(
          (cssLandscapeActive && remoteIsLandscape ? -90 : 0) + remoteRotation
        )} />

      {/* Waiting overlay */}
      {!peerConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
          style={{ background: 'radial-gradient(circle at center, #0d0d1a 40%, #000)' }}>
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 anim-float">
            <span className="text-3xl">👤</span>
          </div>
          <p className="text-slate-500 text-sm text-center px-8">{t.waitingForPeer}</p>
          <div className="flex gap-1 mt-3">
            {[0, 0.15, 0.3].map((d, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-600" style={{ animation: `blink 1.2s ease ${d}s infinite` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {mediaError && (
        <div className="absolute z-30 left-3 right-3 p-3 rounded-xl text-xs"
          style={{ top: `calc(52px + max(0px, ${safeTop}))`, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
          <p className="font-semibold">📷 {lang === 'th' ? 'ไม่สามารถเปิดกล้องได้' : 'Cannot access camera'}</p>
          {mediaError.split('\n').map((line, i) => <p key={i} className="text-[11px] mt-0.5 opacity-80">{line}</p>)}
        </div>
      )}
      {partnerLeft && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap"
          style={{ top: `calc(52px + max(0px, ${safeTop}))`, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
          {t.partnerLeft}
        </div>
      )}

      {/* ── TOP BAR — always visible ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between"
        style={{
          paddingTop:   `max(8px, ${safeTop})`,
          paddingBottom: '8px',
          paddingLeft:  `max(12px, ${safeLeft})`,
          paddingRight: `max(12px, ${safeRight})`,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        }}>
        {/* Connection status */}
        <div className={`flex items-center gap-1.5 text-xs font-medium drop-shadow ${peerConnected ? 'text-green-300' : 'text-yellow-300'}`}>
          {peerConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span>{peerConnected ? (lang === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected') : (lang === 'th' ? 'รอการเชื่อมต่อ...' : 'Waiting...')}</span>
        </div>

        <button onClick={toggleFullscreen}
          title={isExpanded ? (lang === 'th' ? 'ออกจากเต็มจอ' : 'Exit fullscreen') : (lang === 'th' ? 'ขยายเต็มจอ' : 'Fullscreen')}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {isExpanded ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
        </button>
      </div>

      {/* ── Opponent label ── */}
      <div className="absolute z-20 badge badge-purple text-xs"
        style={{ bottom: `calc(68px + max(0px, ${safeBottom}))`, left: `max(10px, ${safeLeft})` }}>
        {t.opponent}
      </div>

      {/* ── Self PiP — bottom-right above controls bar ── */}
      <div className="absolute z-20"
        style={{
          bottom: `calc(68px + max(8px, ${safeBottom}))`,
          right:  `max(8px, ${safeRight})`,
          width: 'clamp(80px, 24vw, 150px)',
          aspectRatio: '4/3',
        }}>
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/20 w-full h-full">
          <video ref={localVideoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${(cssLandscapeActive ? -90 : 0) + localRotation}deg)${facingMode === 'user' ? ' scaleX(-1)' : ''}` }} />
          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <VideoOff size={14} className="text-slate-400" />
            </div>
          )}
          <div className="absolute bottom-1 left-1.5 text-[9px] text-slate-300 bg-black/60 px-1 rounded">{t.you}</div>
        </div>
      </div>

      {/* ── CONTROLS BAR — always visible at bottom ── */}
      <div className="absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center gap-3"
        style={{
          paddingTop:    '8px',
          paddingBottom: `max(8px, ${safeBottom})`,
          paddingLeft:   `max(12px, ${safeLeft})`,
          paddingRight:  `max(12px, ${safeRight})`,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}>

        {/* Rotate opponent video */}
        <button onClick={() => setRemoteRotation(r => (r + 90) % 360)}
          title={lang === 'th' ? 'หมุนภาพคู่แข่ง' : 'Rotate opponent'}
          className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 backdrop-blur-sm bg-white/15 text-white border border-white/20">
          <RotateCw size={14} />
          <span className="text-[8px] leading-none opacity-70">{lang === 'th' ? 'คู่แข่ง' : 'Opp'}</span>
        </button>

        <button onClick={toggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm
            ${cameraOn ? 'bg-white/15 text-white border border-white/20' : 'bg-red-600/80 text-white'}`}>
          {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        {/* Flip camera — only shown when device has front+back cameras */}
        {hasFlipCamera && (
          <button onClick={flipCamera}
            title={lang === 'th'
              ? (facingMode === 'user' ? 'สลับกล้องหลัง' : 'สลับกล้องหน้า')
              : (facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera')}
            className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 backdrop-blur-sm bg-white/15 text-white border border-white/20">
            <SwitchCamera size={16} />
            <span className="text-[8px] leading-none opacity-70">
              {facingMode === 'user'
                ? (lang === 'th' ? 'หลัง' : 'Back')
                : (lang === 'th' ? 'หน้า' : 'Front')}
            </span>
          </button>
        )}

        {/* Leave — center, larger */}
        <button onClick={handleLeave}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95 shadow-xl shadow-red-900/50">
          <PhoneOff size={20} />
        </button>

        <button onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm
            ${micOn ? 'bg-white/15 text-white border border-white/20' : 'bg-red-600/80 text-white'}`}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        {/* Rotate own video */}
        <button onClick={() => setLocalRotation(r => (r + 90) % 360)}
          title={lang === 'th' ? 'หมุนกล้องของฉัน' : 'Rotate my camera'}
          className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 backdrop-blur-sm bg-white/15 text-white border border-white/20">
          <RotateCw size={14} />
          <span className="text-[8px] leading-none opacity-70">{lang === 'th' ? 'ของฉัน' : 'Mine'}</span>
        </button>

        <button onClick={() => setChatOpen(p => !p)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm relative
            ${chatOpen ? 'bg-purple-500/50 text-purple-200 border border-purple-500/50' : 'bg-white/15 text-white border border-white/20'}`}>
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Desktop sidebar chat ── */}
      {chatOpen && (
        <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-72 flex-col border-l z-30"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(7,7,15,0.97)', paddingTop: `max(0px, ${safeTop})` }}>
          <ChatPanel
            messages={messages} msgInput={msgInput} setMsgInput={setMsgInput}
            onSend={sendMessage} onClose={() => setChatOpen(false)}
            user={user} lang={lang} chatEndRef={chatEndRef}
          />
        </div>
      )}

      {/* ── Mobile chat bottom sheet ── */}
      {chatOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setChatOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="bottom-sheet anim-slide-up flex flex-col"
            style={{
              background: 'rgba(10,10,22,0.98)',
              borderTop: '1px solid var(--border)',
              height: 'min(60vh, 480px)',
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <ChatPanel
              messages={messages} msgInput={msgInput} setMsgInput={setMsgInput}
              onSend={sendMessage} onClose={() => setChatOpen(false)}
              user={user} lang={lang} chatEndRef={chatEndRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}
