import * as React from 'react';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { PaginationBar } from '@/components/ui/pagination';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { adminFinanceApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { formatCedis } from '@/lib/currency';
import { useToast } from '@/components/ui/toast';
import type { WalletWithdrawalDto } from '@/api/types';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { StatusBadge } from './shared';

const STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'processing', label: 'Processing' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: '', label: 'All' },
];

export function FinancePayouts({
  initialStatus,
}: {
  initialStatus?: string;
}) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState(initialStatus ?? 'pending');
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<WalletWithdrawalDto[]>([]);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<WalletWithdrawalDto | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [payoutMethodUsed, setPayoutMethodUsed] = React.useState('bank_transfer');
  const [payoutReference, setPayoutReference] = React.useState('');
  const [payoutDate, setPayoutDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [proofUrl, setProofUrl] = React.useState('');

  React.useEffect(() => {
    setStatus(initialStatus ?? 'pending');
    setPage(1);
  }, [initialStatus]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminFinanceApi.withdrawals({
        status: status || undefined,
        page,
        limit: 20,
        q: q.trim() || undefined,
      });
      setItems(list.items);
      setMeta({
        page: list.page,
        totalPages: list.totalPages,
        total: list.total,
        limit: list.limit,
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not load payouts',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  }, [page, q, status, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openReview = async (item: WalletWithdrawalDto) => {
    setBusy(true);
    try {
      setSelected(await adminFinanceApi.withdrawal(item.id));
      setReason('');
      setPayoutReference('');
      setProofUrl('');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not open request',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await action();
      await load();
      setSelected(await adminFinanceApi.withdrawal(selected.id));
      toast({ type: 'success', title: success });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Action failed',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((item) => (
          <Button
            key={item.id || 'all'}
            size="sm"
            variant={status === item.id ? 'primary' : 'outline'}
            onClick={() => {
              setStatus(item.id);
              setPage(1);
            }}
          >
            {item.label}
          </Button>
        ))}
        <InfoTooltip
          text="A pending request does not move money. Approval sets the amount aside from the provider’s available balance. Mark it completed only after the bank or mobile-money transfer has been sent."
          label="About provider payouts"
        />
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Search withdrawal reference"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              void load();
            }
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Search
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading payouts…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-10 w-10" />}
          title="No payouts with this status"
          description="New provider withdrawal requests will appear here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Provider ID</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Requested on</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.garageName ?? 'Provider'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.mechanicId ?? '—'}</td>
                    <td className="px-4 py-3">{item.reference}</td>
                    <td className="px-4 py-3 font-semibold">{formatCedis(item.amountGhs)}</td>
                    <td className="px-4 py-3">
                      {item.availableGhs != null ? formatCedis(item.availableGhs) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.destination.label} ·••{item.destination.accountLast4}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('en-GH')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => void openReview(item)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <PaginationBar
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={setPage}
              disabled={loading}
            />
          </div>
        </Card>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader title="Review payout" onClose={() => setSelected(null)} />
          <SheetBody>
            {selected && (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">{selected.garageName ?? selected.mechanicId}</p>
                  <p className="text-sm text-muted-foreground">{selected.reference}</p>
                </div>
                <p className="font-display text-2xl font-bold">{formatCedis(selected.amountGhs)}</p>
                <StatusBadge status={selected.status} />
                {selected.wallet && (
                  <p className="text-sm text-muted-foreground">
                    Available {formatCedis(selected.wallet.availableGhs)} · Funds set aside{' '}
                    {formatCedis(selected.wallet.reservedGhs)}
                  </p>
                )}
                <p className="text-sm">
                  {selected.destination.accountName} · {selected.destination.label}
                  {selected.destination.accountNumber
                    ? ` · ${selected.destination.accountNumber}`
                    : ` ·••${selected.destination.accountLast4}`}
                </p>
                {selected.payoutReference && (
                  <p className="text-sm">Payment reference: {selected.payoutReference}</p>
                )}
                {selected.status === 'pending' && (
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Approval will set {formatCedis(selected.amountGhs)} aside from the provider’s
                    available balance. It does not send money and does not require a company wallet.
                  </p>
                )}
                {selected.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => void run(() => adminFinanceApi.approve(selected.id), 'Approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="critical"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        void run(() => adminFinanceApi.reject(selected.id, reason), 'Rejected')
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        void run(() => adminFinanceApi.cancel(selected.id, reason), 'Cancelled')
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {selected.status === 'approved' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Approved requests are not paid yet. Record processing after you start the
                      transfer.
                    </p>
                    <Input
                      placeholder="How you are sending the money"
                      value={payoutMethodUsed}
                      onChange={(event) => setPayoutMethodUsed(event.target.value)}
                    />
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => adminFinanceApi.process(selected.id, payoutMethodUsed),
                          'Marked as processing',
                        )
                      }
                    >
                      Mark as processing
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        void run(() => adminFinanceApi.cancel(selected.id, reason), 'Cancelled')
                      }
                    >
                      Cancel approved request
                    </Button>
                  </div>
                )}
                {selected.status === 'processing' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Bank / MoMo payment reference"
                      value={payoutReference}
                      onChange={(event) => setPayoutReference(event.target.value)}
                    />
                    <Input
                      type="date"
                      value={payoutDate}
                      onChange={(event) => setPayoutDate(event.target.value)}
                    />
                    <Input
                      placeholder="Proof of payment URL (optional)"
                      value={proofUrl}
                      onChange={(event) => setProofUrl(event.target.value)}
                    />
                    <Button
                      disabled={busy || payoutReference.trim().length < 3}
                      onClick={() =>
                        void run(
                          () =>
                            adminFinanceApi.confirm(selected.id, {
                              payoutReference,
                              amountPaidGhs: selected.amountGhs,
                              payoutDate,
                              proofUrl: proofUrl || undefined,
                            }),
                          'Payout confirmed',
                        )
                      }
                    >
                      Confirm payment sent
                    </Button>
                    <Button
                      variant="critical"
                      disabled={busy || reason.trim().length < 3}
                      onClick={() =>
                        void run(() => adminFinanceApi.fail(selected.id, reason), 'Marked failed')
                      }
                    >
                      Mark payout failed
                    </Button>
                  </div>
                )}
                {(selected.status === 'pending' ||
                  selected.status === 'approved' ||
                  selected.status === 'processing') && (
                  <Input
                    placeholder="Reason for reject, cancel or fail"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
