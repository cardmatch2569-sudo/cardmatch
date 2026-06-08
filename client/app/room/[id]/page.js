'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import translations from '../../../lib/translations';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Send,
  MessageSquare, ChevronDown, Wifi, WifiOff, Maximize2, Minimize2, RotateCw, SwitchCamera, Shuffle, Home, Flag,
} from 'lucide-react';

// ── Tournament countdown timer ─────────────────────────────────────
function TournamentTimer({ timeoutAt }) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!timeoutAt) return;
    const update = () => setSecs(Math.max(0, Math.ceil((timeoutAt - Date.now()) / 1000)));
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [timeoutAt]);
  if (secs === null) return null;
  return (
    <div className={`text-4xl font-black tabular-nums ${secs <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>
      {secs}s
    </div>
  );
}

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
            <div key={`${msg.from._id || 'sys'}-${msg.timestamp || ''}-${i}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
          <div className="flex-1 relative">
            <input type="text" value={msgInput}
              onChange={e => setMsgInput(e.target.value.slice(0, 200))}
              onKeyDown={e => e.key === 'Enter' && onSend()}
              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300)}
              placeholder={t.typeMessage}
              className="input-base text-sm w-full py-2 pr-10" style={{ minHeight: '44px' }}
              enterKeyHint="send" />
            {msgInput.length > 150 && (
              <span className="absolute right-2 bottom-1.5 text-[10px] pointer-events-none"
                style={{ color: msgInput.length >= 200 ? '#f87171' : '#64748b' }}>
                {msgInput.length}/200
              </span>
            )}
          </div>
          <button onClick={onSend} disabled={!msgInput.trim()}
            className="w-11 h-11 rounded-lg flex items-center justify-center transition flex-shrink-0 disabled:opacity-60"
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
  const router     = useRouter();
  const [gameTypeId] = useState(
    () => typeof window !== 'undefined'
      ? sessionStorage.getItem('cg_last_game') || ''
      : ''
  );
  const t = translations[lang];
  const langRef = useRef(lang);
  langRef.current = lang;

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const localStreamRef = useRef(null);
  const leftRef              = useRef(false);
  const tournamentRedirectRef = useRef(false);
  const chatOpenRef          = useRef(false);
  const adminPeerRef       = useRef(null); // WebRTC connection to admin spectate

  const [messages,      setMessages]      = useState([]);
  const [msgInput,      setMsgInput]      = useState('');
  const [cameraOn,      setCameraOn]      = useState(true);
  const [micOn,         setMicOn]         = useState(true);
  const [partnerLeft,   setPartnerLeft]   = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [mediaError,    setMediaError]    = useState('');
  const [endModal,      setEndModal]      = useState(null); // null | 'leave' | 'partner_left'
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [forcedLandscape, setForcedLandscape] = useState(false);
  // Track system orientation to avoid double-rotation when iOS auto-rotates
  const [systemLandscape, setSystemLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  );
  // Track remote video orientation to counter-rotate if needed
  const [remoteIsLandscape, setRemoteIsLandscape] = useState(false);
  // Tap-to-expand self PiP
  const [pipExpanded, setPipExpanded] = useState(false);
  // PWA hint — shown once on iOS Safari when user taps expand
  const [showPwaHint, setShowPwaHint] = useState(false);
  const pwaHintTimer = useRef(null);
  // Manual rotation offsets (multiples of 90°) — user can adjust each independently
  const [remoteRotation, setRemoteRotation] = useState(0);
  const [localRotation,  setLocalRotation]  = useState(0);
  // Camera flip (front/back)
  const [facingMode,      setFacingMode]      = useState('user');
  const [hasFlipCamera,   setHasFlipCamera]   = useState(false);
  const chatEndRef = useRef(null);

  // Tournament match state
  const [isTournament,   setIsTournament]   = useState(false);
  const [tourneyPhase,   setTourneyPhase]   = useState('playing'); // playing | result_reporting | admin_decision | done
  const [resultEscape,   setResultEscape]   = useState(false);     // show "leave room" escape after 30s
  const [myResult,       setMyResult]       = useState(null);      // 'win' | 'lose' | null
  const [pendingResult,  setPendingResult]  = useState(null);      // 'win' | 'lose' — awaiting user confirm
  const [opponentResult, setOpponentResult] = useState(null);
  const [matchResult,    setMatchResult]    = useState(null);      // { winnerId, loserId, method }
  const [timeoutAt,      setTimeoutAt]      = useState(null);
  const [adminWatching,    setAdminWatching]    = useState(false);
  const [adminCalledMsg,   setAdminCalledMsg]   = useState('');
  const [escapeCountdown, setEscapeCountdown] = useState(0);
  const escapeTimerRef = useRef(null);

  // Admin spectate mode (admin entering room to watch before deciding)
  const [spectateMode] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('spectate') === 'admin');
  const [spectatorTid] = useState(() => typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tid') || '') : '');
  const adminPeersRef   = useRef({});
  const adminStreamRefs = useRef({});
  const [adminPlayers,    setAdminPlayers]    = useState([]);
  const [adminStreamsMap,  setAdminStreamsMap]  = useState({});
  const [adminDecided,    setAdminDecided]    = useState(false);
  const [adminMicActive,  setAdminMicActive]  = useState(false);
  const [playerRotations, setPlayerRotations]  = useState({});
  const adminMicStreamRef = useRef(null);
  const adminMicConnsRef  = useRef({});
  const adminCameraPeerRef = useRef(null);

  // Detect tournament match from sessionStorage
  const [tournamentId, setTournamentId] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTn = sessionStorage.getItem('cg_is_tournament') === '1';
      setIsTournament(isTn);
      if (isTn) setTournamentId(sessionStorage.getItem('cg_tournament_id') || '');
    }
  }, []);

  // Show escape button after 30s; display countdown while waiting
  useEffect(() => {
    setResultEscape(false);
    setEscapeCountdown(0);
    clearInterval(escapeTimerRef.current);
    if (tourneyPhase === 'result_reporting' || tourneyPhase === 'admin_decision') {
      let count = 30;
      setEscapeCountdown(count);
      escapeTimerRef.current = setInterval(() => {
        count -= 1;
        setEscapeCountdown(count);
        if (count <= 0) {
          clearInterval(escapeTimerRef.current);
          setResultEscape(true);
        }
      }, 1000);
    }
    return () => clearInterval(escapeTimerRef.current);
  }, [tourneyPhase]);


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
      // Show PWA hint once — only on iOS Safari, only if not already added to Home Screen
      const isStandalone = window.navigator.standalone === true;
      const hintShown = localStorage.getItem('cg_pwa_hint');
      if (!isStandalone && !hintShown) {
        setShowPwaHint(true);
        localStorage.setItem('cg_pwa_hint', '1');
        pwaHintTimer.current = setTimeout(() => setShowPwaHint(false), 5000);
      }
    }
  }, [forcedLandscape]);

  const startMedia = useCallback(async () => {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure || !navigator.mediaDevices?.getUserMedia) {
      setMediaError(langRef.current === 'th'
        ? `กล้องต้องการการเชื่อมต่อที่ปลอดภัย\nกรุณาเปิดผ่าน http://localhost:3000`
        : `Camera requires a secure connection\nOpen via http://localhost:3000`);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMediaError('');
      return stream;
    } catch (err) {
      const tRef = translations[langRef.current];
      const msg = err.name === 'NotAllowedError'
        ? tRef.mediaErrorPermission
        : err.name === 'NotFoundError'
          ? tRef.mediaErrorNotFound
          : (langRef.current === 'th' ? `เปิดกล้องไม่ได้: ${err.message}` : `Camera error: ${err.message}`);
      setMediaError(msg);
      return null;
    }
  }, []);

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
    pc.onconnectionstatechange = () => {
      if (['disconnected','failed'].includes(pc.connectionState)) setPeerConnected(false);
    };
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

    const isAdminSpectate = !!user?.isAdmin;

    let aborted = false;
    const init = async () => {
      if (isAdminSpectate) {
        socket.emit('admin_watch_room', { roomId });
        return;
      }
      await startMedia();
      if (!aborted) socket.emit('join_room', { roomId });
    };
    const onPeerJoined = () => {
      setEndModal(prev => prev === 'partner_left' ? null : prev);
      createPeer(true, localStreamRef.current);
    };
    const onOffer = async ({ offer }) => {
      if (!peerRef.current) createPeer(false, localStreamRef.current);
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    };
    const onAnswer = async ({ answer }) => { if (peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer)); };
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
      setEndModal('partner_left');
    };

    // Tournament socket handlers
    const onResultPhaseStarted = ({ timeoutAt: ta }) => {
      setTourneyPhase('result_reporting');
      setTimeoutAt(ta);
    };
    const onOpponentDeclared = ({ result }) => setOpponentResult(result);
    const onMatchResultFinal = ({ winnerId, loserId, method, standings }) => {
      setTourneyPhase('done');
      setMatchResult({ winnerId, loserId, method, standings });
    };
    const onMatchConflict   = () => setTourneyPhase('admin_decision');
    const onMatchNeedsAdmin = () => setTourneyPhase('admin_decision');

    // Admin spectate
    const onAdminWatching = async () => {
      setAdminWatching(true);
      const s = getSocket();
      if (!s) return;
      // Refresh camera if tracks are dead — happens on iOS when browser goes to background
      const videoTracks = localStreamRef.current?.getVideoTracks() || [];
      const needsRefresh = !localStreamRef.current || videoTracks.length === 0 || videoTracks.some(t => t.readyState === 'ended');
      if (needsRefresh) {
        try { await startMedia(); } catch {}
      }
      if (!localStreamRef.current) return;
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceCandidatePoolSize: 10,
      });
      localStreamRef.current.getTracks().forEach(tk => pc.addTrack(tk, localStreamRef.current));
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) s.emit('admin_peer_ice', { roomId, candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          try { pc.restartIce?.(); } catch {}
        }
      };
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('admin_peer_offer', { roomId, offer });
      } catch (e) { console.warn('[admin spectate] offer failed:', e.message); }
      adminPeerRef.current = pc;
    };
    const onAdminPeerAnswer = ({ answer }) => {
      adminPeerRef.current?.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
    };
    const onAdminPeerIce = ({ candidate, from }) => {
      if (isAdminSpectate) {
        // Admin mode: ICE from a player
        const pc = adminPeersRef.current[from];
        if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        try { adminPeerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    // Admin spectate: handle offer from each player
    const onAdminPeerOfferReceived = async ({ from, fromUsername, offer }) => {
      if (!isAdminSpectate) return;
      if (adminPeersRef.current[from]) return;
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceCandidatePoolSize: 10,
      });
      // Register real PC immediately so ICE candidates arriving during negotiation
      // are applied to a live RTCPeerConnection instead of being silently dropped.
      adminPeersRef.current[from] = pc;
      const incomingStream = new MediaStream();
      pc.ontrack = ({ track, streams }) => {
        incomingStream.addTrack(track);
        if (track.kind !== 'video') return;
        // Prefer sender-associated stream; fall back to per-track build for Safari.
        const stream = (streams && streams.length > 0) ? streams[0] : incomingStream;
        setAdminStreamsMap(prev => ({ ...prev, [from]: stream }));
        // Also set srcObject directly — the useEffect may skip if stream reference is same.
        const vid = adminStreamRefs.current[from];
        if (vid) { vid.srcObject = stream; vid.play().catch(() => {}); }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') { try { pc.restartIce?.(); } catch {} }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('admin_peer_ice', { roomId, targetUserId: from, candidate });
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('admin_peer_answer', { roomId, targetUserId: from, answer });
        setAdminPlayers(p => [...p.filter(x => x.userId !== from), { userId: from, username: fromUsername || '?' }]);
      } catch (e) { console.warn('[admin spectate] offer error:', e.message); }
    };
    const onAdminLeft = () => {
      setAdminWatching(false);
      adminPeerRef.current?.close();
      adminPeerRef.current = null;
      adminCameraPeerRef.current?.close();
      adminCameraPeerRef.current = null;
    };

    // Player side: receive admin mic-only audio stream
    const onAdminCameraOffer = async ({ offer, roomId: rid }) => {
      if (rid !== roomId || isAdminSpectate) return;
      adminCameraPeerRef.current?.close();
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceCandidatePoolSize: 10,
      });
      pc.onconnectionstatechange = () => {
        if (['closed','failed','disconnected'].includes(pc.connectionState)) adminCameraPeerRef.current = null;
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) getSocket()?.emit('admin_camera_ice', { roomId, candidate });
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit('admin_camera_answer', { roomId, answer });
      } catch (e) { console.warn('[admin mic recv]', e.message); }
      adminCameraPeerRef.current = pc;
    };
    const onAdminCameraStopped = () => { adminCameraPeerRef.current?.close(); adminCameraPeerRef.current = null; };
    // Admin side: receive answer from player after sending mic offer
    const onAdminCameraAnswerFromPlayer = ({ answer, from }) => {
      adminMicConnsRef.current[from]?.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
    };
    // ICE exchange for mic — bidirectional via same event
    const onAdminCameraIce = ({ candidate, from }) => {
      if (isAdminSpectate && from) {
        try { adminMicConnsRef.current[from]?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        try { adminCameraPeerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };


    socket.on('result_phase_started', onResultPhaseStarted);
    socket.on('opponent_declared',    onOpponentDeclared);
    socket.on('match_result_final',   onMatchResultFinal);
    socket.on('match_conflict',       onMatchConflict);
    socket.on('match_needs_admin',    onMatchNeedsAdmin);
    socket.on('admin_watching',       onAdminWatching);
    socket.on('admin_peer_answer',    onAdminPeerAnswer);
    socket.on('admin_peer_ice',       onAdminPeerIce);
    socket.on('admin_left',           onAdminLeft);
    socket.on('admin_camera_offer',   onAdminCameraOffer);
    socket.on('admin_camera_ice',     onAdminCameraIce);
    socket.on('admin_camera_stopped', onAdminCameraStopped);
    if (isAdminSpectate) socket.on('admin_camera_answer', onAdminCameraAnswerFromPlayer);
    if (isAdminSpectate) socket.on('admin_peer_offer', onAdminPeerOfferReceived);
    const onAdminCalled = ({ message }) => { setAdminCalledMsg(message); setTimeout(() => setAdminCalledMsg(''), 4000); };
    socket.on('admin_called', onAdminCalled);
    const onAdminError = ({ message }) => {
      if (!isAdminSpectate) return;
      setAdminCalledMsg(message || (langRef.current === 'th' ? 'ห้องนี้ไม่พบ' : 'Room not found'));
      leftRef.current = true;
      setTimeout(() => router.back(), 2500);
    };
    const onSpectateEnded = ({ reason }) => {
      const msg = reason === 'replaced'
        ? (langRef.current === 'th' ? 'ถูกแทนที่โดย Admin อีกคน' : 'Replaced by another admin')
        : (langRef.current === 'th' ? 'แมตช์นี้จบแล้ว' : 'Match has ended');
      setAdminCalledMsg(msg);
      leftRef.current = true;
      setTimeout(() => router.back(), 2500);
    };
    socket.on('error',          onAdminError);
    socket.on('spectate_ended', onSpectateEnded);

    socket.on('peer_joined', onPeerJoined); socket.on('offer', onOffer); socket.on('answer', onAnswer);
    socket.on('ice_candidate', onIce); socket.on('message_received', onMessage); socket.on('partner_disconnected', onPartnerLeft);

    init();

    return () => {
      aborted = true;
      clearTimeout(pwaHintTimer.current);
      socket.off('result_phase_started', onResultPhaseStarted);
      socket.off('opponent_declared',    onOpponentDeclared);
      socket.off('match_result_final',   onMatchResultFinal);
      socket.off('match_conflict',       onMatchConflict);
      socket.off('match_needs_admin',    onMatchNeedsAdmin);
      socket.off('admin_watching',       onAdminWatching);
      socket.off('admin_peer_answer',    onAdminPeerAnswer);
      socket.off('admin_peer_ice',       onAdminPeerIce);
      socket.off('admin_left',           onAdminLeft);
      socket.off('admin_called',   onAdminCalled);
      socket.off('error',          onAdminError);
      socket.off('spectate_ended', onSpectateEnded);
      socket.off('admin_camera_offer',   onAdminCameraOffer);
      socket.off('admin_camera_ice',     onAdminCameraIce);
      socket.off('admin_camera_stopped', onAdminCameraStopped);
      if (isAdminSpectate) socket.off('admin_camera_answer', onAdminCameraAnswerFromPlayer);
      if (isAdminSpectate) socket.off('admin_peer_offer', onAdminPeerOfferReceived);
      adminPeerRef.current?.close();
      adminPeerRef.current = null;
      adminCameraPeerRef.current?.close();
      adminCameraPeerRef.current = null;
      adminMicStreamRef.current?.getTracks().forEach(tk => tk.stop());
      adminMicStreamRef.current = null;
      Object.values(adminMicConnsRef.current).forEach(pc => { try { pc.close(); } catch {} });
      adminMicConnsRef.current = {};
      Object.values(adminPeersRef.current).forEach(pc => { try { pc.close(); } catch {} });
      adminPeersRef.current = {};
      Object.values(adminStreamRefs.current).forEach(vid => {
        if (vid?.srcObject) { vid.srcObject.getTracks().forEach(tk => tk.stop()); vid.srcObject = null; }
      });
      adminStreamRefs.current = {};
      setAdminStreamsMap({});

      socket.off('peer_joined', onPeerJoined); socket.off('offer', onOffer); socket.off('answer', onAnswer);
      socket.off('ice_candidate', onIce); socket.off('message_received', onMessage); socket.off('partner_disconnected', onPartnerLeft);
      localStreamRef.current?.getTracks().forEach(tk => tk.stop());
      localStreamRef.current = null;
      if (peerRef.current) {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
        peerRef.current = null;
      }
      // Only clear tournament sessionStorage if NOT redirecting to tournament room
      try {
        if (!tournamentRedirectRef.current) {
          sessionStorage.removeItem('cg_is_tournament');
          sessionStorage.removeItem('cg_tournament_id');
        }
        sessionStorage.removeItem('cg_tournament_match_id');
      } catch {}
      if (!leftRef.current) {
        if (isAdminSpectate) socket.emit('admin_stop_watching', { roomId });
        else socket.emit('leave_room', { roomId });
      }
    };
  }, [loading, user, roomId, router, getSocket, startMedia, createPeer]);

  const cleanupAndLeave = useCallback(() => {
    leftRef.current = true;
    setForcedLandscape(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    getSocket()?.emit('leave_room', { roomId });
    localStreamRef.current?.getTracks().forEach(tk => tk.stop());
    localStreamRef.current = null;
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
  }, [getSocket, roomId]);

  // Set streams on video elements when either stream or player ref becomes available
  useEffect(() => {
    for (const [userId, stream] of Object.entries(adminStreamsMap)) {
      const vid = adminStreamRefs.current[userId];
      if (vid && vid.srcObject !== stream) vid.srcObject = stream;
    }
  }, [adminStreamsMap, adminPlayers]);


  const SPECTATE_CAMERA_ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ];


  const startAdminMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      adminMicStreamRef.current = stream;
      setAdminMicActive(true);
      const socket = getSocket();
      for (const playerId of Object.keys(adminPeersRef.current)) {
        const pc = new RTCPeerConnection({ iceServers: SPECTATE_CAMERA_ICE });
        stream.getTracks().forEach(tk => pc.addTrack(tk, stream));
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) socket.emit('admin_camera_ice', { roomId, targetUserId: playerId, candidate });
        };
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('admin_camera_offer', { roomId, targetUserId: playerId, offer });
          adminMicConnsRef.current[playerId] = pc;
        } catch (e) { pc.close(); }
      }
    } catch (e) { console.warn('[admin mic]', e.message); }
  };

  const stopAdminMic = () => {
    getSocket()?.emit('admin_camera_stopped', { roomId });
    adminMicStreamRef.current?.getTracks().forEach(tk => tk.stop());
    adminMicStreamRef.current = null;
    Object.values(adminMicConnsRef.current).forEach(pc => { try { pc.close(); } catch {} });
    adminMicConnsRef.current = {};
    setAdminMicActive(false);
  };

  const handleAdminDecide = useCallback((winnerId) => {
    const s = getSocket();
    if (!s) return;
    s.emit('admin_decide_match', { roomId, winnerId });
    s.emit('admin_stop_watching', { roomId });
    if (adminMicStreamRef.current) {
      s.emit('admin_camera_stopped', { roomId });
      adminMicStreamRef.current.getTracks().forEach(tk => tk.stop());
      adminMicStreamRef.current = null;
    }
    setAdminDecided(true);
    leftRef.current = true;
    setTimeout(() => router.push(spectatorTid ? `/tournament/${spectatorTid}` : '/tournament'), 1500);
  }, [getSocket, roomId, spectatorTid, router]);

  const handleLeave = () => setEndModal('leave');

  const goToLobby = () => {
    sessionStorage.removeItem('cg_auto_queue');
    cleanupAndLeave();
    router.push('/lobby');
  };

  const findNextPlayer = () => {
    if (gameTypeId) sessionStorage.setItem('cg_auto_queue', gameTypeId);
    cleanupAndLeave();
    router.push('/lobby');
  };

  const toggleCamera = () => { const tk = localStreamRef.current?.getVideoTracks()[0]; if (tk) { tk.enabled = !tk.enabled; setCameraOn(tk.enabled); } };

  const toggleMic    = () => { const tk = localStreamRef.current?.getAudioTracks()[0];  if (tk) { tk.enabled = !tk.enabled; setMicOn(tk.enabled); } };

  const flipCamera = useCallback(async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    try {
      // Try exact facingMode first, fallback to non-exact for older devices
      let newStream;
      const hdVideo = (fm) => ({ facingMode: fm, width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30 } });
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { ...hdVideo(undefined), facingMode: { exact: next } }, audio: false });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: hdVideo(next), audio: false });
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

  // Tournament actions
  const handleEndGame = () => getSocket()?.emit('end_game', { roomId });
  const handleDeclareResult = (result) => {
    setMyResult(result);
    getSocket()?.emit('declare_result', { roomId, result });
  };
  const handleCallAdmin = () => getSocket()?.emit('call_admin', { roomId });
  const goToTournament = useCallback(() => {
    tournamentRedirectRef.current = true;
    leftRef.current = true;
    setForcedLandscape(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    getSocket()?.emit('leave_room', { roomId });
    localStreamRef.current?.getTracks().forEach(tk => tk.stop());
    localStreamRef.current = null;
    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    try { sessionStorage.removeItem('cg_tournament_match_id'); } catch {}
    const rawTid = sessionStorage.getItem('cg_tournament_id') || tournamentId;
    const tid = (rawTid && rawTid !== 'null' && rawTid !== 'undefined') ? rawTid : null;
    router.push(tid ? `/tournament/${tid}` : '/tournament');
  }, [getSocket, roomId, tournamentId, router]);

  if (loading || !user) return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  // ── Admin Spectate UI ────────────────────────────────────────────
  if (user?.isAdmin) {
    const backUrl = spectatorTid ? `/tournament/${spectatorTid}` : '/tournament';
    return (
      <div className="fixed inset-0 bg-black flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <button
            onClick={() => { leftRef.current = true; getSocket()?.emit('admin_stop_watching', { roomId }); router.push(backUrl); }}
            className="text-slate-400 hover:text-white transition text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/10">
            ← {lang === 'th' ? 'กลับ' : 'Back'}
          </button>
          <span className="flex-1 text-center text-sm font-semibold text-yellow-300">
            ⚖️ {lang === 'th' ? 'ดูห้องแข่ง — Admin' : 'Watching Match — Admin'}
          </span>
          <span className="text-[10px] text-slate-600">{roomId.slice(0, 8)}…</span>
        </div>

        {/* Two player video feeds */}
        <div className="flex-1 flex gap-2 p-3 min-h-0">
          {adminPlayers.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin mx-auto" />
                <p className="text-slate-500 text-sm">{lang === 'th' ? 'รอสัญญาณกล้อง...' : 'Waiting for camera feeds...'}</p>
              </div>
            </div>
          )}
          {adminPlayers.map(player => (
            <div key={player.userId} className="flex-1 relative rounded-2xl overflow-hidden bg-gray-900 min-h-0"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <video
                ref={el => { adminStreamRefs.current[player.userId] = el; }}
                autoPlay playsInline
                className="w-full h-full object-cover"
                style={{ transform: `rotate(${playerRotations[player.userId] || 0}deg)` }}
              />
              {!adminStreamsMap[player.userId] && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-slate-600 text-xs">{lang === 'th' ? 'รอกล้อง...' : 'Connecting...'}</p>
                  </div>
                </div>
              )}
              {/* Rotate player video button */}
              <button
                onClick={() => setPlayerRotations(prev => ({ ...prev, [player.userId]: ((prev[player.userId] || 0) + 90) % 360 }))}
                className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
                title={lang === 'th' ? 'หมุนภาพ' : 'Rotate video'}>
                <RotateCw size={14} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                <p className="text-white text-sm font-semibold drop-shadow">{player.username}</p>
              </div>
            </div>
          ))}
          {adminPlayers.length === 1 && (
            <div className="flex-1 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-slate-600 text-sm">{lang === 'th' ? 'รอกล้องผู้เล่น 2...' : 'Waiting P2 camera...'}</p>
            </div>
          )}
        </div>

        {/* Admin mic button */}
        <div className="px-3 pb-1 flex justify-center">
          {adminMicActive ? (
            <button onClick={stopAdminMic}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {lang === 'th' ? 'ปิดไมค์' : 'Mute'}
            </button>
          ) : (
            <button onClick={startAdminMic}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Mic size={13} />
              {lang === 'th' ? 'เปิดไมค์' : 'Open mic'}
            </button>
          )}
        </div>

        {/* Decide panel */}
        <div className="px-3 pb-3 space-y-2">
          {!adminDecided ? (
            <>
              <p className="text-center text-[11px] text-slate-500 pb-1">
                {lang === 'th' ? 'ดูและพูดคุยกับผู้เล่น แล้วกดเลือกผู้ชนะ' : 'Review the match, then select the winner'}
              </p>
              <div className="flex gap-2">
                {adminPlayers.map(player => (
                  <button key={player.userId}
                    onClick={() => handleAdminDecide(player.userId)}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition active:scale-95"
                    style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                    🏆 {player.username} {lang === 'th' ? 'ชนะ' : 'wins'}
                  </button>
                ))}
                {adminPlayers.length < 2 && Array.from({ length: 2 - adminPlayers.length }).map((_, i) => (
                  <div key={i} className="flex-1 py-3 rounded-xl text-center text-sm text-slate-700"
                    style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                    {lang === 'th' ? 'รอผู้เล่น...' : 'Waiting...'}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 py-4 text-green-400 text-sm font-semibold">
              <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
              {lang === 'th' ? 'บันทึกผลเสร็จแล้ว กำลังกลับ...' : 'Result saved, returning...'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // CSS rotation is active when forced landscape but system hasn't rotated yet
  const cssLandscapeActive = forcedLandscape && !systemLandscape;
  const isExpanded = isFullscreen || forcedLandscape;

  const safeTop    = 'env(safe-area-inset-top,    0px)';
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';
  const safeLeft   = 'env(safe-area-inset-left,   0px)';
  const safeRight  = 'env(safe-area-inset-right,  0px)';

  // cssLandscapeActive → CSS rotate 90°; system already landscape → normal fixed
  // When rotated +90°: device's physical TOP → container LEFT, physical BOTTOM → container RIGHT
  // So we swap safe-area-insets: paddingLeft=safeTop, paddingRight=safeBottom
  return (
    <>
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

      {/* ── PWA hint — tiny, auto-dismiss, shown once ── */}
      {showPwaHint && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 anim-fade-up"
          style={{ bottom: `calc(80px + max(0px, ${safeBottom}))` }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] text-white/80"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span>📲</span>
            <span>{lang === 'th' ? 'เพิ่มใน Home Screen เพื่อใช้แบบเต็มจอ' : 'Add to Home Screen for true fullscreen'}</span>
            <button onClick={() => setShowPwaHint(false)} className="text-white/50 hover:text-white ml-1">✕</button>
          </div>
        </div>
      )}

      {/* ── End-of-match modal (leave confirm / partner left) ── */}
      {endModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}>
          <div className="card w-full max-w-xs p-6 text-center space-y-4 anim-scale-in"
            style={{ background: 'rgba(12,12,26,0.98)', borderColor: 'rgba(124,58,237,0.3)' }}>

            {endModal === 'partner_left' ? (
              <>
                <div className="text-4xl">😔</div>
                <div>
                  <p className="text-white font-bold text-base">
                    {lang === 'th' ? 'คู่แข่งออกจากการแข่งแล้ว' : 'Opponent left the match'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {lang === 'th' ? 'หากเป็นปัญหาเครือข่ายชั่วคราว อาจกลับมาเองในไม่ช้า' : 'If it was a brief network issue, they may reconnect shortly'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl">🏁</div>
                <div>
                  <p className="text-white font-bold text-base">
                    {lang === 'th' ? 'จบการแข่ง?' : 'End the match?'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {lang === 'th' ? 'เลือกสิ่งที่ต้องการทำต่อไป' : 'Choose what to do next'}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2 pt-1">
              <button onClick={findNextPlayer}
                className="btn-primary w-full py-3 rounded-xl text-sm gap-2">
                <Shuffle size={15} />
                {lang === 'th' ? 'หาผู้เล่นคนต่อไป' : 'Find Next Player'}
              </button>
              <button onClick={goToLobby}
                className="btn-ghost w-full py-3 rounded-xl text-sm gap-2 flex items-center justify-center">
                <Home size={15} />
                {lang === 'th' ? 'กลับ Lobby' : 'Back to Lobby'}
              </button>
              {endModal === 'leave' && (
                <button onClick={() => setEndModal(null)}
                  className="w-full py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 transition">
                  {lang === 'th' ? 'เล่นต่อ' : 'Continue playing'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {mediaError && (
        <div className="absolute z-30 left-3 right-3 p-3 rounded-xl text-xs"
          style={{ top: `calc(52px + max(0px, ${safeTop}))`, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
          <p className="font-semibold">📷 {t.mediaErrorCamera}</p>
          {mediaError.split('\n').map((line, i) => <p key={i} className="text-[11px] mt-0.5 opacity-80">{line}</p>)}
          <div className="flex gap-2 mt-2.5">
            <button onClick={startMedia}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition active:scale-95"
              style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }}>
              🔄 {lang === 'th' ? 'ลองอีกครั้ง' : 'Retry'}
            </button>
            <button onClick={goToLobby}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8' }}>
              {lang === 'th' ? 'กลับ Lobby' : 'Back to Lobby'}
            </button>
          </div>
        </div>
      )}

      {/* ── TOP BAR — always visible ── */}
      {/* When cssLandscapeActive: container left=phys.top(notch), right=phys.bottom(homeBar) */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between"
        style={{
          paddingTop:    cssLandscapeActive ? '8px' : `max(8px, ${safeTop})`,
          paddingBottom: '8px',
          paddingLeft:   `max(12px, ${cssLandscapeActive ? safeTop : safeLeft})`,
          paddingRight:  `max(12px, ${cssLandscapeActive ? safeBottom : safeRight})`,
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
        style={{ bottom: `calc(68px + max(0px, ${safeBottom}))`, left: `max(10px, ${cssLandscapeActive ? safeTop : safeLeft})` }}>
        {t.opponent}
      </div>

      {/* ── Self PiP — tap to expand/collapse ── */}
      <div
        onClick={() => setPipExpanded(p => !p)}
        className="absolute z-20 cursor-pointer"
        style={pipExpanded ? {
          // Expanded: centered, no forced aspect-ratio — show full camera frame
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: cssLandscapeActive ? 'min(260px, 62vw)' : 'min(320px, 80vw)',
          height: cssLandscapeActive ? 'min(195px, 47vw)' : 'min(240px, 60vw)',
          transition: 'all 0.25s ease',
          zIndex: 25,
          bottom: 'auto',
          right: 'auto',
        } : {
          // Normal: small corner
          bottom: cssLandscapeActive ? 'calc(68px + 8px)' : `calc(68px + max(8px, ${safeBottom}))`,
          right: `max(8px, ${cssLandscapeActive ? safeBottom : safeRight})`,
          width: 'clamp(80px, 24vw, 150px)',
          aspectRatio: '4/3',
          transition: 'all 0.25s ease',
        }}>
        <div className="relative rounded-xl overflow-hidden shadow-2xl border w-full h-full"
          style={{
            borderColor: pipExpanded ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.2)',
            background: '#000',
          }}>
          <video ref={localVideoRef} autoPlay playsInline muted
            className="w-full h-full"
            style={{
              objectFit: pipExpanded ? 'contain' : 'cover', // expanded=full frame, small=fill
              transform: `rotate(${(cssLandscapeActive ? -90 : 0) + localRotation}deg)${facingMode === 'user' ? ' scaleX(-1)' : ''}`,
            }} />
          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <VideoOff size={pipExpanded ? 22 : 14} className="text-slate-400" />
            </div>
          )}
          {pipExpanded ? (
            <div className="absolute bottom-1 left-1 right-1 text-center text-[9px] text-purple-300 bg-black/60 px-1 py-0.5 rounded">
              {lang === 'th' ? '📷 ภาพที่คู่แข่งเห็น' : '📷 What opponent sees'}
            </div>
          ) : (
            <div className="absolute bottom-1 left-1.5 text-[9px] text-slate-300 bg-black/60 px-1 rounded">{t.you}</div>
          )}
          {/* Expand/collapse indicator */}
          <div className="absolute top-1 right-1 bg-black/50 rounded-md px-1 py-0.5 text-[9px] text-white/60">
            {pipExpanded ? '✕' : '⤢'}
          </div>
        </div>
      </div>

      {/* ── CONTROLS BAR — always visible at bottom ── */}
      <div className="absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center gap-3"
        style={{
          paddingTop:    '8px',
          paddingBottom: cssLandscapeActive ? '8px' : `max(8px, ${safeBottom})`,
          paddingLeft:   `max(12px, ${cssLandscapeActive ? safeTop : safeLeft})`,
          paddingRight:  `max(12px, ${cssLandscapeActive ? safeBottom : safeRight})`,
          background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }}>

        {/* Rotate opponent */}
        <button onClick={() => setRemoteRotation(r => (r + 90) % 360)}
          title={lang === 'th' ? 'หมุนภาพคู่แข่ง' : 'Rotate opponent'}
          className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 active:opacity-100 opacity-60 hover:opacity-80"
          style={{ background: remoteRotation !== 0 ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.1)', border: `1px solid ${remoteRotation !== 0 ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.12)'}`, color: remoteRotation !== 0 ? '#c4b5fd' : 'white' }}>
          <RotateCw size={14} />
          <span className="text-[8px] leading-none">{remoteRotation}°</span>
        </button>

        <button onClick={toggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 active:opacity-100
            ${cameraOn ? 'opacity-60 hover:opacity-80' : 'opacity-90'}`}
          style={cameraOn
            ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }
            : { background: 'rgba(239,68,68,0.75)', color: 'white' }}>
          {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        {/* Flip camera */}
        {hasFlipCamera && (
          <button onClick={flipCamera}
            title={lang === 'th' ? (facingMode === 'user' ? 'สลับกล้องหลัง' : 'สลับกล้องหน้า') : (facingMode === 'user' ? 'Switch to back' : 'Switch to front')}
            className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 active:opacity-100 opacity-60 hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}>
            <SwitchCamera size={16} />
            <span className="text-[8px] leading-none opacity-70">{facingMode === 'user' ? (lang === 'th' ? 'หลัง' : 'Back') : (lang === 'th' ? 'หน้า' : 'Front')}</span>
          </button>
        )}

        {/* Tournament: End Game button */}
        {isTournament && tourneyPhase === 'playing' && (
          <button onClick={handleEndGame}
            title={lang === 'th' ? 'จบเกมส์' : 'End Game'}
            className="w-12 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 opacity-80 hover:opacity-100"
            style={{ background: 'rgba(251,191,36,0.25)', border: '1px solid rgba(251,191,36,0.5)', color: '#fbbf24' }}>
            <Flag size={15} />
            <span className="text-[7px] leading-none">จบ</span>
          </button>
        )}

        {/* Leave — hidden in tournament (admin decides, players cannot self-exit) */}
        {!isTournament && (
          <button onClick={handleLeave}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 opacity-80 hover:opacity-100"
            style={{ background: 'rgba(239,68,68,0.85)', boxShadow: '0 4px 15px rgba(239,68,68,0.3)' }}>
            <PhoneOff size={20} />
          </button>
        )}

        <button onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 active:opacity-100
            ${micOn ? 'opacity-60 hover:opacity-80' : 'opacity-90'}`}
          style={micOn
            ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }
            : { background: 'rgba(239,68,68,0.75)', color: 'white' }}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        {/* Rotate own */}
        <button onClick={() => setLocalRotation(r => (r + 90) % 360)}
          title={lang === 'th' ? 'หมุนกล้องของฉัน' : 'Rotate my camera'}
          className="w-10 h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 active:opacity-100 opacity-60 hover:opacity-80"
          style={{ background: localRotation !== 0 ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.1)', border: `1px solid ${localRotation !== 0 ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.12)'}`, color: localRotation !== 0 ? '#c4b5fd' : 'white' }}>
          <RotateCw size={14} />
          <span className="text-[8px] leading-none">{localRotation}°</span>
        </button>

        <button onClick={() => setChatOpen(p => !p)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 active:opacity-100 relative
            ${chatOpen ? 'opacity-90' : 'opacity-60 hover:opacity-80'}`}
          style={chatOpen
            ? { background: 'rgba(124,58,237,0.5)', border: '1px solid rgba(124,58,237,0.5)', color: '#c4b5fd' }
            : { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}>
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Admin watching indicator — hidden during admin_decision (banner takes over) ── */}
      {adminWatching && tourneyPhase !== 'admin_decision' && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none flex justify-center"
          style={{ paddingTop: `calc(52px + max(0px, ${safeTop}))` }}>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px]"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            {lang === 'th' ? 'Admin กำลังดูอยู่' : 'Admin is watching'}
          </div>
        </div>
      )}

      {/* ── Admin called toast ── */}
      {adminCalledMsg && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 anim-fade-up"
          style={{ bottom: `calc(90px + max(0px, ${safeBottom}))` }}>
          <div className="px-4 py-2 rounded-full text-xs text-white"
            style={{ background: 'rgba(251,191,36,0.25)', border: '1px solid rgba(251,191,36,0.4)' }}>
            {adminCalledMsg}
          </div>
        </div>
      )}

      {/* ── Admin decision — non-blocking banner, cameras stay visible ── */}
      {isTournament && tourneyPhase === 'admin_decision' && (
        <div className="absolute left-0 right-0 z-30 px-3 pointer-events-none"
          style={{ top: `calc(52px + max(0px, ${safeTop}))` }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', backdropFilter: 'blur(4px)' }}>
            <div className="w-3 h-3 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-yellow-300 text-xs font-semibold leading-tight">
                {adminWatching
                  ? (lang === 'th' ? '⚖️ Admin กำลัง review การแข่ง...' : '⚖️ Admin is reviewing the match...')
                  : (lang === 'th' ? '⚖️ รอ Admin ตัดสิน — เปิดกล้องไว้' : '⚖️ Awaiting Admin Decision — keep cameras on')}
              </p>
              {adminWatching && (
                <p className="text-green-400 text-[10px] mt-0.5 font-medium">
                  {lang === 'th' ? '● Admin อยู่ในห้องแล้ว' : '● Admin has joined the room'}
                </p>
              )}
            </div>
            {resultEscape ? (
              <button onClick={goToTournament}
                className="text-[10px] text-slate-600 hover:text-slate-400 underline transition flex-shrink-0 pointer-events-auto">
                {lang === 'th' ? 'ออกจากห้อง' : 'Leave'}
              </button>
            ) : escapeCountdown > 0 && (
              <span className="text-[9px] text-slate-600 flex-shrink-0 tabular-nums">{escapeCountdown}s</span>
            )}
          </div>
        </div>
      )}

      {/* ── Tournament Result Overlay (result_reporting + done only) ── */}
      {isTournament && (tourneyPhase === 'result_reporting' || tourneyPhase === 'done') && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}>
          <div className="card w-full max-w-sm p-6 text-center anim-scale-in"
            style={{ background: 'rgba(10,10,22,0.98)', borderColor: 'rgba(124,58,237,0.3)' }}>

            {/* Result reporting phase */}
            {tourneyPhase === 'result_reporting' && !matchResult && (
              <>
                <div className="text-4xl mb-3">🏁</div>
                <h2 className="text-white font-bold text-lg mb-1">
                  {lang === 'th' ? 'จบเกมส์แล้ว' : 'Game Over'}
                </h2>
                <p className="text-slate-500 text-sm mb-4">
                  {lang === 'th' ? 'เลือกผลการแข่งขันของคุณ' : 'Select your match result'}
                </p>
                <TournamentTimer timeoutAt={timeoutAt} />
                {!myResult ? (
                  pendingResult ? (
                    <div className="mt-5 space-y-3">
                      <div className={`px-5 py-3 rounded-2xl font-bold text-base ${pendingResult === 'win' ? 'text-green-400' : 'text-red-400'}`}
                        style={{ background: pendingResult === 'win' ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${pendingResult === 'win' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {pendingResult === 'win' ? '🏆 ' : '💔 '}
                        {pendingResult === 'win' ? (lang === 'th' ? 'ยืนยัน: ฉันชนะ?' : 'Confirm: I Won?') : (lang === 'th' ? 'ยืนยัน: ฉันแพ้?' : 'Confirm: I Lost?')}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setPendingResult(null)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 transition active:scale-95"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                          {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                        </button>
                        <button onClick={() => { handleDeclareResult(pendingResult); setPendingResult(null); }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
                          style={pendingResult === 'win' ? { background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' } : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                          {lang === 'th' ? 'ยืนยัน' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setPendingResult('win')}
                      className="flex-1 py-4 rounded-2xl font-bold text-lg transition active:scale-95"
                      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
                      🏆<br /><span className="text-sm">{lang === 'th' ? 'ฉันชนะ' : 'I Won'}</span>
                    </button>
                    <button onClick={() => setPendingResult('lose')}
                      className="flex-1 py-4 rounded-2xl font-bold text-lg transition active:scale-95"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                      💔<br /><span className="text-sm">{lang === 'th' ? 'ฉันแพ้' : 'I Lost'}</span>
                    </button>
                  </div>
                  )
                ) : (
                  <div className="mt-5 space-y-3">
                    <div className={`px-5 py-3 rounded-2xl font-bold text-base ${myResult === 'win' ? 'text-green-400' : 'text-red-400'}`}
                      style={{ background: myResult === 'win' ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${myResult === 'win' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      {myResult === 'win' ? '🏆 ' : '💔 '}
                      {myResult === 'win' ? (lang === 'th' ? 'ฉันชนะ' : 'I Won') : (lang === 'th' ? 'ฉันแพ้' : 'I Lost')}
                    </div>
                    {opponentResult ? (
                      <p className="text-slate-500 text-xs">{lang === 'th' ? 'คู่แข่งเลือกแล้ว — กำลังยืนยัน...' : 'Opponent selected — confirming...'}</p>
                    ) : (
                      <p className="text-slate-600 text-xs animate-pulse">{lang === 'th' ? 'รอคู่แข่งเลือกผล...' : 'Waiting for opponent...'}</p>
                    )}
                    <button onClick={handleCallAdmin}
                      className="text-xs text-slate-600 hover:text-slate-400 underline transition">
                      📣 {lang === 'th' ? 'เรียก Admin' : 'Call Admin'}
                    </button>
                    {resultEscape && (
                      <button onClick={goToTournament}
                        className="mt-1 text-xs text-slate-700 hover:text-slate-500 underline transition">
                        {lang === 'th' ? 'ออกจากห้อง →' : 'Leave room →'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Done — show final result */}
            {tourneyPhase === 'done' && matchResult && (
              <>
                <div className="text-5xl mb-4">
                  {matchResult.winnerId === user._id ? '🏆' : '💔'}
                </div>
                <h2 className={`font-bold text-xl mb-2 ${matchResult.winnerId === user._id ? 'text-green-400' : 'text-red-400'}`}>
                  {matchResult.winnerId === user._id
                    ? (lang === 'th' ? 'คุณชนะ! +3 แต้ม' : 'You Won! +3 pts')
                    : (lang === 'th' ? 'คุณแพ้' : 'You Lost')}
                </h2>
                {matchResult.method === 'admin_decision' && (
                  <p className="text-xs text-slate-600 mb-2">{lang === 'th' ? 'ผลตัดสินโดย Admin' : 'Decided by Admin'}</p>
                )}
                {matchResult.method === 'timeout_one_sided' && (
                  <p className="text-xs text-slate-600 mb-2">{lang === 'th' ? 'ผลโดยอัตโนมัติ (หมดเวลา)' : 'Auto result (timeout)'}</p>
                )}
                {matchResult.standings?.length > 0 && (
                  <div className="w-full mt-2 mb-3 space-y-1">
                    {matchResult.standings.slice(0, 3).map((s, i) => (
                      <div key={s.userId} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: s.userId === user._id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)' }}>
                        <span className="text-slate-500 w-4">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <span className={`flex-1 ${s.userId === user._id ? 'text-purple-300 font-semibold' : 'text-slate-300'}`}>{s.username}</span>
                        <span className="text-yellow-400 font-bold">{s.points} pt</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={goToTournament}
                  className="btn-primary w-full py-3 rounded-xl text-sm mt-2">
                  🏟 {lang === 'th' ? 'กลับห้องทัวร์นาเมนต์' : 'Back to Tournament'}
                </button>
              </>
            )}

            {/* Fallback: done phase but result missing (prevents locked blank overlay) */}
            {tourneyPhase === 'done' && !matchResult && (
              <button onClick={goToTournament} className="btn-primary w-full py-3 rounded-xl text-sm">
                🏟 {lang === 'th' ? 'กลับห้องทัวร์นาเมนต์' : 'Back to Tournament'}
              </button>
            )}
          </div>
        </div>
      )}

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
              height: 'min(60vh, 480px, 100vw - 16px)',
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
    </>
  );
}
