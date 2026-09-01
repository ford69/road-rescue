import { LifeBuoy, RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import * as React from 'react';

export function OfflineScreen() {
  const { isOnline } = useNetworkStatus();

  React.useEffect(() => {
    if (isOnline) {
      window.location.replace('/auth/login');
    }
  }, [isOnline]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 safe-top safe-bottom">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-elevated">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-primary">
          <LifeBuoy className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-critical/10 text-critical">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">You're currently offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connection status: <span className="font-semibold text-critical">offline</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Road Rescue needs internet for requesting help, live location, payments, authentication,
          and mechanic assignment. Emergency roadside services are not available offline.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Link
            to="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
