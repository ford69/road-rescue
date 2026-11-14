import * as React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { adminFinanceApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { formatCedis } from '@/lib/currency';
import type { FinanceSummaryDto } from '@/api/types';
import { typeLabel, type FinanceTab } from '@/lib/finance-display';
import { MoneyCard, StatusBadge } from './shared';

export function FinanceOverview({
  from,
  to,
  onNavigate,
}: {
  from: string;
  to: string;
  onNavigate: (tab: FinanceTab, status?: string) => void;
}) {
  const [summary, setSummary] = React.useState<FinanceSummaryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void adminFinanceApi
      .summary({ from, to })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null);
          const status = err instanceof ApiClientError ? err.status : 0;
          setError(
            status === 404
              ? 'The finance API is not running on this server yet. Rebuild and restart the production API, then refresh.'
              : err instanceof ApiClientError
                ? err.message
                : 'Try again',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading overview…</p>;
  }
  if (!summary) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10" />}
        title="Finance data unavailable"
        description={error ?? 'Administrator access is required.'}
      />
    );
  }

  const collectedParts = [
    summary.collected.providerDepositCount
      ? `${formatCedis(summary.collected.providerDepositsGhs)} in provider deposits`
      : null,
    summary.collected.customerPaymentCount
      ? `${formatCedis(summary.collected.customerPaymentsGhs)} in in-app customer payments`
      : null,
    `Confirmed in the bank: ${formatCedis(summary.collected.confirmedBankReceiptsGhs)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MoneyCard
          title="Total collected"
          amount={summary.collected.totalGhs}
          subtitle={collectedParts}
          hint="Successful Paystack charges in this period. Failed or reversed payments are excluded. Confirmed bank receipts are money that has already arrived in the company account."
          badge={<Badge variant="subtle">{summary.collected.count} payments</Badge>}
        />
        <MoneyCard
          title="Provider earnings"
          amount={summary.providerEarnings.totalGhs}
          subtitle={`Available ${formatCedis(summary.providerEarnings.availableGhs)} · Set aside ${formatCedis(summary.providerEarnings.setAsideGhs)} · Awaiting bank ${formatCedis(summary.providerEarnings.awaitingBankConfirmationGhs)}`}
          hint="Current outstanding provider balances. This is not filtered by date. Paid-out amounts are excluded."
          badge={<Badge variant="subtle">Current</Badge>}
        />
        <MoneyCard
          title="Road Rescue earnings"
          amount={summary.roadRescueEarnings.totalGhs}
          subtitle={`${summary.commissionPercent}% commission on ${summary.roadRescueEarnings.jobCount} jobs. Provider funds are not included.`}
          hint="Platform commission using the configured rate. Reversals in this period are already subtracted."
        />
        <MoneyCard
          title="Awaiting settlement"
          amount={summary.awaitingSettlement.totalGhs}
          subtitle={`${summary.awaitingSettlement.transactionCount} Paystack charges still waiting for bank confirmation${summary.awaitingSettlement.openBatchCount ? ` · ${summary.awaitingSettlement.openBatchCount} batches open` : ''}.`}
          hint="Money Paystack has charged but that has not yet been matched to a bank credit."
          badge={
            summary.awaitingSettlement.discrepancyCount > 0 ? (
              <Badge variant="critical">{summary.awaitingSettlement.discrepancyCount} mismatch</Badge>
            ) : summary.awaitingSettlement.transactionCount > 0 ? (
              <Badge variant="warning">Action needed</Badge>
            ) : (
              <Badge variant="success">Clear</Badge>
            )
          }
        />
        <MoneyCard
          title="Provider payments completed"
          amount={summary.providerPayments.totalGhs}
          subtitle={
            summary.providerPayments.inProgressCount
              ? `${summary.providerPayments.count} paid · ${summary.providerPayments.inProgressCount} still being sent`
              : `${summary.providerPayments.count} completed payouts`
          }
          hint="Only payouts confirmed as sent. Approved or processing requests are not counted here."
        />
      </div>

      {summary.collected.directJobCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Customers also paid providers {formatCedis(summary.collected.directCustomerPaymentsGhs)}{' '}
          directly on {summary.collected.directJobCount} jobs. That money never entered the company
          bank account.
        </p>
      )}

      <Card>
        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-display font-bold">Needs attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only items that still need an administrator to act.
            </p>
          </div>
          {summary.needsAttention.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success-500" />
              No outstanding financial actions.
            </div>
          ) : (
            <div className="space-y-2">
              {summary.needsAttention.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.title}</p>
                      <Badge variant={item.severity === 'critical' ? 'critical' : 'warning'}>
                        {item.count} {item.count === 1 ? 'item' : 'items'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-1 text-sm font-medium">{formatCedis(item.amountGhs)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(item.action.tab, item.action.status)}
                  >
                    Review
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-bold">Recent activity</h2>
              <Button size="sm" variant="outline" onClick={() => onNavigate('transactions')}>
                All transactions
              </Button>
            </div>
            {summary.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : (
              <ul className="space-y-3">
                {summary.recentActivity.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.description || typeLabel(item.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel(item.type)} · {item.providerName ?? item.customerName ?? item.reference}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatCedis(item.amountGhs)}</p>
                      <StatusBadge status={item.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card>
          <div className="space-y-4 p-5">
            <h2 className="font-display font-bold">Quick links</h2>
            <div className="space-y-2">
              <Button fullWidth variant="outline" onClick={() => onNavigate('payouts', 'pending')}>
                Review withdrawal requests
              </Button>
              <Button fullWidth variant="outline" onClick={() => onNavigate('settlements')}>
                Confirm bank settlements
              </Button>
              <Button fullWidth variant="outline" onClick={() => onNavigate('transactions')}>
                Search transactions
              </Button>
            </div>
            <div className="space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <p>
                Available company funds{' '}
                <span className="font-medium text-foreground">
                  {formatCedis(summary.companyFunds.availableGhs)}
                </span>
              </p>
              <p>
                Confirmed bank receipts{' '}
                <span className="font-medium text-foreground">
                  {formatCedis(summary.companyFunds.confirmedBankReceiptsGhs)}
                </span>
              </p>
              <p>
                Payouts assigned{' '}
                <span className="font-medium text-foreground">
                  {formatCedis(summary.companyFunds.payoutsAssignedGhs)}
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
