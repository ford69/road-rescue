import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { formatCedis } from '@/lib/currency';
import { statusLabel, statusVariant } from '@/lib/finance-display';
import { FINANCE_PRESETS, type FinancePreset } from '@/lib/finance-range';

export function MoneyCard({
  title,
  amount,
  hint,
  badge,
}: {
  title: string;
  amount: number;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            {hint ? <InfoTooltip text={hint} label={`About ${title}`} /> : null}
          </div>
          {badge}
        </div>
        <p className="font-display text-2xl font-bold tracking-tight">{formatCedis(amount)}</p>
      </div>
    </Card>
  );
}

export function FinanceRangePicker({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustom,
}: {
  preset: FinancePreset;
  customFrom: string;
  customTo: string;
  onPreset: (preset: FinancePreset) => void;
  onCustom: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {FINANCE_PRESETS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={preset === item.id ? 'primary' : 'outline'}
            onClick={() => onPreset(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(event) => onCustom(event.target.value, customTo)}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(event) => onCustom(customFrom, event.target.value)}
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}
