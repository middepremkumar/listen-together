import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../services/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connectionState, setConnectionState] = useState('connecting'); // connecting | connected | reconnecting | disconnected

  if (!socketRef.current) {
    socketRef.current = io(API_BASE_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    });
  }

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => setConnectionState('connected');
    const onDisconnect = () => setConnectionState('disconnected');
    const onReconnectAttempt = () => setConnectionState('reconnecting');
    const onReconnect = () => setConnectionState('connected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connectionState }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within a SocketProvider');
  return ctx;
}
