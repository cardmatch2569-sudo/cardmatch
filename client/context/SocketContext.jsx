'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef    = useRef(null);
  const queueRef     = useRef(null); // { gameTypeId } — track if user is in queue for reconnect
  const [onlineCount, setOnlineCount] = useState(0);
  const [connected,   setConnected]   = useState(false);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        queueRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('cg_token');
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

      // Fix: If user was in a queue before reconnect, re-join automatically
      // Server updates socketId but re-joining ensures fresh queue entry
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

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const getSocket = useCallback(() => socketRef.current, []);

  // Track queue state for reconnect handling
  const setQueueGame = useCallback((gameTypeId) => {
    queueRef.current = gameTypeId; // null to clear
  }, []);

  // Emit event — waits for socket connection if not yet connected
  const safeEmit = useCallback((event, data) => {
    const socket = socketRef.current;
    if (!socket) {
      console.warn('[Socket] safeEmit: no socket');
      return;
    }
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
    <SocketContext.Provider value={{ getSocket, safeEmit, setQueueGame, onlineCount, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
