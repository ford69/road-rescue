import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { financeRepository, type DateRange } from '../repositories/finance.repository.js';
import { corporateCashService } from './corporate-cash.service.js';
import { settlementService } from './settlement.service.js';
import { pesewasToGhs } from '../utils/money.js';
import { ValidationError } from '../utils/errors.js';
import { escapeRegex, paginationMeta, parsePagination } from '../utils/pagination.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FAILED_PAYOUT_LOOKBACK_DAYS = 30;
const MAX_TRANSACTION_WINDOW = 2_000;

export const TRANSACTION_TYPES = [
  'customer_payment',
  'provider_deposit',
  'commission',
  'provider_withdrawal',
  'refund',
  'adjustment',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = [
  'completed',
  'pending',
  'approved',
  'processing',
  'failed',
  'rejected',
  'cancelled',
  'refunded',
] as const;
type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_METHODS = ['card', 'mobile_money', 'bank', 'wallet'] as const;
type TransactionMethod = (typeof TRANSACTION_METHODS)[number];

const LEDGER_TYPES_FOR: Partial<Record<TransactionType, string[]>> = {
  commission: ['commission_deduction'],
  refund: ['refund', 'deposit_reversal', 'commission_reversal', 'earning_reversal'],
  adjustment: ['adjustment'],
};

export function parseRange(query: { from?: unknown; to?: unknown }, now = new Date()): DateRange {
  const parse = (value: unknown, label: string) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new ValidationError(`Enter a valid ${label} date`);
    return date;
  };
  const to = parse(query.to, 'end') ?? now;
  const from = parse(query.from, 'start') ?? new Date(to.getTime() - 30 * DAY_MS);
  if (from > to) throw new ValidationError('The start date must be before the end date');
  return { from, to };
}

function ghs(pesewas: number) {
  return pesewasToGhs(pesewas);
}

function normalizeMethod(raw?: string | null): TransactionMethod | 'other' {
  const value = (raw ?? '').toLowerCase();
  if (value === 'card') return 'card';
  if (value === 'mobile_money' || value === 'momo') return 'mobile_money';
  if (value === 'bank' || value === 'bank_transfer' || value === 'ussd') return 'bank';
  if (value === 'wallet') return 'wallet';
  return 'other';
}

type Populated = { _id?: unknown; garageName?: string } | null | undefined;

function partyName(mechanic: unknown): { id?: string; name?: string } {
  if (!mechanic) return {};
  if (typeof mechanic === 'object' && mechanic !== null && 'garageName' in mechanic) {
    const doc = mechanic as Populated;
    return { id: doc?._id ? String(doc._id) : undefined, name: doc?.garageName };
  }
  return { id: String(mechanic) };
}

function customerName(customer: unknown): { id?: string; name?: string } {
  if (!customer || typeof customer !== 'object') return customer ? { id: String(customer) } : {};
  const doc = customer as { _id?: unknown; userId?: { firstName?: string; lastName?: string } };
  const name = doc.userId ? `${doc.userId.firstName ?? ''} ${doc.userId.lastName ?? ''}`.trim() : undefined;
  return { id: doc._id ? String(doc._id) : undefined, name: name || undefined };
}

export type TransactionRow = {
  id: string;
  reference: string;
  type: TransactionType;
  providerId?: string;
  providerName?: string;
  customerId?: string;
  customerName?: string;
  requestId?: string;
  amountGhs: number;
  commissionGhs?: number;
  direction: 'in' | 'out' | 'internal';
  date: string;
  method: TransactionMethod | 'other';
  status: string;
  description: string;
  details: Record<string, string | number | undefined>;
};

type Filters = {
  type?: TransactionType;
  status?: TransactionStatus;
  method?: TransactionMethod;
  q?: string;
  range?: DateRange;
};

function createdWithin(range?: DateRange) {
  return range ? { createdAt: { $gte: range.from, $lte: range.to } } : {};
}

function searchFilter(q: string | undefined, fields: string[], requestField?: string) {
  if (!q) return {};
  const regex = { $regex: escapeRegex(q), $options: 'i' };
  const or: Record<string, unknown>[] = fields.map((field) => ({ [field]: regex }));
  if (requestField && Types.ObjectId.isValid(q)) or.push({ [requestField]: new Types.ObjectId(q) });
  return { $or: or };
}

