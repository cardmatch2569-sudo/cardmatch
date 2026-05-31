'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef    = useRef(null);
  const queueRef     = useRef(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [connected,   setConnected]   = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  // Lobby callbacks — registered once inside the socket, delegates to these refs.
  // This avoids React effect timing issues: listeners live on the socket itself,
  // callbacks are swapped out by the lobby on every render via setLobbyCallbacks.
  const lobbyCallbacksRef = useRef({});
  const setLobbyCallbacks = useCallback((cbs) => {
    lobbyCallbacksRef.current = cbs || {};
  }, []);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        setSocketReady(false);
        queueRef.current = null;
      }
      setLobbyCallbacks({});
      return;
    }

    const token = sessionStorage.getItem('cg_token') || localStorage.getItem('cg_token');
    if (!token) return;

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';

    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:    500,
      reconnectionDelayMax: 3000,
      timeout:              10000,
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('[Socket] ✅ Connected via', socket.io.engine.transport.name, '| ID:', socket.id);
      if (queueRef.current) {
        console.log('[Socket] Re-joining queue after reconnect:', queueRef.current);
        socket.emit('join_queue', { gameTypeId: queueRef.current });
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[Socket] ❌ Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] ⚠️ Error:', err.message);
    });

    socket.on('online_count', ({ count }) => setOnlineCount(count));

    // Matchmaking events — listeners registered ONCE on socket creation.
    // Delegates to lobbyCallbacksRef so lobby can swap handlers without
    // ever touching socket.on/off (zero React timing risk).
    socket.on('match_found',        (...a) => lobbyCallbacksRef.current.onMatchFound?.(...a));
    socket.on('queue_left',         (...a) => lobbyCallbacksRef.current.onQueueLeft?.(...a));
    socket.on('challenge_received', (...a) => lobbyCallbacksRef.current.onChallengeReceived?.(...a));
    socket.on('challenge_accepted', (...a) => lobbyCallbacksRef.current.onChallengeAccepted?.(...a));
    socket.on('challenge_declined', (...a) => lobbyCallbacksRef.current.onChallengeDeclined?.(...a));

    socketRef.current = socket;
    setSocketReady(true);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setSocketReady(false);
    };
  }, [user, setLobbyCallbacks]);

  const getSocket    = useCallback(() => socketRef.current, []);
  const setQueueGame = useCallback((gameTypeId) => { queueRef.current = gameTypeId; }, []);

  const safeEmit = useCallback((event, data) => {
    const socket = socketRef.current;
    if (!socket) { console.warn('[Socket] safeEmit: no socket'); return; }
    if (socket.connected) {
      socket.emit(event, data);
    } else {
      console.log(`[Socket] safeEmit: waiting to emit ${event}`);
      socket.once('connect', () => {
        socket.emit(event, data);
        console.log(`[Socket] safeEmit: emitted ${event} after connect`);
      });
    }
  }, []);

  return (
    <SocketContext.Provider value={{
      getSocket, safeEmit, setQueueGame, setLobbyCallbacks,
      onlineCount, connected, socketReady,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
