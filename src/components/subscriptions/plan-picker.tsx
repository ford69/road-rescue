import * as React from 'react';
import { Check, Crown, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { subscriptionsApi } from '@/api/repositories';
import type { SubscriptionSummaryDto } from '@/api/types';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';

const includedBasic = [
  'Provider assistance',
  'Provider profiles',
  'Reviews & ratings',
  'Customer uploads',
];

export function SubscriptionPlanPicker() {
  const { toast } = useToast();
  const [current, setCurrent] = React.useState<SubscriptionSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        setCurrent(await subscriptionsApi.current());
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
  }, [toast]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading membership plans…</p>;
  }

  const statusLabel = String(current?.status ?? 'active').replace(/_/g, ' ');

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h3 className="font-display text-base font-bold">Your Road Rescue Plan</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {current?.plan?.name ?? 'Basic'} · {statusLabel}
        </p>
      </div>

      <Card className="p-4 space-y-3 ring-2 ring-primary border-primary/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">Basic</p>
                <Badge variant="primary">Current</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Free and available now</p>
            </div>
          </div>
          <p className="font-display text-lg font-bold shrink-0">Free</p>
        </div>
        <ul className="space-y-1.5">
          {includedBasic.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-success shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-muted-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">Premium</p>
                <Badge>Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Additional services will be available later</p>
            </div>
          </div>
        </div>
        <Button variant="outline" fullWidth disabled>
          Coming Soon
        </Button>
      </Card>
    </div>
  );
}
