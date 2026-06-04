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
  const [serverFull,  setServerFull]  = useState(false);

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

    // Restore queue state after page refresh (consume and clear immediately)
    const savedQueue = sessionStorage.getItem('cg_queue_game');
    if (savedQueue && !queueRef.current) {
      queueRef.current = savedQueue;
      sessionStorage.removeItem('cg_queue_game'); // consumed — lobby will re-set it via setQueueGame
    }

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
      pendingEmits.current = []; // clear queued emits on disconnect to prevent duplicates
      console.log('[Socket] ❌ Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'SERVER_FULL') {
        console.warn('[Socket] ⚠️ Server full — max concurrent users reached');
        setServerFull(true);
      } else {
        console.warn('[Socket] ⚠️ Error:', err.message);
      }
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
    socket.on('challenge_id_sent',   (...a) => lobbyCallbacksRef.current.onChallengeIdSent?.(...a));
    socket.on('challenge_id_error',  (...a) => lobbyCallbacksRef.current.onChallengeIdError?.(...a));
    socket.on('public_message',      (...a) => lobbyCallbacksRef.current.onPublicMessage?.(...a));
    socket.on('public_chat_history', (...a) => lobbyCallbacksRef.current.onPublicChatHistory?.(...a));
    socket.on('announcement',        (...a) => lobbyCallbacksRef.current.onAnnouncement?.(...a));

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
  const setQueueGame = useCallback((gameTypeId) => {
    queueRef.current = gameTypeId;
    // Persist across page refresh
    if (gameTypeId) sessionStorage.setItem('cg_queue_game', gameTypeId);
    else sessionStorage.removeItem('cg_queue_game');
  }, []);

  const pendingEmits = useRef([]);
  const safeEmit = useCallback((event, data) => {
    const socket = socketRef.current;
    if (!socket) { console.warn('[Socket] safeEmit: no socket'); return; }
    if (socket.connected) {
      socket.emit(event, data);
    } else {
      const isFirst = pendingEmits.current.length === 0;
      pendingEmits.current.push({ event, data });
      if (isFirst) {
        socket.once('connect', () => {
          const queued = pendingEmits.current.splice(0);
          queued.forEach(q => socket.emit(q.event, q.data));
        });
      }
    }
  }, []);

  return (
    <SocketContext.Provider value={{
      getSocket, safeEmit, setQueueGame, setLobbyCallbacks,
      onlineCount, connected, socketReady, serverFull,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
