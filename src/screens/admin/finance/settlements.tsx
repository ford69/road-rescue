import * as React from 'react';
import { Landmark } from 'lucide-react';
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
import type { SettlementAwaitingItemDto, SettlementBatchDto } from '@/api/types';
import { StatusBadge } from './shared';

export function FinanceSettlements({ initialStatus }: { initialStatus?: string }) {
  const { toast } = useToast();
  const [awaiting, setAwaiting] = React.useState<SettlementAwaitingItemDto[]>([]);
  const [selectedTx, setSelectedTx] = React.useState<string[]>([]);
  const [batches, setBatches] = React.useState<SettlementBatchDto[]>([]);
  const [batchStatus, setBatchStatus] = React.useState(initialStatus ?? '');
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [settlementRef, setSettlementRef] = React.useState('');
  const [amountReceived, setAmountReceived] = React.useState('');
  const [settlementDate, setSettlementDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [bankReference, setBankReference] = React.useState('');
  const [selectedBatch, setSelectedBatch] = React.useState<SettlementBatchDto | null>(null);
  const [resolutionNote, setResolutionNote] = React.useState('');
  const [acceptDifference, setAcceptDifference] = React.useState(false);

  React.useEffect(() => {
    setBatchStatus(initialStatus ?? '');
    setPage(1);
  }, [initialStatus]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pending, list] = await Promise.all([
        adminFinanceApi.awaitingSettlements(),
        adminFinanceApi.settlements({
          page,
          limit: 20,
          status: batchStatus || undefined,
        }),
      ]);
      setAwaiting(pending.items);
      setBatches(list.items);
      setMeta({
        page: list.page,
        totalPages: list.totalPages,
        total: list.total,
        limit: list.limit,
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not load settlements',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  }, [batchStatus, page, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const expected = selectedTx.reduce((sum, key) => {
    const item = awaiting.find((entry) => `${entry.kind}:${entry.id}` === key);
    return sum + (item?.grossGhs ?? 0);
  }, 0);
  const received = Number(amountReceived);
  const difference =
    Number.isFinite(received) && amountReceived !== '' ? received - expected : 0;

  React.useEffect(() => {
    if (selectedTx.length === 0) {
      setAmountReceived('');
      return;
    }
    setAmountReceived(expected.toFixed(2));
  }, [expected, selectedTx.length]);

  const confirmPending = async () => {
    setBusy(true);
    try {
      const result = await adminFinanceApi.createSettlement({
        settlementReference: settlementRef,
        amountReceivedGhs: Number(amountReceived),
        settlementDate,
        bankReference: bankReference || undefined,
        paymentIds: selectedTx
          .filter((item) => item.startsWith('job_payment:'))
          .map((item) => item.slice('job_payment:'.length)),
        depositIds: selectedTx
          .filter((item) => item.startsWith('provider_deposit:'))
          .map((item) => item.slice('provider_deposit:'.length)),
        confirm: true,
      });
      setSelectedTx([]);
      setSettlementRef('');
      setAmountReceived('');
      setBankReference('');
      await load();
      if (result.status === 'discrepancy') {
        setSelectedBatch(result);
        toast({
          type: 'error',
          title: 'Amounts do not match',
          description: `Expected ${formatCedis(result.expectedNetGhs)}, received ${formatCedis(result.amountReceivedGhs)}. Review the difference before confirming.`,
        });
      } else {
        toast({ type: 'success', title: 'Settlement confirmed' });
      }
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not confirm settlement',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  const resolveBatch = async () => {
    if (!selectedBatch) return;
    setBusy(true);
    try {
      const result = await adminFinanceApi.resolveSettlement(selectedBatch.id, {
        acceptDifference,
        note: resolutionNote || undefined,
        bankReference: bankReference || undefined,
      });
      setSelectedBatch(result.status === 'confirmed' ? null : result);
      setResolutionNote('');
      setAcceptDifference(false);
      await load();
      toast({
        type: result.status === 'confirmed' ? 'success' : 'error',
        title: result.status === 'confirmed' ? 'Settlement confirmed' : 'Still needs review',
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not resolve settlement',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-display font-bold">Confirm a Paystack bank credit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This records a bank credit that already arrived. It does not send money and does not
              use an internal company wallet. Select the matching Paystack charges, enter the amount
              received, then confirm. Differences are flagged for review and are never silently
              marked as settled.
            </p>
          </div>
          {loading && awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading pending charges…</p>
          ) : awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Paystack charges waiting for bank confirmation.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {awaiting.map((item) => {
                    const key = `${item.kind}:${item.id}`;
                    return (
                      <tr key={key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedTx.includes(key)}
                            onChange={(event) => {
                              setSelectedTx((current) =>
                                event.target.checked
                                  ? [...current, key]
                                  : current.filter((value) => value !== key),
                              );
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {item.kind === 'job_payment' ? 'Customer payment' : 'Provider deposit'}
                        </td>
                        <td className="px-3 py-2">{item.reference ?? item.id}</td>
                        <td className="px-3 py-2">{formatCedis(item.grossGhs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-lg bg-muted/40 p-4 text-sm">
            <p>
              Expected amount{' '}
              <span className="font-semibold">{formatCedis(expected)}</span>
              {Number.isFinite(received) && amountReceived !== '' && difference !== 0 && (
                <span className="ml-2 text-critical-500">
                  Difference {formatCedis(difference)}
                </span>
              )}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              placeholder="Settlement / Paystack batch reference"
              value={settlementRef}
              onChange={(event) => setSettlementRef(event.target.value)}
            />
            <Input
              placeholder="Amount received in the bank"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
            <Input
              type="date"
              value={settlementDate}
              onChange={(event) => setSettlementDate(event.target.value)}
            />
            <Input
              placeholder="Bank transaction reference"
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
            />
          </div>
          <Button
            disabled={
              busy ||
              selectedTx.length === 0 ||
              !settlementRef.trim() ||
              !amountReceived ||
              !bankReference.trim()
            }
            onClick={() => void confirmPending()}
          >
            {difference !== 0 && amountReceived ? 'Submit with difference' : 'Confirm settlement'}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[
          { id: '', label: 'All batches' },
          { id: 'discrepancy', label: 'Needs review' },
          { id: 'draft', label: 'Draft' },
          { id: 'confirmed', label: 'Confirmed' },
        ].map((item) => (
          <Button
            key={item.id || 'all'}
            size="sm"
            variant={batchStatus === item.id ? 'primary' : 'outline'}
            onClick={() => {
              setBatchStatus(item.id);
              setPage(1);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading && batches.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading settlement history…</p>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-10 w-10" />}
          title="No settlement batches yet"
          description="Confirmed bank receipts will appear here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Settlement ref</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bank reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {batches.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{item.settlementReference}</td>
                    <td className="px-4 py-3">{formatCedis(item.expectedNetGhs)}</td>
                    <td className="px-4 py-3">{formatCedis(item.amountReceivedGhs)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.settlementDate).toLocaleDateString('en-GH')}
                    </td>
                    <td className="px-4 py-3">{item.bankReference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedBatch(item)}>
                        {item.status === 'discrepancy' ? 'Review difference' : 'View'}
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

      <Sheet open={Boolean(selectedBatch)} onOpenChange={(open) => !open && setSelectedBatch(null)}>
        <SheetContent>
          <SheetHeader title="Settlement details" onClose={() => setSelectedBatch(null)} />
          <SheetBody>
            {selectedBatch && (
              <div className="space-y-4">
                <p className="font-semibold">{selectedBatch.settlementReference}</p>
                <StatusBadge status={selectedBatch.status} />
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Expected</dt>
                    <dd className="font-medium">{formatCedis(selectedBatch.expectedNetGhs)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Received</dt>
                    <dd className="font-medium">{formatCedis(selectedBatch.amountReceivedGhs)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Difference</dt>
                    <dd className="font-medium">{formatCedis(selectedBatch.discrepancyGhs)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Bank reference</dt>
                    <dd className="font-medium">{selectedBatch.bankReference ?? '—'}</dd>
                  </div>
                </dl>
                {selectedBatch.status === 'discrepancy' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      This settlement is not confirmed. Enter a note of at least 10 characters and
                      accept the difference only if you have checked the bank statement.
                    </p>
                    <Input
                      placeholder="Why the amounts differ"
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={acceptDifference}
                        onChange={(event) => setAcceptDifference(event.target.checked)}
                      />
                      I have reviewed the difference and accept it
                    </label>
                    <Button
                      disabled={busy || !acceptDifference || resolutionNote.trim().length < 10}
                      onClick={() => void resolveBatch()}
                    >
                      Confirm with difference
                    </Button>
                  </div>
                )}
                {selectedBatch.status === 'confirmed' && (
                  <p className="text-sm text-muted-foreground">
                    This settlement is already confirmed and cannot be confirmed again.
                  </p>
                )}
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
