import * as React from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Crown, LifeBuoy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { subscriptionsApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { postAuthPath } from '@/lib/auth-gate';

const included = [
  'Mechanic assistance',
  'Mechanic discovery',
  'Mechanic profiles',
  'Ratings & reviews',
  'Customer uploads',
];

type Phase = 'ready' | 'processing' | 'active' | 'failed' | 'pending';

export function CompleteSubscriptionScreen() {
  const { user, loading, isAuthenticated, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [phase, setPhase] = React.useState<Phase>('ready');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const verifyingRef = React.useRef(false);
  const autoCheckoutRef = React.useRef(false);
  const reference = search.get('reference') ?? search.get('trxref');
  const autoCheckout = search.get('checkout') === '1';

  React.useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  React.useEffect(() => {
    if (!user) return;
    if (user.role !== 'customer') {
      navigate(postAuthPath(user), { replace: true });
      return;
    }
    if (phase === 'processing' || phase === 'active' || phase === 'pending' || phase === 'failed') {
      return;
    }
    if (user.hasActiveSubscription && !user.emailVerified) {
      navigate('/auth/verify-email', { replace: true });
      return;
    }
    if (user.hasActiveSubscription && user.emailVerified) {
      navigate(postAuthPath(user), { replace: true });
    }
  }, [navigate, phase, user]);

  React.useEffect(() => {
    if (!reference || !user || verifyingRef.current) return;
    verifyingRef.current = true;
    setPhase('processing');
    void subscriptionsApi
      .verify(reference)
      .then(async (summary) => {
        await refreshMe();
        const active = summary.status === 'active' || summary.status === 'non_renewing';
        setPhase(active ? 'active' : 'pending');
      })
      .catch((error) => {
        setPhase('failed');
        setMessage(error instanceof ApiClientError ? error.message : 'Payment could not be verified.');
      })
      .finally(() => setSearch({}, { replace: true }));
  }, [reference, refreshMe, setSearch, user]);

  const startCheckout = React.useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const checkout = await subscriptionsApi.checkout('basic');
      window.location.assign(checkout.authorizationUrl);
    } catch (error) {
      setPhase('failed');
      setMessage(error instanceof ApiClientError ? error.message : 'Could not start checkout.');
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!user || reference || !autoCheckout || autoCheckoutRef.current) return;
    autoCheckoutRef.current = true;
    setSearch({}, { replace: true });
    void startCheckout();
  }, [autoCheckout, reference, setSearch, startCheckout, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-xl font-bold leading-none">Road Rescue</p>
            <p className="text-xs text-muted-foreground">Complete your membership</p>
          </div>
        </div>

        {phase === 'processing' && (
          <Card className="p-6 space-y-2">
            <h1 className="font-display text-2xl font-bold">Setting up your Road Rescue account…</h1>
            <p className="text-sm text-muted-foreground">We&apos;re confirming your subscription.</p>
          </Card>
        )}

        {phase === 'active' && (
          <Card className="p-6 space-y-4">
            <h1 className="font-display text-2xl font-bold">Your Basic subscription is active.</h1>
            <p className="text-sm text-muted-foreground">
              Your account is almost ready. Please verify your email to continue.
            </p>
            <Button className="w-full" onClick={() => navigate('/auth/verify-email', { replace: true })}>
              Check your email
            </Button>
          </Card>
        )}

        {phase === 'pending' && (
          <Card className="p-6 space-y-4">
            <h1 className="font-display text-2xl font-bold">Your payment is still being confirmed.</h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your subscription, then try again.
            </p>
            <Button className="w-full" onClick={() => void startCheckout()} disabled={busy}>
              Check again
            </Button>
          </Card>
        )}

        {(phase === 'ready' || phase === 'failed') && (
          <Card className="p-6 space-y-4">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {phase === 'failed'
                ? 'We couldn\'t complete your subscription.'
                : 'Choose your plan'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {phase === 'failed'
                ? 'Your account has not been activated. Complete Basic membership to continue.'
                : 'Basic is required to use Road Rescue. Payment is verified by our servers — not the checkout page alone.'}
            </p>
            {message && <p className="text-sm text-critical">{message}</p>}

            <div className="rounded-xl border border-primary bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="font-semibold">Basic</p>
              </div>
              <ul className="space-y-1.5">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border p-4 opacity-80">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-muted-foreground" />
                <p className="font-semibold">Premium</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Coming Soon</p>
            </div>

            <Button className="w-full" disabled={busy} onClick={() => void startCheckout()}>
              {busy ? 'Opening checkout…' : phase === 'failed' ? 'Try Again' : 'Complete Subscription'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-primary"
              onClick={() => void logout().then(() => navigate('/auth/login', { replace: true }))}
            >
              Sign out
            </button>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already paid?{' '}
          <Link className="font-semibold text-primary" to="/auth/verify-email">
            Verify email
          </Link>
        </p>
      </div>
    </div>
  );
}
