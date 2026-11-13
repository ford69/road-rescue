import * as React from 'react';
import { Search } from 'lucide-react';
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
import type { FinanceTransactionDto } from '@/api/types';
import { methodLabel, typeLabel } from '@/lib/finance-display';
import { StatusBadge } from './shared';

const TYPES = [
  { id: '', label: 'All types' },
  { id: 'customer_payment', label: 'Customer payment' },
  { id: 'provider_deposit', label: 'Provider deposit' },
  { id: 'commission', label: 'Commission deduction' },
  { id: 'provider_withdrawal', label: 'Provider withdrawal' },
  { id: 'refund', label: 'Refund' },
  { id: 'adjustment', label: 'Financial adjustment' },
];

const STATUSES = [
  { id: '', label: 'All statuses' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];

const METHODS = [
  { id: '', label: 'All methods' },
  { id: 'card', label: 'Card' },
  { id: 'mobile_money', label: 'Mobile money' },
  { id: 'bank', label: 'Bank' },
  { id: 'wallet', label: 'Wallet' },
];

export function FinanceTransactions({ from, to }: { from: string; to: string }) {
  const { toast } = useToast();
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [method, setMethod] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<FinanceTransactionDto[]>([]);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<FinanceTransactionDto | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFinanceApi.transactions({
        page,
        limit: 20,
        q: q.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
        method: method || undefined,
        from,
        to,
      });
      setItems(result.items);
      setMeta({
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit,
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not load transactions',
        description: error instanceof ApiClientError ? error.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  }, [from, method, page, q, status, to, toast, type]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [from, to, type, status, method]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search reference, job or Paystack id"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setPage(1);
                    void load();
                  }
                }}
              />
            </div>
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
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Transaction type"
            >
              {TYPES.map((item) => (
                <option key={item.id || 'all-types'} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Status"
            >
              {STATUSES.map((item) => (
                <option key={item.id || 'all-status'} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              aria-label="Payment method"
            >
              {METHODS.map((item) => (
                <option key={item.id || 'all-methods'} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading transactions…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="No transactions in this period"
          description="Try a wider date range or clear the filters."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Customer / provider</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    onClick={() => setSelected(item)}
                  >
                    <td className="px-4 py-3 font-medium">{item.reference}</td>
                    <td className="px-4 py-3">
                      {item.customerName ?? item.providerName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.requestId ?? '—'}</td>
                    <td className="px-4 py-3">{typeLabel(item.type)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCedis(item.amountGhs)}</td>
                    <td className="px-4 py-3">
                      {item.commissionGhs != null ? formatCedis(item.commissionGhs) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.date).toLocaleString('en-GH')}
                    </td>
                    <td className="px-4 py-3">{methodLabel(item.method)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
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
          <SheetHeader title="Transaction details" onClose={() => setSelected(null)} />
          <SheetBody>
            {selected && (
              <div className="space-y-4">
                <p className="font-display text-2xl font-bold">{formatCedis(selected.amountGhs)}</p>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
                <dl className="space-y-2 text-sm">
                  <Row label="Reference" value={selected.reference} />
                  <Row label="Type" value={typeLabel(selected.type)} />
                  <Row label="Status" value={<StatusBadge status={selected.status} />} />
                  <Row label="Method" value={methodLabel(selected.method)} />
                  <Row label="Date" value={new Date(selected.date).toLocaleString('en-GH')} />
                  {selected.providerName && <Row label="Provider" value={selected.providerName} />}
                  {selected.customerName && <Row label="Customer" value={selected.customerName} />}
                  {selected.requestId && <Row label="Job" value={selected.requestId} />}
                  {selected.commissionGhs != null && (
                    <Row label="Commission" value={formatCedis(selected.commissionGhs)} />
                  )}
                  {Object.entries(selected.details)
                    .filter(([, value]) => value != null && value !== '')
                    .map(([label, value]) => (
                      <Row key={label} label={label} value={String(value)} />
                    ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  Historical records cannot be edited from this screen.
                </p>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
