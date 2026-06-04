'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';

export default function WatchPage() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const token = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('t')
    : searchParams.get('t');

  const videoRef   = useRef(null);
  const peerRef    = useRef(null);
  const socketRef  = useRef(null);

  const [status, setStatus] = useState('connecting'); // connecting | watching | ended | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Link ไม่ถูกต้อง'); return; }

    const SERVER = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';
    const socket = io(SERVER, {
      auth: { watchToken: token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      if (err.message === 'WATCH_TOKEN_INVALID') {
        setStatus('error');
        setErrorMsg('Link หมดอายุหรือใช้ไม่ได้แล้ว');
      } else {
        setStatus('error');
        setErrorMsg('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
      }
    });

    // Room owner sends an offer to start the WebRTC stream
    socket.on('watch_offer', async ({ offer }) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
        ],
      });
      peerRef.current = pc;

      pc.ontrack = ({ streams }) => {
        if (videoRef.current) videoRef.current.srcObject = streams[0];
        setStatus('watching');
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('watch_ice_viewer', { candidate });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('watch_answer', { answer });
    });

    socket.on('watch_ice_owner', async ({ candidate }) => {
      try { if (peerRef.current) await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    socket.on('watch_viewer_left', () => { setStatus('ended'); });

    // If owner disconnects / match ends
    socket.on('disconnect', () => { if (status === 'watching') setStatus('ended'); });

    return () => {
      peerRef.current?.close();
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
      {/* Video */}
      <video ref={videoRef} autoPlay playsInline
        className="w-full h-full object-contain" />

      {/* Status overlay */}
      {status !== 'watching' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
          {status === 'connecting' && (
            <>
              <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
              <p className="text-white text-sm">กำลังเชื่อมต่อ...</p>
            </>
          )}
          {status === 'ended' && (
            <>
              <div className="text-5xl mb-4">🏁</div>
              <p className="text-white font-bold text-lg mb-1">การแข่งขันจบแล้ว</p>
              <p className="text-slate-500 text-sm">สามารถปิดหน้าต่างนี้ได้</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-white font-bold text-lg mb-1">{errorMsg}</p>
              <p className="text-slate-500 text-sm">ขอ link ใหม่จากผู้เล่นอีกครั้ง</p>
            </>
          )}
        </div>
      )}

      {/* "Watching" badge */}
      {status === 'watching' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-white/80"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          👁 กำลังดู (ดูเท่านั้น)
        </div>
      )}
    </div>
  );
}
