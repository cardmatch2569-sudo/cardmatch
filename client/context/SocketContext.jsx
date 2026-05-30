'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef    = useRef(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [connected,   setConnected]   = useState(false);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('cg_token');
    if (!token) return;

    const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';

    // Start with polling first — faster initial connection, then upgrade to WebSocket
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

  // Helper: emit event only when socket is connected
  // If not connected yet, wait for connection then emit
  const safeEmit = useCallback((event, data) => {
    const socket = socketRef.current;
    if (!socket) {
      console.warn('[Socket] safeEmit called but no socket');
      return;
    }
    if (socket.connected) {
      socket.emit(event, data);
    } else {
      console.log(`[Socket] Waiting for connection to emit: ${event}`);
      socket.once('connect', () => {
        socket.emit(event, data);
        console.log(`[Socket] Emitted after connect: ${event}`);
      });
    }
  }, []);

  return (
    <SocketContext.Provider value={{ getSocket, safeEmit, onlineCount, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
