import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote, Plus, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { PaginationBar } from '@/components/ui/pagination';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { walletApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { formatGhs } from '@/lib/currency';
import { useToast } from '@/components/ui/toast';
import type {
  PayoutMethodDto,
  ProviderWalletDto,
  WalletDepositDto,
  WalletTransactionDto,
  WalletWithdrawalDto,
} from '@/api/types';

type Tab = 'overview' | 'deposits' | 'commissions' | 'withdrawals' | 'ledger' | 'payouts';

function statusVariant(status: string): 'success' | 'warning' | 'critical' | 'subtle' {
  if (status === 'completed' || status === 'approved') return 'success';
  if (status === 'pending' || status === 'processing') return 'warning';
  if (status === 'failed' || status === 'rejected' || status === 'abandoned') return 'critical';
  return 'subtle';
}

export function MechanicWallet() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = React.useState<Tab>('overview');
  const [wallet, setWallet] = React.useState<ProviderWalletDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [depositAmount, setDepositAmount] = React.useState('200');
  const [withdrawAmount, setWithdrawAmount] = React.useState('100');
  const [busy, setBusy] = React.useState(false);
  const [deposits, setDeposits] = React.useState<WalletDepositDto[]>([]);
  const [withdrawals, setWithdrawals] = React.useState<WalletWithdrawalDto[]>([]);
  const [ledger, setLedger] = React.useState<WalletTransactionDto[]>([]);
  const [commissions, setCommissions] = React.useState<WalletTransactionDto[]>([]);
  const [methods, setMethods] = React.useState<PayoutMethodDto[]>([]);
  const [selectedMethodId, setSelectedMethodId] = React.useState('');
  const [ledgerMeta, setLedgerMeta] = React.useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [payoutKind, setPayoutKind] = React.useState<'bank' | 'mobile_money'>('mobile_money');
  const [payoutForm, setPayoutForm] = React.useState({
    label: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    network: 'mtn' as 'mtn' | 'vodafone' | 'airteltigo',
  });

  const load = React.useCallback(async () => {
    const [nextWallet, depositPage, withdrawalPage, methodList, ledgerPage, commissionPage] =
      await Promise.all([
      walletApi.get(),
      walletApi.deposits({ page: 1, limit: 20 }),
      walletApi.withdrawals({ page: 1, limit: 20 }),
      walletApi.payoutMethods(),
      walletApi.transactions({ page: 1, limit: 20 }),
      walletApi.transactions({ page: 1, limit: 20, type: 'commission_deduction' }),
    ]);
    setWallet(nextWallet);
    setDeposits(depositPage.items);
    setWithdrawals(withdrawalPage.items);
    setMethods(methodList);
    setLedger(ledgerPage.items);
    setLedgerMeta({
      page: ledgerPage.page,
      totalPages: ledgerPage.totalPages,
      total: ledgerPage.total,
      limit: ledgerPage.limit,
    });
    setCommissions(commissionPage.items);
    setSelectedMethodId((current) => {
      if (current && methodList.some((item) => item.id === current)) return current;
      const preferred = methodList.find((item) => item.isDefault) ?? methodList[0];
      return preferred?.id ?? '';
    });
  }, []);

  const loadLedger = React.useCallback(async (page: number, type?: string) => {
    const result = await walletApi.transactions({ page, limit: 20, type });
    if (type === 'commission_deduction') {
      setCommissions(result.items);
    } else {
      setLedger(result.items);
      setLedgerMeta({
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit,
      });
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    void (async () => {
      try {
        if (reference) {
          const verified = await walletApi.verifyDeposit(reference);
          toast({
            type: verified.status === 'completed' ? 'success' : 'error',
            title: verified.status === 'completed' ? 'Deposit received' : 'Deposit not completed',
            description:
              verified.status === 'completed'
                ? 'Your available balance has been updated from the verified Paystack payment.'
                : 'Paystack did not confirm this payment. No funds were added.',
          });
          setSearchParams({}, { replace: true });
        }
        if (!cancelled) {
          await load();
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            type: 'error',
            title: 'Could not load wallet',
            description: error instanceof ApiClientError ? error.message : 'Please try again.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadLedger, searchParams, setSearchParams, toast]);

  const deposit = async () => {
    const amount = Number(depositAmount);
    if (!wallet || !Number.isFinite(amount)) return;
    if (amount < wallet.minDepositGhs) {
      toast({
        type: 'error',
        title: 'Amount too low',
        description: `Minimum deposit is ${formatGhs(wallet.minDepositGhs)}.`,
      });
      return;
    }
    setBusy(true);
    try {
      const result = await walletApi.initiateDeposit(amount);
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not start deposit',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!wallet || !selectedMethodId) {
      toast({ type: 'error', title: 'Choose a payout destination first' });
      return;
    }
    setBusy(true);
    try {
      await walletApi.requestWithdrawal(amount, selectedMethodId, 'deposit_refund');
      await load();
      toast({
        type: 'success',
        title: 'Withdrawal submitted',
        description: 'An administrator will review the request. Your available balance is unchanged until it is approved.',
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Withdrawal failed',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const savePayoutMethod = async () => {
    setBusy(true);
    try {
      const created = await walletApi.addPayoutMethod({
        kind: payoutKind,
        label: payoutForm.label,
        accountName: payoutForm.accountName,
        accountNumber: payoutForm.accountNumber,
        bankName: payoutKind === 'bank' ? payoutForm.bankName : undefined,
        network: payoutKind === 'mobile_money' ? payoutForm.network : undefined,
        isDefault: methods.length === 0,
      });
      setPayoutOpen(false);
      setSelectedMethodId(created.id);
      await load();
      toast({ type: 'success', title: 'Payout destination saved' });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not save destination',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading wallet…</p>;
  }
  if (!wallet) {
    return (
      <EmptyState
        icon={<Wallet className="h-10 w-10" />}
        title="Wallet unavailable"
        description="Sign in as a provider to manage deposits and withdrawals."
      />
    );
  }

  const pendingRequestGhs =
    wallet.pendingWithdrawalGhs ??
    withdrawals.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amountGhs, 0);
  const inPayoutGhs =
    wallet.payoutInProgressGhs ??
    withdrawals
      .filter((item) => ['approved', 'processing'].includes(item.status))
      .reduce((sum, item) => sum + item.amountGhs, 0);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'deposits', label: 'Deposits' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'withdrawals', label: 'Withdrawals' },
    { id: 'ledger', label: 'Transactions' },
    { id: 'payouts', label: 'Payout methods' },
  ];

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposits credit your available balance. Completing a job deducts {wallet.commissionPercent}%
          commission from that balance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Available balance" value={formatGhs(wallet.availableGhs, 2)} />
        <Summary label="Pending requests" value={formatGhs(pendingRequestGhs, 2)} />
        <Summary label="Approved / processing" value={formatGhs(inPayoutGhs, 2)} />
        <Summary label="Completed withdrawals" value={formatGhs(wallet.totalWithdrawnGhs, 2)} />
      </div>
      <p className="text-sm text-muted-foreground">
        Commission deducted {formatGhs(wallet.totalCommissionGhs, 2)}. Pending requests do not reduce
        available balance. Approved payouts are set aside until the transfer is confirmed or returned.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={tab === item.id ? 'primary' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="space-y-3 p-5">
              <h2 className="font-display font-bold">Deposit funds</h2>
              <p className="text-sm text-muted-foreground">
                Minimum {formatGhs(wallet.minDepositGhs)}. Currency is GHS. Paystack confirms the
                amount on the server before your available balance changes.
              </p>
              <Input
                type="number"
                min={wallet.minDepositGhs}
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                aria-label="Deposit amount in GHS"
              />
              <Button disabled={busy} onClick={() => void deposit()}>
                {busy ? 'Redirecting…' : 'Pay with Paystack'}
              </Button>
            </div>
          </Card>
          <Card>
            <div className="space-y-3 p-5">
              <h2 className="font-display font-bold">Withdraw</h2>
              <p className="text-sm text-muted-foreground">
                Withdraw from your available balance to a bank account or mobile money wallet.
                Limits {formatGhs(wallet.minWithdrawalGhs)}–{formatGhs(wallet.maxWithdrawalGhs)}.
              </p>
              {methods.length === 0 ? (
                <Button variant="outline" onClick={() => setPayoutOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add payout destination
                </Button>
              ) : (
                <>
                  <Input
                    type="number"
                    min={wallet.minWithdrawalGhs}
                    max={wallet.availableGhs}
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    aria-label="Withdrawal amount in GHS"
                  />
                  <select
                    className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
                    value={selectedMethodId}
                    onChange={(event) => setSelectedMethodId(event.target.value)}
                  >
                    <option value="">Select payout destination</option>
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.label} ·••{method.accountLast4}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !selectedMethodId || wallet.availableGhs <= 0}
                    onClick={() => void withdraw()}
                  >
                    Submit withdrawal
                  </Button>
                </>
              )}
            </div>
          </Card>
          {withdrawals.length > 0 && (
            <Card className="lg:col-span-2">
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display font-bold">Recent withdrawals</h2>
                  <Button size="sm" variant="outline" onClick={() => setTab('withdrawals')}>
                    View all
                  </Button>
                </div>
                <ul className="space-y-2 text-sm">
                  {withdrawals.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <span>
                        {formatGhs(item.amountGhs, 2)} · {item.destination.label}
                      </span>
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'deposits' && (
        <HistoryTable
          empty="No deposits yet"
          rows={deposits.map((item) => [
            item.reference,
            formatGhs(item.amountGhs, 2),
            item.channel ?? 'Paystack',
            item.status,
            new Date(item.createdAt).toLocaleString('en-GH'),
          ])}
          headers={['Reference', 'Amount', 'Method', 'Status', 'Date']}
        />
      )}

      {tab === 'commissions' && (
        <HistoryTable
          empty="No commission deductions yet"
          rows={commissions.map((item) => [
            item.requestId ?? item.reference,
            item.description,
            formatGhs(item.amountGhs, 2),
            item.status,
            new Date(item.createdAt).toLocaleString('en-GH'),
          ])}
          headers={['Job / reference', 'Description', 'Amount', 'Status', 'Date']}
        />
      )}

      {tab === 'withdrawals' && (
        <HistoryTable
          empty="No withdrawal requests"
          rows={withdrawals.map((item) => [
            item.reference,
            item.sourceType === 'deposit_refund' ? 'Available balance' : 'Service earnings',
            formatGhs(item.amountGhs, 2),
            `${item.destination.label} ·••${item.destination.accountLast4}`,
            item.status,
            new Date(item.createdAt).toLocaleString('en-GH'),
          ])}
          headers={['Reference', 'Source', 'Amount', 'Destination', 'Status', 'Requested']}
        />
      )}

      {tab === 'ledger' && (
        <div className="space-y-3">
          <HistoryTable
            empty="No ledger entries"
            rows={ledger.map((item) => [
              item.reference,
              item.description,
              item.type,
              formatGhs(item.amountGhs, 2),
              item.status,
              new Date(item.createdAt).toLocaleString('en-GH'),
            ])}
            headers={['Reference', 'Description', 'Type', 'Amount', 'Status', 'Date']}
          />
          <PaginationBar
            page={ledgerMeta.page}
            totalPages={ledgerMeta.totalPages}
            total={ledgerMeta.total}
            limit={ledgerMeta.limit}
            onPageChange={(page) => {
              void loadLedger(page);
            }}
            disabled={busy}
          />
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-3">
          <Button variant="outline" onClick={() => setPayoutOpen(true)}>
            <Plus className="h-4 w-4" />
            Add payout destination
          </Button>
          {methods.length === 0 ? (
            <EmptyState
              icon={<Banknote className="h-10 w-10" />}
              title="No payout destinations"
              description="Add a Ghanaian bank account or mobile money wallet before withdrawing."
            />
          ) : (
            methods.map((method) => (
              <Card key={method.id}>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{method.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {method.accountName} ·••{method.accountLast4}
                      {method.bankName ? ` · ${method.bankName}` : ''}
                      {method.network ? ` · ${method.network}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.isDefault && <Badge variant="primary">Default</Badge>}
                    {!method.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void walletApi.updatePayoutMethod(method.id, { isDefault: true }).then(load)
                        }
                      >
                        Make default
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Sheet open={payoutOpen} onOpenChange={setPayoutOpen}>
        <SheetContent>
          <SheetHeader title="Payout destination" onClose={() => setPayoutOpen(false)} />
          <SheetBody>
            <div className="space-y-3">
              <select
                className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
                value={payoutKind}
                onChange={(event) => setPayoutKind(event.target.value as 'bank' | 'mobile_money')}
              >
                <option value="mobile_money">Mobile money</option>
                <option value="bank">Bank account</option>
              </select>
              <Input
                placeholder="Label"
                value={payoutForm.label}
                onChange={(event) => setPayoutForm((current) => ({ ...current, label: event.target.value }))}
              />
              <Input
                placeholder="Account name"
                value={payoutForm.accountName}
                onChange={(event) =>
                  setPayoutForm((current) => ({ ...current, accountName: event.target.value }))
                }
              />
              <Input
                placeholder={payoutKind === 'bank' ? 'Account number' : 'Mobile money number'}
                value={payoutForm.accountNumber}
                onChange={(event) =>
                  setPayoutForm((current) => ({ ...current, accountNumber: event.target.value }))
                }
              />
              {payoutKind === 'bank' ? (
                <Input
                  placeholder="Bank name"
                  value={payoutForm.bankName}
                  onChange={(event) =>
                    setPayoutForm((current) => ({ ...current, bankName: event.target.value }))
                  }
                />
              ) : (
                <select
                  className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
                  value={payoutForm.network}
                  onChange={(event) =>
                    setPayoutForm((current) => ({
                      ...current,
                      network: event.target.value as 'mtn' | 'vodafone' | 'airteltigo',
                    }))
                  }
                >
                  <option value="mtn">MTN</option>
                  <option value="vodafone">Telecel / Vodafone</option>
                  <option value="airteltigo">AirtelTigo</option>
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Use this destination to withdraw your available balance to bank or mobile money.
              </p>
              <Button disabled={busy} onClick={() => void savePayoutMethod()}>
                Save destination
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function HistoryTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-10 w-10" />}
        title={empty}
        description="Activity from the ledger will appear here."
      />
    );
  }
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-b border-border last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-4 py-3">
                    {cellIndex === row.length - 2 ? (
                      <Badge variant={statusVariant(cell)}>{cell}</Badge>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
