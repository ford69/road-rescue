import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isActiveRescueFlagSet } from '@/pwa/active-rescue';

/**
 * Prompt when a new service worker is waiting.
 * Avoids forcing reload during an active rescue (flag set by tracking screens).
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Periodic update checks while the app is open.
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  const [busy, setBusy] = React.useState(false);

  if (!needRefresh) return null;

  const rescueActive = isActiveRescueFlagSet();

  const applyUpdate = async () => {
    setBusy(true);
    try {
      await updateServiceWorker(true);
    } finally {
      setBusy(false);
      setNeedRefresh(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[86] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        'pointer-events-none lg:left-auto lg:right-4 lg:bottom-4 lg:w-full lg:max-w-sm',
      )}
    >
      <div className="pointer-events-auto rounded-2xl border border-border bg-card p-4 shadow-elevated">
        <p className="font-semibold text-sm">New version available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {rescueActive
            ? 'An update is ready. Refresh after your rescue is complete so tracking is not interrupted.'
            : 'Refresh to update Road Rescue with the latest fixes.'}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || rescueActive}
            onClick={() => void applyUpdate()}
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', busy && 'animate-spin')} />
            {busy ? 'Updating…' : 'Refresh to update'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
