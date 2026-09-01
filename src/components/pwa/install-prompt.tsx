import * as React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'rr_pwa_install_dismissed_at';
const DISMISS_DAYS = 21;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/**
 * Soft install prompt. Only shows when the browser fires beforeinstallprompt
 * and the user has not dismissed recently. Never blocks critical flows.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      // Delay so it does not compete with first-paint / login.
      window.setTimeout(() => setVisible(true), 4500);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore quota / private mode
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!visible || !deferred) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[85] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        'pointer-events-none lg:left-auto lg:right-4 lg:bottom-4 lg:w-full lg:max-w-sm',
      )}
    >
      <div className="pointer-events-auto rounded-2xl border border-border bg-card p-4 shadow-elevated animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-primary">
            <Download className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Install Road Rescue</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add to your home screen for faster access when you need roadside help.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={() => void install()}>
                Install
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
