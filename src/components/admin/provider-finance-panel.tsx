import * as React from 'react';
import { adminFinanceApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCedis } from '@/lib/currency';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useToast } from '@/components/ui/toast';
import type { AdminProviderFinancialAccountDto } from '@/api/types';

export function ProviderFinancePanel({ mechanicId }: { mechanicId: string }) {
  const { toast } = useToast();
  const [account, setAccount] = React.useState<AdminProviderFinancialAccountDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [adjustAmount, setAdjustAmount] = React.useState('');
  const [adjustReason, setAdjustReason] = React.useState('');
  const [adjustReference, setAdjustReference] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setAccount(await adminFinanceApi.providerAccount(mechanicId));
    } catch (error) {
      setAccount(null);
      toast({
        type: 'error',
        title: 'Could not load provider finances',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  }, [mechanicId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const adjust = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const next = await adminFinanceApi.adjust(account.mechanicId, {
        amountGhs: Number(adjustAmount),
        reason: adjustReason,
        reference: adjustReference || undefined,
      });
      setAccount(next);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustReference('');
      toast({ type: 'success', title: 'Adjustment recorded' });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Adjustment failed',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading provider finances…</p>;
  }
  if (!account) {
    return <p className="text-sm text-muted-foreground">No financial account found for this provider.</p>;
  }

  const pendingWithdrawals = account.withdrawals.filter((item) =>
    ['pending', 'approved', 'processing'].includes(item.status),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Provider finances
        </p>
        <InfoTooltip text="Available is the provider deposit float. Funds set aside are reserved for approved payouts. Road Rescue earnings are commission deducted from jobs." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Available" value={formatCedis(account.wallet.availableGhs)} />
        <Stat label="Funds set aside" value={formatCedis(account.wallet.reservedGhs)} />
        <Stat label="Road Rescue earnings" value={formatCedis(account.wallet.totalCommissionGhs)} />
        <Stat label="Payments completed" value={formatCedis(account.wallet.totalWithdrawnGhs)} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payout destinations
        </p>
        <div className="mt-2 space-y-2">
          {(account.payoutMethods ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout destinations saved.</p>
          ) : (
            (account.payoutMethods ?? []).map((method) => (
              <div key={method.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {method.label} · {method.accountName} ·••{method.accountLast4}
                </span>
                <Badge variant={method.verified ? 'success' : 'warning'}>
                  {method.verified ? 'Ready' : 'Unchecked'}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pending withdrawals
        </p>
        <div className="mt-2 space-y-2">
          {pendingWithdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawals waiting.</p>
          ) : (
            pendingWithdrawals.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {formatCedis(item.amountGhs)} · {item.reference}
                </span>
                <Badge variant={item.status === 'pending' ? 'warning' : 'subtle'}>{item.status}</Badge>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payout history
        </p>
        <div className="mt-2 space-y-2">
          {account.withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout history yet.</p>
          ) : (
            account.withdrawals.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {formatCedis(item.amountGhs)} · {new Date(item.createdAt).toLocaleDateString('en-GH')}
                </span>
                <span className="text-muted-foreground">{item.status}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Correct a balance
          </p>
          <InfoTooltip text="Use only for genuine corrections. This writes an immutable ledger adjustment." />
        </div>
        <Input
          placeholder="Amount in GHS (negative to deduct)"
          value={adjustAmount}
          onChange={(event) => setAdjustAmount(event.target.value)}
        />
        <Input
          placeholder="Reason"
          value={adjustReason}
          onChange={(event) => setAdjustReason(event.target.value)}
        />
        <Input
          placeholder="Reference (optional)"
          value={adjustReference}
          onChange={(event) => setAdjustReference(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !adjustAmount || adjustReason.trim().length < 5}
          onClick={() => void adjust()}
        >
          Record adjustment
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
