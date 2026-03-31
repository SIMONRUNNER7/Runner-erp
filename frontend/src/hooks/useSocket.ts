import { useEffect, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useAppStore } from '../store/app.store';

type SocketEventHandler = (...args: unknown[]) => void;

export function useSocket() {
  const socket = getSocket();
  const { incrementUnreadAlerts, addNotification } = useAppStore();

  useEffect(() => {
    const handleNewAlert = () => {
      incrementUnreadAlerts();
    };

    socket.on('alert:new', handleNewAlert);

    return () => {
      socket.off('alert:new', handleNewAlert);
    };
  }, [socket, incrementUnreadAlerts, addNotification]);

  const on = useCallback(
    (event: string, handler: SocketEventHandler) => {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socket]
  );

  const emit = useCallback(
    (event: string, data?: unknown) => {
      socket.emit(event, data);
    },
    [socket]
  );

  return { socket, on, emit };
}

export function useSocketEvent(event: string, handler: SocketEventHandler) {
  const socket = getSocket();

  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}