/** Each builder returns null when the filters exclude that source entirely. */
function depositFilter(filters: Filters) {
  if (filters.method === 'wallet') return null;
  const status: Partial<Record<TransactionStatus, string[]>> = {
    completed: ['completed'],
    pending: ['pending'],
    failed: ['failed', 'abandoned'],
  };
  if (filters.status && !status[filters.status]) return null;
  const channels: Partial<Record<TransactionMethod, string[]>> = {
    card: ['card'],
    mobile_money: ['mobile_money'],
    bank: ['bank', 'bank_transfer', 'ussd'],
  };
  return {
    ...createdWithin(filters.range),
    ...(filters.status ? { status: { $in: status[filters.status] } } : {}),
    ...(filters.method ? { channel: { $in: channels[filters.method] } } : {}),
    ...searchFilter(filters.q, ['reference', 'paystackReference']),
  };
}

function paymentFilter(filters: Filters) {
  if (filters.method === 'wallet') return null;
  const status: Partial<Record<TransactionStatus, string[]>> = {
    completed: ['paid'],
    pending: ['pending', 'authorized'],
    failed: ['failed'],
    refunded: ['refunded'],
    cancelled: ['cancelled'],
  };
  if (filters.status && !status[filters.status]) return null;
  const methods: Partial<Record<TransactionMethod, string[]>> = {
    card: ['card'],
    mobile_money: ['mobile_money'],
    bank: ['bank', 'bank_transfer', 'ussd'],
  };
  const and: Record<string, unknown>[] = [];
  if (filters.method) {
    and.push({
      $or: [
        { channel: { $in: methods[filters.method] } },
        { paymentMethod: { $in: methods[filters.method] } },
      ],
    });
  }
  const search = searchFilter(filters.q, ['transactionReference'], 'request');
  if ('$or' in search) and.push(search);
  return {
    ...createdWithin(filters.range),
    ...(filters.status ? { status: { $in: status[filters.status] } } : {}),
    ...(and.length ? { $and: and } : {}),
  };
}

function withdrawalFilter(filters: Filters) {
  if (filters.method === 'card' || filters.method === 'wallet') return null;
  if (filters.status === 'refunded') return null;
  return {
    ...createdWithin(filters.range),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { 'destinationSnapshot.kind': filters.method } : {}),
    ...searchFilter(filters.q, ['reference', 'payoutReference']),
  };
}

function ledgerFilter(types: string[], filters: Filters) {
  if (filters.method && filters.method !== 'wallet') return null;
  const status: Partial<Record<TransactionStatus, string>> = {
    completed: 'completed',
    pending: 'pending',
    processing: 'processing',
    failed: 'failed',
    rejected: 'rejected',
    refunded: 'reversed',
  };
  if (filters.status && !status[filters.status]) return null;
  return {
    type: { $in: types },
    ...createdWithin(filters.range),
    ...(filters.status ? { status: status[filters.status] } : {}),
    ...searchFilter(filters.q, ['reference', 'paystackReference'], 'request'),
  };
}

type Lean = Record<string, unknown> & { _id: unknown; createdAt: Date };

function depositRow(doc: Lean): TransactionRow {
  const provider = partyName(doc.mechanic);
  const amount = Number(doc.amountPesewas ?? 0);
  return {
    id: String(doc._id),
    reference: String(doc.paystackReference ?? doc.reference),
    type: 'provider_deposit',
    providerId: provider.id,
    providerName: provider.name,
    amountGhs: ghs(amount),
    direction: 'in',
    date: ((doc.paidAt as Date | undefined) ?? doc.createdAt).toISOString(),
    method: normalizeMethod(doc.channel as string | undefined),
    status: String(doc.status),
    description: 'Provider wallet top-up through Paystack',
    details: {
      'Paystack reference': String(doc.paystackReference ?? ''),
      'Bank confirmation': doc.settlementStatus === 'settled' ? 'Confirmed' : 'Awaiting bank confirmation',
    },
  };
}

