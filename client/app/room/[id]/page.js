'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import translations from '../../../lib/translations';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Send,
  MessageSquare, ChevronDown, Wifi, WifiOff,
} from 'lucide-react';

// ── Bug fix: ChatPanel extracted OUTSIDE RoomPage ─────────────────
// Previously defined inside render, so React treated it as a new component
// type on every render, causing remounts and clearing the chat input box.
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
          <input
            type="text" value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            onFocus={e => {
              // Mobile: scroll input into view when keyboard opens
              setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
            }}
            placeholder={t.typeMessage}
            className="input-base text-sm flex-1 py-2"
            style={{ minHeight: '44px' }}
            enterKeyHint="send"
          />
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

// ─────────────────────────────────────────────────────────────────
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
  // Bug fix: track whether leave_room was already emitted to prevent double-emit
  const leftRef        = useRef(false);
  // Bug fix: ref to track chatOpen state in socket closures (stale closure fix)
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
  const chatEndRef = useRef(null);

  // Keep chatOpenRef in sync
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      setUnread(0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [chatOpen]);

  const startMedia = useCallback(async () => {
    // Check secure context (HTTPS or localhost required for camera)
    const isSecure = location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';

    if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
      setMediaError(
        lang === 'th'
          ? `กล้องต้องการการเชื่อมต่อที่ปลอดภัย\nกรุณาเปิดผ่าน http://localhost:3000\nหรือเปิดใช้งานใน Chrome:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure`
          : `Camera requires a secure connection\nOpen via http://localhost:3000\nOr enable in Chrome:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure`
      );
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
        ? (lang === 'th' ? 'กรุณาอนุญาตการเข้าถึงกล้องและไมค์ในเบราว์เซอร์' : 'Please allow camera & mic access in browser settings')
        : err.name === 'NotFoundError'
          ? (lang === 'th' ? 'ไม่พบกล้องหรือไมค์ กรุณาเสียบอุปกรณ์' : 'No camera or mic found')
          : (lang === 'th' ? `เปิดกล้องไม่ได้: ${err.message}` : `Camera error: ${err.message}`);
      setMediaError(msg);
      console.warn('getUserMedia failed:', err.name, err.message);
      return null;
    }
  }, [lang]);

  const createPeer = useCallback((initiator, stream) => {
    const socket = getSocket();
    if (!socket || !stream) return null;
    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN servers — for simple NAT traversal
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // TURN servers — required when STUN fails (different networks, mobile, etc.)
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
          ],
          username:   'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turns:openrelay.metered.ca:443',
          username:   'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      iceCandidatePoolSize: 10,
    });
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = ({ candidate }) => { if (candidate) socket.emit('ice_candidate', { roomId, candidate }); };
    pc.ontrack = ({ streams }) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = streams[0]; setPeerConnected(true); };
    pc.onconnectionstatechange = () => { if (['disconnected','failed'].includes(pc.connectionState)) setPeerConnected(false); };

    if (initiator) {
      // Bug fix: properly await setLocalDescription before emitting offer
      (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
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
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    };

    const onAnswer = async ({ answer }) => {
      if (peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIce = async ({ candidate }) => {
      try { if (peerRef.current && candidate) await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    const onMessage = (msg) => {
      setMessages(p => [...p, msg]);
      // Bug fix: use chatOpenRef.current (not stale chatOpen from closure)
      setUnread(p => chatOpenRef.current ? 0 : p + 1);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const onPartnerLeft = () => {
      setPartnerLeft(true); setPeerConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    socket.on('peer_joined',           onPeerJoined);
    socket.on('offer',                 onOffer);
    socket.on('answer',                onAnswer);
    socket.on('ice_candidate',         onIce);
    socket.on('message_received',      onMessage);
    socket.on('partner_disconnected',  onPartnerLeft);
    init();

    return () => {
      socket.off('peer_joined', onPeerJoined); socket.off('offer', onOffer);
      socket.off('answer', onAnswer); socket.off('ice_candidate', onIce);
      socket.off('message_received', onMessage); socket.off('partner_disconnected', onPartnerLeft);

      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }

      // Bug fix: only emit leave_room if handleLeave hasn't already done so
      if (!leftRef.current) socket.emit('leave_room', { roomId });
    };
  }, [loading, user, roomId, router, getSocket, startMedia, createPeer]);

  const handleLeave = () => {
    leftRef.current = true; // prevent double emit in cleanup
    getSocket()?.emit('leave_room', { roomId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.close();
    router.push('/lobby');
  };

  const toggleCamera = () => { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCameraOn(t.enabled); } };
  const toggleMic    = () => { const t = localStreamRef.current?.getAudioTracks()[0];  if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } };

  const sendMessage = () => {
    if (!msgInput.trim()) return;
    getSocket()?.emit('send_message', { roomId, message: msgInput });
    setMsgInput('');
  };

  if (loading || !user) return (
    <div className="h-screen-safe flex items-center justify-center bg-black">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)', background: '#000' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 flex-shrink-0 z-10"
        style={{ background: 'rgba(7,7,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs flex-shrink-0">🃏</div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${peerConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            {peerConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span className="truncate">
              {peerConnected ? (lang === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected') : (lang === 'th' ? 'รอการเชื่อมต่อ...' : 'Waiting...')}
            </span>
          </div>
        </div>
        <button onClick={handleLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <PhoneOff size={13} />
          <span className="hidden sm:inline">{t.leaveRoom}</span>
        </button>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Video area */}
        <div className="flex-1 flex flex-col relative bg-black overflow-hidden">

          {/* Camera/mic error banner */}
          {mediaError && (
            <div className="absolute top-3 left-3 right-3 z-20 anim-fade-in p-3 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <p className="font-semibold mb-1">📷 {lang === 'th' ? 'ไม่สามารถเปิดกล้องได้' : 'Cannot access camera'}</p>
              {mediaError.split('\n').map((line, i) => (
                <p key={i} className="text-[11px] text-red-400/80 leading-relaxed">{line}</p>
              ))}
            </div>
          )}

          {partnerLeft && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 anim-fade-in px-4 py-2 rounded-xl text-sm font-medium text-center"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              {t.partnerLeft}
            </div>
          )}

          <div className="flex-1 relative">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {!peerConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: 'radial-gradient(circle at center, #0d0d1a, #000)' }}>
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 anim-float">
                  <span className="text-2xl md:text-3xl">👤</span>
                </div>
                <p className="text-slate-500 text-sm text-center px-4">{t.waitingForPeer}</p>
                <div className="flex gap-1 mt-3">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-600" style={{ animation: `blink 1.2s ease ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 badge badge-purple text-xs">{t.opponent}</div>
          </div>

          {/* Self PiP — responsive size: larger on desktop, smaller on phones */}
          <div className="absolute bottom-20 right-2 md:right-4 rounded-xl overflow-hidden shadow-2xl border border-white/10"
            style={{ width: 'clamp(80px, 28vw, 160px)', aspectRatio: '4/3' }}>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!cameraOn && <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)]"><VideoOff size={16} className="text-slate-600" /></div>}
            <div className="absolute bottom-1 left-1.5 text-[9px] text-slate-400 bg-black/60 px-1 rounded">{t.you}</div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2.5 flex-shrink-0"
            style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.95),rgba(0,0,0,0.4))', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>

            <button onClick={toggleCamera}
              className={`w-12 h-12 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all active:scale-95
                ${cameraOn ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10' : 'bg-red-600 text-white'}`}>
              {cameraOn ? <Video size={19} /> : <VideoOff size={19} />}
            </button>

            <button onClick={toggleMic}
              className={`w-12 h-12 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all active:scale-95
                ${micOn ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10' : 'bg-red-600 text-white'}`}>
              {micOn ? <Mic size={19} /> : <MicOff size={19} />}
            </button>

            <button onClick={handleLeave}
              className="w-14 h-14 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-900/40 active:scale-95">
              <PhoneOff size={21} />
            </button>

            <button onClick={() => setChatOpen(p => !p)}
              className={`w-12 h-12 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all active:scale-95 relative
                ${chatOpen ? 'bg-purple-600/40 border border-purple-500/50 text-purple-300' : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'}`}>
              <MessageSquare size={19} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop sidebar chat */}
        {chatOpen && (
          <div className="hidden md:flex w-72 flex-col border-l flex-shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(7,7,15,0.95)' }}>
            <ChatPanel
              messages={messages} msgInput={msgInput} setMsgInput={setMsgInput}
              onSend={sendMessage} onClose={() => setChatOpen(false)}
              user={user} lang={lang} chatEndRef={chatEndRef}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom sheet chat — height uses visualViewport to handle keyboard */}
      {chatOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setChatOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="bottom-sheet anim-slide-up flex flex-col"
            style={{
              background: 'rgba(10,10,22,0.98)',
              borderTop: '1px solid var(--border)',
              // Use 60% of the real visible viewport so it never gets covered by keyboard
              height: 'calc(var(--vh, 1vh) * 60)',
              maxHeight: '500px',
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
