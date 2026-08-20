import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '@/api/utils/tokenStore';

export function createTrackingSocket(): Socket {
  return io(import.meta.env.VITE_SOCKET_URL || undefined, {
    auth: { token: tokenStore.getAccess() },
    transports: ['websocket', 'polling'],
  });
}
