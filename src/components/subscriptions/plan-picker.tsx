import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Crown, Sparkles, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatGhs } from '@/lib/currency';
import { subscriptionsApi } from '@/api/repositories';
import type { SubscriptionPlanDto, SubscriptionPlanSlug, SubscriptionSummaryDto } from '@/api/types';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import { ensureArray } from '@/lib/ensure-array';

const planIcons: Record<SubscriptionPlanSlug, React.ReactNode> = {
  free: <Star className="h-5 w-5" />,
  basic: <Sparkles className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

const includedBasic = [
  'Mechanic assistance',
  'Mechanic profiles',
  'Reviews & ratings',
  'Customer uploads',
];

export function SubscriptionPlanPicker() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = React.useState<SubscriptionPlanDto[]>([]);
  const [current, setCurrent] = React.useState<SubscriptionSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [verifying, setVerifying] = React.useState(false);
  const [actionPlan, setActionPlan] = React.useState<SubscriptionPlanSlug | null>(null);
  const [verifyState, setVerifyState] = React.useState<
    'idle' | 'pending' | 'active' | 'failed' | 'cancelled'
  >('idle');

  const reload = React.useCallback(async () => {
    const [planList, summary] = await Promise.all([
      subscriptionsApi.listPlans(),
      subscriptionsApi.current(),
    ]);
    setPlans(ensureArray(planList));
    setCurrent(summary);
    return summary;
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (error) {
        toast({
          type: 'error',
          title: 'Could not load membership',
          description: error instanceof ApiClientError ? error.message : 'Please try again.',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, toast]);

  const paymentReference = searchParams.get('reference') ?? searchParams.get('trxref');

  React.useEffect(() => {
    if (!paymentReference) return;
    setVerifying(true);
    setVerifyState('pending');
    void subscriptionsApi
      .verify(paymentReference)
      .then(async (summary) => {
        setCurrent(summary);
        setVerifyState(summary.status === 'active' ? 'active' : 'pending');
        toast({
          type: 'success',
          title: 'Subscription Active',
          description: 'Your Basic plan is now active.',
        });
      })
      .catch((error) => {
        setVerifyState('failed');
        toast({
          type: 'error',
          title: 'Payment verification failed',
          description: error instanceof ApiClientError ? error.message : 'Try again from Membership.',
        });
      })
      .finally(() => {
        setVerifying(false);
        setSearchParams({}, { replace: true });
      });
  }, [paymentReference, setSearchParams, toast]);

  const activeSlug = current?.planSlug ?? current?.subscription?.planSlug ?? 'free';
  const statusLabel = String(current?.status ?? current?.subscription?.status ?? 'active').replace(
    /_/g,
    ' ',
  );

  const handleSelect = async (slug: SubscriptionPlanSlug) => {
    if (slug === activeSlug && current?.status === 'active') return;
    if (slug === 'premium') {
      toast({
        type: 'info',
        title: 'Premium coming soon',
        description: 'Premium is not available for purchase yet.',
      });
      return;
    }
    setActionPlan(slug);
    try {
      if (slug === 'free') {
        await subscriptionsApi.downgradeToFree();
        toast({ type: 'success', title: 'Moved to Free plan' });
        await reload();
      } else {
        const checkout = await subscriptionsApi.checkout('basic');
        window.location.assign(checkout.authorizationUrl);
        return;
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not update plan',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setActionPlan(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading membership plans…</p>;
  }

  return (
    <div className="space-y-4">
      {verifying && (
        <Card className="p-4">
          <p className="font-semibold">Verifying your payment…</p>
          <p className="text-sm text-muted-foreground mt-1">
            Confirming your Paystack payment with Road Rescue. This does not activate until the
            server verifies the charge.
          </p>
        </Card>
      )}
      {verifyState === 'active' && (
        <Card className="p-4 border-success/40">
          <p className="font-semibold">Subscription Active</p>
          <p className="text-sm text-muted-foreground mt-1">Your Basic membership is ready to use.</p>
        </Card>
      )}
      {verifyState === 'failed' && (
        <Card className="p-4">
          <p className="font-semibold">Payment Failed</p>
          <p className="text-sm text-muted-foreground mt-1">
            We could not confirm this payment. Your plan was not changed.
          </p>
        </Card>
      )}

      <div className="px-1">
        <h3 className="font-display text-base font-bold">Your Road Rescue Plan</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {current?.plan?.name ?? 'Free'} · {statusLabel}
        </p>
      </div>

      {activeSlug === 'basic' && (current?.status === 'active' || current?.status === 'non_renewing') && (
        <Card className="p-4 space-y-3">
          <p className="font-semibold">Your plan includes</p>
          <ul className="space-y-1.5">
            {includedBasic.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-success shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-2">
        {plans.map((plan) => {
          const isActive = plan.slug === activeSlug;
          const isPremium = plan.slug === 'premium';
          return (
            <Card
              key={plan.slug}
              className={isActive ? 'ring-2 ring-primary border-primary/40' : undefined}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground">
                      {planIcons[plan.slug]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{plan.name}</p>
                        {isActive && <Badge variant="primary">Current</Badge>}
                        {isPremium && <Badge>Coming Soon</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold shrink-0">
                    {plan.monthlyPriceGhs === 0 ? 'Free' : `${formatGhs(plan.monthlyPriceGhs)}/mo`}
                  </p>
                </div>

                {!isActive && plan.slug === 'premium' && (
                  <Button variant="outline" fullWidth disabled>
                    Premium coming soon
                  </Button>
                )}
                {!isActive && plan.slug === 'basic' && (
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={actionPlan !== null}
                    onClick={() => void handleSelect('basic')}
                  >
                    {actionPlan === 'basic' ? 'Opening checkout…' : 'Subscribe to Basic'}
                  </Button>
                )}
                {!isActive && plan.slug === 'free' && (
                  <Button
                    variant="outline"
                    fullWidth
                    disabled={actionPlan !== null}
                    onClick={() => void handleSelect('free')}
                  >
                    {actionPlan === 'free' ? 'Updating…' : 'Switch to Free'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
