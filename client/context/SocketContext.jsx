'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef   = useRef(null);
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
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000', {
      auth: { token },
      // Allow polling fallback if WebSocket fails (important for cross-network/cloud)
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect',       () => { setConnected(true); console.log('Socket connected:', socket.id, 'transport:', socket.io.engine.transport.name); });
    socket.on('disconnect',    (reason) => { setConnected(false); console.log('Socket disconnected:', reason); });
    socket.on('connect_error', (err)    => { console.error('Socket connect error:', err.message); });
    socket.on('online_count',  ({ count }) => setOnlineCount(count));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  // Bug fix: wrap in useCallback so reference is stable across renders
  // Previously recreated on every render, causing effects that depend on it to re-run constantly
  const getSocket = useCallback(() => socketRef.current, []);

  return (
    <SocketContext.Provider value={{ getSocket, onlineCount, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
