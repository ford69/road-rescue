import { SubscriptionPlanPicker } from '@/components/subscriptions/plan-picker';

export function CustomerSubscriptionPage() {
  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Subscription</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Basic is free. Premium is coming soon and cannot be purchased yet.
        </p>
      </div>
      <SubscriptionPlanPicker />
    </div>
  );
}
