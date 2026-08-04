import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from '../lib/api';

// ── Publisher: player broadcasts their existing camera/mic to LiveKit ──
export function useLiveKitPublisher({ roomName, enabled, localStream }) {
  const roomRef   = useRef(null);
  const [live,    setLive]    = useState(false);
  const [viewers, setViewers] = useState(0);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!enabled || !roomName || !localStream) return;

    let cancelled = false;

    const connect = async () => {
      try {
        const { token, wsUrl } = await api.post('/api/livekit/token', {
          roomName: `lk_${roomName}`,
          role: 'publisher',
        });
        if (cancelled) return;

        const room = new Room({ dynacast: true, adaptiveStream: true });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected,    () => setViewers(room.remoteParticipants.size));
        room.on(RoomEvent.ParticipantDisconnected, () => setViewers(room.remoteParticipants.size));

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        // Publish existing tracks from P2P stream (no extra camera access)
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        if (videoTrack) {
          const { LocalVideoTrack } = await import('livekit-client');
          const lkVideo = new LocalVideoTrack(videoTrack, undefined, false);
          await room.localParticipant.publishTrack(lkVideo, {
            simulcast: true,
            videoCodec: 'vp8',
          });
        }
        if (audioTrack) {
          const { LocalAudioTrack } = await import('livekit-client');
          const lkAudio = new LocalAudioTrack(audioTrack, undefined, false);
          await room.localParticipant.publishTrack(lkAudio);
        }

        if (!cancelled) {
          setLive(true);
          setViewers(room.remoteParticipants.size);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    connect();

    return () => {
      cancelled = true;
      setLive(false);
      setViewers(0);
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [enabled, roomName, localStream]);

  return { live, viewers, error };
}

// ── Subscriber: spectator watches live stream ──
export function useLiveKitViewer(roomName) {
  const roomRef       = useRef(null);
  const [videoTracks, setVideoTracks] = useState([]); // [{ track, participant, sid }]
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

        const updateViewers = () => setViewers(room.remoteParticipants.size);

        room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
          if (track.kind === Track.Kind.Video) {
            setVideoTracks(prev => [...prev, { track, participant, sid: pub.trackSid }]);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track, pub) => {
          setVideoTracks(prev => prev.filter(t => t.sid !== pub.trackSid));
        });
        room.on(RoomEvent.ParticipantConnected,    updateViewers);
        room.on(RoomEvent.ParticipantDisconnected, updateViewers);

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        setConnected(true);
        setViewers(room.remoteParticipants.size);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    connect();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
      setVideoTracks([]);
      setConnected(false);
    };
  }, [roomName]);

  return { videoTracks, connected, viewers, error };
}
