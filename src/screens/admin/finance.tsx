import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isoDate, isFinancePreset, rangeForPreset, type FinancePreset } from '@/lib/finance-range';
import { FinanceOverview } from './finance/overview';
import { FinancePayouts } from './finance/payouts';
import { FinanceSettlements } from './finance/settlements';
import { FinanceTransactions } from './finance/transactions';
import { FINANCE_TABS, isFinanceTab, type FinanceTab } from '@/lib/finance-display';
import { FinanceRangePicker } from './finance/shared';

export function AdminFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const presetParam = searchParams.get('preset');
  const tab: FinanceTab = isFinanceTab(tabParam) ? tabParam : 'overview';
  const preset: FinancePreset = isFinancePreset(presetParam) ? presetParam : '30d';
  const customFrom = searchParams.get('from') || isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const customTo = searchParams.get('to') || isoDate(new Date());
  const range = React.useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const payoutStatus = searchParams.get('status') ?? undefined;

  const update = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Finance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            See money collected, what belongs to providers, what Road Rescue has earned, and what
            still needs your attention.
          </p>
        </div>
        {(tab === 'overview' || tab === 'transactions') && (
          <FinanceRangePicker
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onPreset={(next) => update({ preset: next, from: undefined, to: undefined })}
            onCustom={(from, to) => update({ preset: 'custom', from, to })}
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={(next) => update({ tab: next, status: undefined })}>
        <TabsList variant="underline" className="w-full overflow-x-auto">
          {FINANCE_TABS.map((item) => (
            <TabsTrigger key={item.id} value={item.id} variant="underline">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'overview' && (
        <FinanceOverview
          from={range.from}
          to={range.to}
          onNavigate={(next, status) => update({ tab: next, status })}
        />
      )}
      {tab === 'transactions' && <FinanceTransactions from={range.from} to={range.to} />}
      {tab === 'payouts' && <FinancePayouts initialStatus={payoutStatus} />}
      {tab === 'settlements' && <FinanceSettlements initialStatus={payoutStatus} />}
    </div>
  );
}