function paymentRow(doc: Lean): TransactionRow {
  const provider = partyName(doc.mechanic);
  const customer = customerName(doc.customer);
  const status = String(doc.status) === 'paid' ? 'completed' : String(doc.status);
  return {
    id: String(doc._id),
    reference: String(doc.transactionReference ?? doc._id),
    type: 'customer_payment',
    providerId: provider.id,
    providerName: provider.name,
    customerId: customer.id,
    customerName: customer.name,
    requestId: doc.request ? String(doc.request) : undefined,
    amountGhs: Number(doc.grossAmount ?? doc.amount ?? 0),
    commissionGhs: Number(doc.platformFee ?? 0),
    direction: 'in',
    date: ((doc.paidAt as Date | undefined) ?? doc.createdAt).toISOString(),
    method: normalizeMethod((doc.channel as string | undefined) ?? (doc.paymentMethod as string | undefined)),
    status,
    description: 'Customer payment through Paystack',
    details: {
      'Provider share': Number(doc.providerAmount ?? 0),
      'Bank confirmation': doc.settlementStatus === 'settled' ? 'Confirmed' : 'Awaiting bank confirmation',
    },
  };
}

function withdrawalRow(doc: Lean): TransactionRow {
  const provider = partyName(doc.mechanic);
  const destination = (doc.destinationSnapshot ?? {}) as {
    kind?: string;
    label?: string;
    accountLast4?: string;
  };
  return {
    id: String(doc._id),
    reference: String(doc.reference),
    type: 'provider_withdrawal',
    providerId: provider.id,
    providerName: provider.name,
    amountGhs: ghs(Number(doc.amountPesewas ?? 0)),
    direction: 'out',
    date: doc.createdAt.toISOString(),
    method: normalizeMethod(destination.kind),
    status: String(doc.status),
    description: 'Provider withdrawal request',
    details: {
      Destination: destination.label ? `${destination.label} ·••${destination.accountLast4 ?? ''}` : undefined,
      'Payout reference': (doc.payoutReference as string | undefined) ?? undefined,
      'Paid on': doc.confirmedAt ? (doc.confirmedAt as Date).toISOString() : undefined,
    },
  };
}

function ledgerRow(doc: Lean): TransactionRow {
  const provider = partyName(doc.mechanic);
  const ledgerType = String(doc.type);
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  const amountGhs = ghs(Number(doc.amountPesewas ?? 0));
  const type: TransactionType =
    ledgerType === 'commission_deduction'
      ? 'commission'
      : ledgerType === 'adjustment'
        ? 'adjustment'
        : 'refund';
  const direction: TransactionRow['direction'] =
    type === 'adjustment' ? (metadata.direction === 'debit' ? 'out' : 'in') : 'internal';
  return {
    id: String(doc._id),
    reference: String(doc.reference),
    type,
    providerId: provider.id,
    providerName: provider.name,
    requestId: doc.request ? String(doc.request) : undefined,
    amountGhs,
    commissionGhs: type === 'commission' ? amountGhs : undefined,
    direction,
    date: doc.createdAt.toISOString(),
    method: 'wallet',
    status: String(doc.status),
    description: String(doc.description ?? ''),
    details: {
      'Ledger entry type': ledgerType,
      'Job value': typeof metadata.serviceAmountGhs === 'number' ? metadata.serviceAmountGhs : undefined,
      'Commission rate': typeof metadata.percent === 'number' ? `${metadata.percent}%` : undefined,
      Direction: typeof metadata.direction === 'string' ? metadata.direction : undefined,
      'Recorded by': String(doc.actorType ?? 'system'),
    },
  };
}

function parseEnum<T extends readonly string[]>(value: unknown, allowed: T, label: string) {
  if (value == null || value === '' || value === 'all') return undefined;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new ValidationError(`Unknown ${label}`);
}

