import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Crown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { subscriptionsApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import { formatGhs } from '@/lib/currency';
import type { ProviderPlanDto, ProviderPlanSlug, ProviderSubscriptionSummaryDto } from '@/api/types';

function planCta(plan: ProviderPlanDto, summary: ProviderSubscriptionSummaryDto | null): string {
  const current = summary?.subscription;
  const active = Boolean(summary?.hasActiveSubscription);
  if (active && current?.planSlug === plan.slug) {
    return 'Current plan';
  }
  return 'Authenticate card';
}

export function ProviderSubscriptionPage() {
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [summary, setSummary] = React.useState<ProviderSubscriptionSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busySlug, setBusySlug] = React.useState<ProviderPlanSlug | null>(null);

  const load = React.useCallback(async () => {
    const data = await subscriptionsApi.providerCurrent();
    setSummary(data);
    return data;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    void (async () => {
      try {
        if (reference) {
          await subscriptionsApi.providerVerify(reference);
          await refreshMe();
          toast({
            type: 'success',
            title: 'Card authenticated',
            description: 'No subscription payment today. Your plan is billed after the 30-day trial.',
          });
          setSearchParams({}, { replace: true });
        }
        if (!cancelled) await load();
      } catch (error) {
        if (!cancelled) {
          toast({
            type: 'error',
            title: 'Could not load subscription',
            description: error instanceof ApiClientError ? error.message : 'Please try again.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, refreshMe, setSearchParams, toast]);

  const choose = async (plan: ProviderPlanDto) => {
    if (summary?.hasActiveSubscription && summary.subscription?.planSlug === plan.slug) return;
    setBusySlug(plan.slug);
    try {
      const result = await subscriptionsApi.providerCheckout(plan.slug);
      if (result.trialStarted) {
        await refreshMe();
        await load();
        toast({
          type: 'success',
          title: 'Trial started',
          description: 'Your 30-day trial is active. Going online still requires KYC approval.',
        });
        navigate('/mechanic/home', { replace: true });
        return;
      }
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      toast({ type: 'error', title: 'Checkout unavailable', description: 'Paystack did not return a payment page.' });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Checkout failed',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusySlug(null);
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading provider plans…</p>;
  }

  const plans = summary?.plans ?? [];
  const current = summary?.subscription;

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Provider subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan. Every plan includes a 30-day free trial. Your selected plan is charged after
          the trial — not when you authenticate your card. Going online still requires KYC approval.
        </p>
      </div>

      {current && (
        <Card className="border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">
            {current.status === 'trialing' ? 'Trial — billing not started' : 'Current plan'} · {current.plan?.name ?? current.planSlug}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.status === 'trialing' && current.trialEndsAt
              ? `Trial ends ${new Date(current.trialEndsAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}. First subscription debit after that date.`
              : current.currentPeriodEnd
                ? `Renews or expires ${new Date(current.currentPeriodEnd).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}.`
                : null}
          </p>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((plan) => {
          const selected = current?.planSlug === plan.slug && summary?.hasActiveSubscription;
          return (
            <Card
              key={plan.slug}
              className={`p-4 space-y-3 ${selected ? 'ring-2 ring-primary border-primary/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground">
                    {plan.slug === 'provider_annual' ? <Crown className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{plan.name}</p>
                      {plan.trialDays > 0 && <Badge variant="primary">{plan.trialDays}-day trial</Badge>}
                      {selected && <Badge variant="primary">Current</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                </div>
              </div>
              <p className="font-display text-2xl font-bold">
                {formatGhs(plan.priceGhs, 2)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/ {plan.intervalLabel}</span>
              </p>
              <ul className="space-y-1.5">
                {['Go online and accept jobs', 'Customer matching in your area', 'In-app job tracking'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                fullWidth
                variant={plan.slug === 'provider_annual' ? 'primary' : 'outline'}
                disabled={busySlug !== null || selected}
                onClick={() => void choose(plan)}
              >
                {busySlug === plan.slug ? 'Please wait…' : planCta(plan, summary)}
              </Button>
            </Card>
          );
        })}
      </div>

      {user?.hasActiveSubscription && (
        <Button variant="ghost" className="w-full" onClick={() => navigate('/mechanic/home')}>
          Continue to dashboard
        </Button>
      )}
    </div>
  );
}
