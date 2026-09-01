import * as React from 'react';

export type NetworkStatus = 'online' | 'offline';

export interface NetworkStatusState {
  status: NetworkStatus;
  isOnline: boolean;
  isOffline: boolean;
  /** True briefly after transitioning from offline → online */
  justReconnected: boolean;
}

export function useNetworkStatus(): NetworkStatusState {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [justReconnected, setJustReconnected] = React.useState(false);
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline.current) {
        setJustReconnected(true);
        window.setTimeout(() => setJustReconnected(false), 3500);
      }
      wasOffline.current = false;
    };
    const handleOffline = () => {
      wasOffline.current = true;
      setIsOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    status: isOnline ? 'online' : 'offline',
    isOnline,
    isOffline: !isOnline,
    justReconnected,
  };
}
