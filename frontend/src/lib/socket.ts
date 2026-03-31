import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinRoom(room: string): void {
  const s = getSocket();
  s.emit('join-room', room);
}

export function leaveRoom(room: string): void {
  const s = getSocket();
  s.emit('leave-room', room);
}

// Join role-based rooms
export function joinRoleRooms(): void {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const s = getSocket();
  s.emit('join-room', `role:${user.role}`);
  s.emit('join-room', `user:${user.id}`);
  s.emit('join-room', 'all');
}

export default getSocket;
