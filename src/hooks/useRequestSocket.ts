import * as React from 'react';
import type { RequestStatus } from '@/api/types';
import { createTrackingSocket } from '@/lib/socket';

export interface LiveMechanicLocation {
  requestId: string;
  mechanicId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
}

export function useRequestSocket(
  requestId: string | undefined,
  onStatus?: (status: RequestStatus) => void,
) {
  const [location, setLocation] = React.useState<LiveMechanicLocation | null>(null);
  const [connected, setConnected] = React.useState(false);
  const statusHandler = React.useRef(onStatus);
  statusHandler.current = onStatus;

  React.useEffect(() => {
    if (!requestId) return;
    const socket = createTrackingSocket();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('tracking:join', { requestId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('location:updated', (next: LiveMechanicLocation) => {
      if (next.requestId === requestId) setLocation(next);
    });
    socket.on(
      'request:status',
      (event: { requestId: string; status: RequestStatus }) => {
        if (event.requestId === requestId) statusHandler.current?.(event.status);
      },
    );

    return () => {
      socket.emit('tracking:leave', { requestId });
      socket.disconnect();
    };
  }, [requestId]);

  return { location, connected, setLocation };
}
