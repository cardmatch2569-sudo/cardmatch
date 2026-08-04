import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from '../lib/api';

// ── Publisher: player broadcasts their existing camera/mic to LiveKit ──
export function useLiveKitPublisher({ roomName, enabled, localStream }) {
  const roomRef      = useRef(null);
  const [live,       setLive]       = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [viewers,    setViewers]    = useState(0);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!enabled || !roomName || !localStream) return;

    let cancelled = false;

    const connect = async () => {
      setConnecting(true);
      setError('');
      try {
        const { token, wsUrl } = await api.post('/api/livekit/token', {
          roomName: `lk_${roomName}`,
          role: 'publisher',
        });
        if (cancelled) return;

        const room = new Room({ dynacast: true });
        roomRef.current = room;

        const updateViewers = () => { if (!cancelled) setViewers(room.remoteParticipants.size); };
        room.on(RoomEvent.ParticipantConnected,    updateViewers);
        room.on(RoomEvent.ParticipantDisconnected, updateViewers);

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        // Publish existing tracks from P2P stream (no extra camera access)
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        try {
          if (videoTrack) {
            const { LocalVideoTrack } = await import('livekit-client');
            const lkVideo = new LocalVideoTrack(videoTrack, undefined, false);
            await room.localParticipant.publishTrack(lkVideo, { simulcast: true, videoCodec: 'vp8' });
          }
          if (audioTrack) {
            const { LocalAudioTrack } = await import('livekit-client');
            const lkAudio = new LocalAudioTrack(audioTrack, undefined, false);
            await room.localParticipant.publishTrack(lkAudio);
          }
        } catch (publishErr) {
          room.disconnect();
          roomRef.current = null;
          if (!cancelled) { setError(publishErr.message); setConnecting(false); }
          return;
        }

        if (!cancelled) {
          setLive(true);
          setConnecting(false);
          setViewers(room.remoteParticipants.size);
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setConnecting(false); }
      }
    };

    connect();

    return () => {
      cancelled = true;
      const room = roomRef.current;
      if (room) {
        room.off(RoomEvent.ParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected);
        room.disconnect();
        roomRef.current = null;
      }
      setLive(false);
      setConnecting(false);
      setViewers(0);
    };
  }, [enabled, roomName, localStream]);

  return { live, connecting, viewers, error };
}

const FRIENDLY_ERRORS = {
  'Failed to fetch': 'ไม่สามารถเชื่อมต่อ server ได้',
  'NetworkError': 'เครือข่ายขัดข้อง',
  'WebSocket': 'ไม่สามารถเชื่อมต่อกับ LiveKit ได้',
  'Not authorized': 'กรุณาเข้าสู่ระบบก่อน',
};
const friendlyError = (msg) => {
  for (const [k, v] of Object.entries(FRIENDLY_ERRORS)) {
    if (msg.includes(k)) return v;
  }
  return 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่';
};

// ── Subscriber: spectator watches live stream ──
export function useLiveKitViewer(roomName, retryKey = 0) {
  const roomRef       = useRef(null);
  const [videoTracks, setVideoTracks] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [connected,   setConnected]   = useState(false);
  const [viewers,     setViewers]     = useState(0);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!roomName) return;

    let cancelled = false;

    const connect = async () => {
      try {
        const { token, wsUrl } = await api.post('/api/livekit/token', {
          roomName: `lk_${roomName}`,
          role: 'subscriber',
        });
        if (cancelled) return;

        const room = new Room({ adaptiveStream: true });
        roomRef.current = room;

        const updateViewers = () => { if (!cancelled) setViewers(room.remoteParticipants.size); };

        const onTrackSubscribed = (track, pub, participant) => {
          if (cancelled) return;
          if (track.kind === Track.Kind.Video)
            setVideoTracks(prev => [...prev, { track, participant, sid: pub.trackSid }]);
          else if (track.kind === Track.Kind.Audio)
            setAudioTracks(prev => [...prev, { track, participant, sid: pub.trackSid }]);
        };
        const onTrackUnsubscribed = (track, pub) => {
          if (cancelled) return;
          if (track.kind === Track.Kind.Video)
            setVideoTracks(prev => prev.filter(t => t.sid !== pub.trackSid));
          else
            setAudioTracks(prev => prev.filter(t => t.sid !== pub.trackSid));
        };

        room.on(RoomEvent.TrackSubscribed,         onTrackSubscribed);
        room.on(RoomEvent.TrackUnsubscribed,       onTrackUnsubscribed);
        room.on(RoomEvent.ParticipantConnected,    updateViewers);
        room.on(RoomEvent.ParticipantDisconnected, updateViewers);

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        setConnected(true);
        setViewers(room.remoteParticipants.size);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err.message));
      }
    };

    connect();

    return () => {
      cancelled = true;
      const room = roomRef.current;
      if (room) {
        room.off(RoomEvent.TrackSubscribed);
        room.off(RoomEvent.TrackUnsubscribed);
        room.off(RoomEvent.ParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected);
        room.disconnect();
        roomRef.current = null;
      }
      setVideoTracks([]);
      setAudioTracks([]);
      setConnected(false);
    };
  }, [roomName, retryKey]);

  return { videoTracks, audioTracks, connected, viewers, error };
}
