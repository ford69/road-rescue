import type { Model, PipelineStage } from 'mongoose';
import { Payment } from '../models/Payment.js';
import { ProviderWallet } from '../models/ProviderWallet.js';
import { SettlementBatch } from '../models/SettlementBatch.js';
import { WalletDeposit } from '../models/WalletDeposit.js';
import { WalletLedgerEntry } from '../models/WalletLedgerEntry.js';
import { WalletWithdrawal } from '../models/WalletWithdrawal.js';

export type DateRange = { from: Date; to: Date };

type Totals = { totalPesewas: number; count: number };

const EMPTY: Totals = { totalPesewas: 0, count: 0 };

function within(field: string, range: DateRange) {
  return { [field]: { $gte: range.from, $lte: range.to } };
}

/** Paystack charges are dated by `paidAt`; older rows may only have `createdAt`. */
function paidWithin(range: DateRange) {
  return {
    $or: [
      within('paidAt', range),
      { paidAt: { $exists: false }, ...within('createdAt', range) },
    ],
  };
}

async function sumPesewas(
  model: Pick<Model<unknown>, 'aggregate'>,
  match: Record<string, unknown>,
  amount: unknown,
): Promise<Totals> {
  const pipeline: PipelineStage[] = [
    { $match: match },
    { $group: { _id: null, totalPesewas: { $sum: amount }, count: { $sum: 1 } } },
  ];
  const [row] = await model.aggregate<Totals>(pipeline);
  return row ? { totalPesewas: row.totalPesewas ?? 0, count: row.count ?? 0 } : EMPTY;
}

const ghsFieldToPesewas = (field: string) => ({ $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0] });

export const financeRepository = {
  completedDeposits(range: DateRange) {
    return sumPesewas(WalletDeposit, { status: 'completed', ...paidWithin(range) }, '$amountPesewas');
  },

  paidJobPayments(range: DateRange) {
    const match = { status: 'paid', ...paidWithin(range) };
    return Promise.all([
      sumPesewas(Payment, match, ghsFieldToPesewas('$grossAmount')),
      sumPesewas(Payment, match, ghsFieldToPesewas('$platformFee')),
    ]).then(([gross, fees]) => ({ gross, fees }));
  },

  ledgerTotal(types: string[], range: DateRange) {
    return sumPesewas(
      WalletLedgerEntry,
      { type: { $in: types }, status: 'completed', ...within('createdAt', range) },
      '$amountPesewas',
    );
  },

  /** Job value customers paid providers directly, as recorded on each commission deduction. */
  directJobValue(range: DateRange) {
    return sumPesewas(
      WalletLedgerEntry,
      { type: 'commission_deduction', status: 'completed', ...within('createdAt', range) },
      ghsFieldToPesewas('$metadata.serviceAmountGhs'),
    );
  },

  confirmedSettlements(range: DateRange) {
    return sumPesewas(
      SettlementBatch,
      { status: 'confirmed', ...within('settlementDate', range) },
      '$amountReceivedPesewas',
    );
  },

  withdrawals(match: Record<string, unknown>) {
    return sumPesewas(WalletWithdrawal, match, '$amountPesewas');
  },

  completedWithdrawals(range: DateRange) {
    return sumPesewas(
      WalletWithdrawal,
      { status: 'completed', ...within('confirmedAt', range) },
      '$amountPesewas',
    );
  },

  async walletTotals() {
    const [row] = await ProviderWallet.aggregate<{
      available: number;
      earningsAvailable: number;
      pending: number;
      reserved: number;
      providers: number;
    }>([
      {
        $group: {
          _id: null,
          available: { $sum: '$availablePesewas' },
          earningsAvailable: { $sum: '$earningsAvailablePesewas' },
          pending: { $sum: '$pendingPesewas' },
          reserved: { $sum: '$reservedPesewas' },
          providers: { $sum: 1 },
        },
      },
    ]);
    return row ?? { available: 0, earningsAvailable: 0, pending: 0, reserved: 0, providers: 0 };
  },

  findDeposits(filter: Record<string, unknown>, limit: number) {
    return Promise.all([
      WalletDeposit.find(filter)
        .populate({ path: 'mechanic', select: 'garageName' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      WalletDeposit.countDocuments(filter),
    ]);
  },

  findPayments(filter: Record<string, unknown>, limit: number) {
    return Promise.all([
      Payment.find(filter)
        .populate({ path: 'mechanic', select: 'garageName' })
        .populate({ path: 'customer', select: 'userId', populate: { path: 'userId', select: 'firstName lastName' } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);
  },

  findLedger(filter: Record<string, unknown>, limit: number) {
    return Promise.all([
      WalletLedgerEntry.find(filter)
        .populate({ path: 'mechanic', select: 'garageName' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      WalletLedgerEntry.countDocuments(filter),
    ]);
  },

  findWithdrawals(filter: Record<string, unknown>, limit: number) {
    return Promise.all([
      WalletWithdrawal.find(filter)
        .populate({ path: 'mechanic', select: 'garageName' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      WalletWithdrawal.countDocuments(filter),
    ]);
  },
};
