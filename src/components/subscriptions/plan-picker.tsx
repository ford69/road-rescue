import * as React from 'react';
import { Check, Crown, Sparkles, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatGhs } from '@/lib/currency';
import { subscriptionsApi } from '@/api/repositories';
import type { SubscriptionPlanDto, SubscriptionPlanSlug, SubscriptionSummaryDto } from '@/api/types';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';

const planIcons: Record<SubscriptionPlanSlug, React.ReactNode> = {
  free: <Star className="h-5 w-5" />,
  basic: <Sparkles className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

const featureLabels: Record<string, string> = {
  priority_matching: 'Priority matching',
  member_discount: 'Member discounts on services',
  premium_support: 'Premium support',
  higher_member_discount: 'Larger member discounts',
};

export function SubscriptionPlanPicker() {
  const { toast } = useToast();
  const [plans, setPlans] = React.useState<SubscriptionPlanDto[]>([]);
  const [current, setCurrent] = React.useState<SubscriptionSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionPlan, setActionPlan] = React.useState<SubscriptionPlanSlug | null>(null);

  const reload = React.useCallback(async () => {
    const [planList, summary] = await Promise.all([
      subscriptionsApi.listPlans(),
      subscriptionsApi.current(),
    ]);
    setPlans(planList);
    setCurrent(summary);
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

  const activeSlug = current?.subscription?.planSlug ?? 'free';

  const handleSelect = async (slug: SubscriptionPlanSlug) => {
    if (slug === activeSlug) return;
    setActionPlan(slug);
    try {
      if (slug === 'free') {
        await subscriptionsApi.downgradeToFree();
        toast({ type: 'success', title: 'Moved to Free plan' });
      } else {
        const result = await subscriptionsApi.initializeUpgrade(slug);
        toast({
          type: result.checkoutConfigured ? 'info' : 'warning',
          title: slug === 'premium' ? 'Premium upgrade' : 'Basic upgrade',
          description: result.message,
        });
      }
      await reload();
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
    <div className="space-y-3">
      <div className="px-1">
        <h3 className="font-display text-base font-bold">Membership</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Membership covers app benefits like discounts and priority matching. Roadside services are
          still paid per request.
        </p>
        {current && current.memberDiscountPercent > 0 && (
          <p className="text-sm font-medium text-primary mt-2">
            Active member discount: {current.memberDiscountPercent}% off eligible services
          </p>
        )}
      </div>

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
                        {isPremium && !isActive && <Badge>Premium</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold shrink-0">
                    {plan.monthlyPriceGhs === 0 ? 'Free' : `${formatGhs(plan.monthlyPriceGhs)}/mo`}
                  </p>
                </div>

                {plan.features.length > 0 && (
                  <ul className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-success shrink-0" />
                        {featureLabels[feature] ?? feature.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                )}

                {!isActive && (
                  <Button
                    variant={plan.slug === 'free' ? 'outline' : 'primary'}
                    fullWidth
                    disabled={actionPlan !== null}
                    onClick={() => void handleSelect(plan.slug)}
                  >
                    {actionPlan === plan.slug
                      ? 'Updating…'
                      : plan.slug === 'free'
                        ? 'Switch to Free'
                        : `Upgrade to ${plan.name}`}
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
