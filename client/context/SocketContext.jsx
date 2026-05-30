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

    const socket = io(SERVER_URL, {
      auth: { token },
      // Allow polling fallback — crucial for Railway + cross-network
      transports: ['polling', 'websocket'],  // Start with polling (faster initial), upgrade to WS
      upgrade: true,
      // Aggressive reconnection to minimize gap
      reconnectionAttempts:    Infinity,
      reconnectionDelay:       500,
      reconnectionDelayMax:    3000,
      randomizationFactor:     0.3,
      timeout:                 10000,
    });

    socket.on('connect', () => {
      setConnected(true);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket] Connected via ${socket.io.engine.transport.name}`);
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    socket.on('connect_error', (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Socket] Connect error:', err.message);
      }
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

  return (
    <SocketContext.Provider value={{ getSocket, onlineCount, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
