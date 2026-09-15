import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Crown, LifeBuoy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { subscriptionsApi } from '@/api/repositories';
import { postAuthPath } from '@/lib/auth-gate';

const included = [
  'Provider assistance',
  'Provider discovery',
  'Provider profiles',
  'Ratings & reviews',
  'Customer uploads',
];

export function CompleteSubscriptionScreen() {
  const { user, loading, isAuthenticated, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [activating, setActivating] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  React.useEffect(() => {
    if (!user || user.role !== 'customer' || activating) return;
    if (user.hasActiveSubscription) {
      navigate(user.emailVerified ? postAuthPath(user) : '/auth/verify-email', { replace: true });
      return;
    }
    setActivating(true);
    void subscriptionsApi
      .current()
      .then(() => refreshMe())
      .catch(() => setActivating(false));
  }, [activating, navigate, refreshMe, user]);

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
            <p className="text-xs text-muted-foreground">Basic is free</p>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <h1 className="font-display text-2xl font-bold tracking-tight">Your Basic plan is included</h1>
          <p className="text-sm text-muted-foreground">
            No payment is required. Activating your free Basic plan so you can use Road Rescue.
          </p>
          <div className="rounded-xl border border-primary bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-semibold">Basic</p>
              <span className="ml-auto text-sm font-semibold text-primary">Free</span>
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
          <Button
            className="w-full"
            onClick={() => navigate(user.emailVerified ? postAuthPath(user) : '/auth/verify-email', { replace: true })}
          >
            Continue
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-semibold text-primary"
            onClick={() => void logout().then(() => navigate('/auth/login', { replace: true }))}
          >
            Sign out
          </button>
        </Card>
      </div>
    </div>
  );
}