export const financeReportService = {
  async listTransactions(query: Record<string, unknown>) {
    const paging = parsePagination(query);
    const window = paging.skip + paging.limit;
    if (window > MAX_TRANSACTION_WINDOW) {
      throw new ValidationError('Narrow the date range or filters to see older transactions');
    }
    const filters: Filters = {
      type: parseEnum(query.type, TRANSACTION_TYPES, 'transaction type'),
      status: parseEnum(query.status, TRANSACTION_STATUSES, 'status'),
      method: parseEnum(query.method, TRANSACTION_METHODS, 'payment method'),
      q: paging.q || undefined,
      range: query.from || query.to ? parseRange(query) : undefined,
    };
    const wants = (type: TransactionType) => !filters.type || filters.type === type;

    const jobs: Array<Promise<{ rows: TransactionRow[]; total: number }>> = [];
    const collect = (
      filter: Record<string, unknown> | null,
      find: (f: Record<string, unknown>, limit: number) => Promise<[unknown[], number]>,
      toRow: (doc: Lean) => TransactionRow,
    ) => {
      if (!filter) return;
      jobs.push(
        find(filter, window).then(([docs, total]) => ({
          rows: (docs as Lean[]).map(toRow),
          total,
        })),
      );
    };

    if (wants('provider_deposit')) {
      collect(depositFilter(filters), financeRepository.findDeposits, depositRow);
    }
    if (wants('customer_payment')) {
      collect(paymentFilter(filters), financeRepository.findPayments, paymentRow);
    }
    if (wants('provider_withdrawal')) {
      collect(withdrawalFilter(filters), financeRepository.findWithdrawals, withdrawalRow);
    }
    const ledgerTypes = (Object.keys(LEDGER_TYPES_FOR) as TransactionType[])
      .filter(wants)
      .flatMap((type) => LEDGER_TYPES_FOR[type] ?? []);
    if (ledgerTypes.length) {
      collect(ledgerFilter(ledgerTypes, filters), financeRepository.findLedger, ledgerRow);
    }

    const results = await Promise.all(jobs);
    const total = results.reduce((sum, result) => sum + result.total, 0);
    const items = results
      .flatMap((result) => result.rows)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(paging.skip, window);
    return { items, ...paginationMeta(total, paging.page, paging.limit) };
  },

  async summary(query: { from?: unknown; to?: unknown }, now = new Date()) {
    const range = parseRange(query, now);
    const failedSince = new Date(now.getTime() - FAILED_PAYOUT_LOOKBACK_DAYS * DAY_MS);
    const [
      deposits,
      jobPayments,
      commission,
      commissionReversed,
      directJobs,
      settlements,
      payoutsCompleted,
      wallets,
      awaiting,
      pendingWithdrawals,
      inProgressWithdrawals,
      failedWithdrawals,
      cash,
    ] = await Promise.all([
      financeRepository.completedDeposits(range),
      financeRepository.paidJobPayments(range),
      financeRepository.ledgerTotal(['commission_deduction'], range),
      financeRepository.ledgerTotal(['commission_reversal'], range),
      financeRepository.directJobValue(range),
      financeRepository.confirmedSettlements(range),
      financeRepository.completedWithdrawals(range),
      financeRepository.walletTotals(),
      settlementService.awaitingSummary(),
      financeRepository.withdrawals({ status: 'pending' }),
      financeRepository.withdrawals({ status: { $in: ['approved', 'processing'] } }),
      financeRepository.withdrawals({ status: 'failed', updatedAt: { $gte: failedSince } }),
      corporateCashService.snapshot(),
    ]);

    const collectedPesewas = deposits.totalPesewas + jobPayments.gross.totalPesewas;
    const roadRescuePesewas =
      commission.totalPesewas - commissionReversed.totalPesewas + jobPayments.fees.totalPesewas;
    const withdrawalHoldsPesewas = pendingWithdrawals.totalPesewas + inProgressWithdrawals.totalPesewas;
    const jobHoldsPesewas = Math.max(0, wallets.reserved - withdrawalHoldsPesewas);
    const providerAvailablePesewas = wallets.available + wallets.earningsAvailable;
    const providerTotalPesewas = providerAvailablePesewas + wallets.reserved + wallets.pending;
    const awaitingPesewas = awaiting.unsettledPesewas + awaiting.openBatchPesewas;

    const needsAttention = [
      {
        id: 'settlements_pending',
        title: 'Paystack payments awaiting bank confirmation',
        description: 'Match these payments to the money Paystack paid into the company bank account.',
        count: awaiting.unsettledCount,
        amountGhs: ghs(awaiting.unsettledPesewas),
        severity: 'warning' as const,
        action: { tab: 'settlements' as const },
      },
      {
        id: 'settlement_discrepancies',
        title: 'Settlements that do not match',
        description: 'The amount received differs from what was expected. Review before confirming.',
        count: awaiting.discrepancyCount,
        amountGhs: ghs(awaiting.discrepancyPesewas),
        severity: 'critical' as const,
        action: { tab: 'settlements' as const, status: 'discrepancy' },
      },
      {
        id: 'withdrawals_pending',
        title: 'Provider withdrawal requests to review',
        description: 'Approve or reject each request.',
        count: pendingWithdrawals.count,
        amountGhs: ghs(pendingWithdrawals.totalPesewas),
        severity: 'warning' as const,
        action: { tab: 'payouts' as const, status: 'pending' },
      },
      {
        id: 'payouts_in_progress',
        title: 'Approved payouts not yet confirmed as paid',
        description: 'Send the money, then record the payment reference to complete the payout.',
        count: inProgressWithdrawals.count,
        amountGhs: ghs(inProgressWithdrawals.totalPesewas),
        severity: 'warning' as const,
        action: { tab: 'payouts' as const, status: 'in_progress' },
      },
      {
        id: 'payouts_failed',
        title: `Failed provider payouts (last ${FAILED_PAYOUT_LOOKBACK_DAYS} days)`,
        description: 'Funds were returned to the provider. Contact them before retrying.',
        count: failedWithdrawals.count,
        amountGhs: ghs(failedWithdrawals.totalPesewas),
        severity: 'critical' as const,
        action: { tab: 'payouts' as const, status: 'failed' },
      },
    ].filter((item) => item.count > 0);

    const recent = await this.listTransactions({
      page: 1,
      limit: 8,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });

    return {
      currency: 'GHS' as const,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      commissionPercent: env.PROVIDER_COMMISSION_PERCENT,
      collected: {
        totalGhs: ghs(collectedPesewas),
        count: deposits.count + jobPayments.gross.count,
        providerDepositsGhs: ghs(deposits.totalPesewas),
        providerDepositCount: deposits.count,
        customerPaymentsGhs: ghs(jobPayments.gross.totalPesewas),
        customerPaymentCount: jobPayments.gross.count,
        confirmedBankReceiptsGhs: ghs(settlements.totalPesewas),
        confirmedSettlementCount: settlements.count,
        directCustomerPaymentsGhs: ghs(directJobs.totalPesewas),
        directJobCount: directJobs.count,
      },
      providerEarnings: {
        totalGhs: ghs(providerTotalPesewas),
        availableGhs: ghs(providerAvailablePesewas),
        setAsideGhs: ghs(wallets.reserved),
        setAsideForWithdrawalsGhs: ghs(Math.min(wallets.reserved, withdrawalHoldsPesewas)),
        setAsideForActiveJobsGhs: ghs(jobHoldsPesewas),
        awaitingBankConfirmationGhs: ghs(wallets.pending),
        providerCount: wallets.providers,
      },
      roadRescueEarnings: {
        totalGhs: ghs(roadRescuePesewas),
        commissionDeductedGhs: ghs(commission.totalPesewas),
        commissionReversedGhs: ghs(commissionReversed.totalPesewas),
        inAppPaymentFeesGhs: ghs(jobPayments.fees.totalPesewas),
        jobCount: commission.count + jobPayments.fees.count,
      },
      awaitingSettlement: {
        totalGhs: ghs(awaitingPesewas),
        transactionCount: awaiting.unsettledCount,
        openBatchCount: awaiting.openBatchCount,
        discrepancyCount: awaiting.discrepancyCount,
      },
      providerPayments: {
        totalGhs: ghs(payoutsCompleted.totalPesewas),
        count: payoutsCompleted.count,
        inProgressGhs: ghs(inProgressWithdrawals.totalPesewas),
        inProgressCount: inProgressWithdrawals.count,
      },
      companyFunds: {
        availableGhs: cash.unallocatedPayoutCashGhs,
        confirmedBankReceiptsGhs: cash.settledGhs,
        payoutsAssignedGhs: cash.allocatedGhs,
        paidOutGhs: cash.paidGhs,
        obligationsGhs: cash.committedGhs,
      },
      needsAttention,
      recentActivity: recent.items,
    };
  },
};