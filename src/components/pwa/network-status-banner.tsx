import * as React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';

/**
 * Subtle online/offline banner. Does not block interaction.
 * Critical flows (rescue, payments, auth) still require connectivity.
 */
export function NetworkStatusBanner() {
  const { isOffline, justReconnected } = useNetworkStatus();
  const [dismissedReconnect, setDismissedReconnect] = React.useState(false);

  React.useEffect(() => {
    if (justReconnected) setDismissedReconnect(false);
  }, [justReconnected]);

  if (isOffline) {
    return (
      <div
        role="status"
        className={cn(
          'fixed inset-x-0 top-0 z-[90] border-b border-critical/30 bg-critical text-critical-foreground',
          'px-4 py-2 text-center text-sm font-medium safe-top',
        )}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          You're offline. Rescue requests, tracking, and payments need internet.
        </span>
      </div>
    );
  }

  if (justReconnected && !dismissedReconnect) {
    return (
      <div
        role="status"
        className={cn(
          'fixed inset-x-0 top-0 z-[90] border-b border-success/30 bg-success text-success-foreground',
          'px-4 py-2 text-center text-sm font-medium safe-top',
        )}
      >
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2"
          onClick={() => setDismissedReconnect(true)}
        >
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          You're back online.
        </button>
      </div>
    );
  }

  return null;
}
