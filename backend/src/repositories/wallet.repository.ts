import { Types } from 'mongoose';
import { ProviderWallet, type IProviderWallet } from '../models/ProviderWallet.js';
import { WalletLedgerEntry, type IWalletLedgerEntry } from '../models/WalletLedgerEntry.js';
import { WalletDeposit, type IWalletDeposit } from '../models/WalletDeposit.js';
import { WalletWithdrawal, type IWalletWithdrawal } from '../models/WalletWithdrawal.js';
import { PayoutMethod, type IPayoutMethod } from '../models/PayoutMethod.js';
import { WalletAuditLog } from '../models/WalletAuditLog.js';
import { SettlementBatch, type ISettlementBatch } from '../models/SettlementBatch.js';
import { CorporateTreasury, CORPORATE_TREASURY_KEY, type ICorporateTreasury } from '../models/CorporateTreasury.js';
import { CorporateCashLedger, type ICorporateCashLedger } from '../models/CorporateCashLedger.js';

export const walletRepository = {
  ensure(mechanicId: string) {
    return ProviderWallet.findOneAndUpdate(
      { mechanic: mechanicId },
      {
        $setOnInsert: {
          mechanic: mechanicId,
          availablePesewas: 0,
          earningsAvailablePesewas: 0,
          pendingPesewas: 0,
          reservedPesewas: 0,
          totalDepositedPesewas: 0,
          totalCommissionPesewas: 0,
          totalEarnedPesewas: 0,
          totalWithdrawnPesewas: 0,
          totalReversedPesewas: 0,
          version: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },

  findByMechanic(mechanicId: string) {
    return ProviderWallet.findOne({ mechanic: mechanicId });
  },

  incrementIf(
    mechanicId: string,
    filter: Record<string, unknown>,
    inc: Record<string, number>,
  ): Promise<IProviderWallet | null> {
    return ProviderWallet.findOneAndUpdate(
      { mechanic: mechanicId, ...filter },
      { $inc: { ...inc, version: 1 } },
      { new: true },
    );
  },

  listAll() {
    return ProviderWallet.find({});
  },
};

export const ledgerRepository = {
  create(data: Partial<IWalletLedgerEntry>) {
    return WalletLedgerEntry.create(data);
  },

  findByIdempotencyKey(key: string) {
    return WalletLedgerEntry.findOne({ idempotencyKey: key });
  },

  findByMechanic(
    mechanicId: string,
    query: { type?: string; skip: number; limit: number },
  ) {
    const filter: Record<string, unknown> = { mechanic: mechanicId };
    if (query.type) filter.type = query.type;
    return WalletLedgerEntry.find(filter).sort({ createdAt: -1 }).skip(query.skip).limit(query.limit);
  },

  countByMechanic(mechanicId: string, type?: string) {
    const filter: Record<string, unknown> = { mechanic: mechanicId };
    if (type) filter.type = type;
    return WalletLedgerEntry.countDocuments(filter);
  },

  findRecent(limit: number) {
    return WalletLedgerEntry.find({}).sort({ createdAt: -1 }).limit(limit);
  },
};

export const depositRepository = {
  create(data: Partial<IWalletDeposit>) {
    return WalletDeposit.create(data);
  },
  findById(id: string) {
    return WalletDeposit.findById(id);
  },
  findByReference(reference: string) {
    return WalletDeposit.findOne({
      $or: [{ reference }, { paystackReference: reference }],
    });
  },
  findByMechanic(mechanicId: string, skip: number, limit: number) {
    return WalletDeposit.find({ mechanic: mechanicId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
  },
  countByMechanic(mechanicId: string) {
    return WalletDeposit.countDocuments({ mechanic: mechanicId });
  },
  findAwaitingSettlement() {
    return WalletDeposit.find({
      status: 'completed',
      settlementStatus: 'pending',
    }).sort({ paidAt: 1, createdAt: 1 });
  },
  claimForSettlement(id: string, batchId: string) {
    return WalletDeposit.findOneAndUpdate(
      {
        _id: id,
        status: 'completed',
        $or: [
          { settlementStatus: 'pending', settlementBatch: { $exists: false } },
          { settlementBatch: batchId },
        ],
      },
      { $set: { settlementStatus: 'settled', settlementBatch: batchId, settledAt: new Date() } },
      { new: true },
    );
  },
};

export const payoutMethodRepository = {
  create(data: Partial<IPayoutMethod>) {
    return PayoutMethod.create(data);
  },
  findById(id: string) {
    return PayoutMethod.findById(id);
  },
  findByMechanic(mechanicId: string) {
    return PayoutMethod.find({ mechanic: mechanicId, active: true }).sort({ isDefault: -1, createdAt: -1 });
  },
  listUnverified() {
    return PayoutMethod.find({ active: true, verified: false })
      .populate('mechanic')
      .sort({ createdAt: -1 })
      .limit(100);
  },
  clearDefault(mechanicId: string) {
    return PayoutMethod.updateMany({ mechanic: mechanicId }, { isDefault: false });
  },
};

export const withdrawalRepository = {
  create(data: Partial<IWalletWithdrawal>) {
    return WalletWithdrawal.create(data);
  },
  findById(id: string) {
    return WalletWithdrawal.findById(id).populate('mechanic').populate('payoutMethod');
  },
  findByReference(reference: string) {
    return WalletWithdrawal.findOne({ reference });
  },
  findByMechanic(mechanicId: string, skip: number, limit: number) {
    return WalletWithdrawal.find({ mechanic: mechanicId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
  },
  countByMechanic(mechanicId: string) {
    return WalletWithdrawal.countDocuments({ mechanic: mechanicId });
  },
  list(filter: Record<string, unknown>, skip: number, limit: number) {
    return WalletWithdrawal.find(filter)
      .populate('mechanic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
  count(filter: Record<string, unknown>) {
    return WalletWithdrawal.countDocuments(filter);
  },
  /** Atomically moves a withdrawal between states; returns null if another request changed it first. */
  transitionStatus(
    id: string,
    from: IWalletWithdrawal['status'][],
    set: Partial<IWalletWithdrawal>,
  ) {
    return WalletWithdrawal.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: set },
      { new: true },
    )
      .populate('mechanic')
      .populate('payoutMethod');
  },
  sumAmount(filter: Record<string, unknown>) {
    return WalletWithdrawal.aggregate<{ _id: null; total: number; count: number }>([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amountPesewas' }, count: { $sum: 1 } } },
    ]);
  },
};

export const walletAuditRepository = {
  create(data: {
    mechanic: string | Types.ObjectId;
    actorUser: string | Types.ObjectId;
    action: string;
    reason?: string;
    amountPesewas?: number;
    reference?: string;
    metadata?: Record<string, unknown>;
  }) {
    return WalletAuditLog.create(data);
  },
};

export const settlementBatchRepository = {
  create(data: Partial<ISettlementBatch>) {
    return SettlementBatch.create(data);
  },
  findById(id: string) {
    return SettlementBatch.findById(id);
  },
  findByReference(settlementReference: string) {
    return SettlementBatch.findOne({
      $or: [{ settlementReference }, { reference: settlementReference }],
    });
  },
  list(filter: Record<string, unknown>, skip: number, limit: number) {
    return SettlementBatch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  },
  count(filter: Record<string, unknown>) {
    return SettlementBatch.countDocuments(filter);
  },
  /** Draft or discrepancy batches still holding Paystack charges that are not yet settled. */
  findOpen() {
    return SettlementBatch.find({ status: { $in: ['draft', 'discrepancy'] } });
  },
  transitionStatus(
    id: string,
    from: ISettlementBatch['status'][],
    set: Partial<ISettlementBatch>,
  ) {
    return SettlementBatch.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: set },
      { new: true },
    );
  },
};

export const corporateTreasuryRepository = {
  ensure() {
    return CorporateTreasury.findOneAndUpdate(
      { key: CORPORATE_TREASURY_KEY },
      {
        $setOnInsert: {
          key: CORPORATE_TREASURY_KEY,
          settledPesewas: 0,
          allocatedPesewas: 0,
          paidPesewas: 0,
          committedPesewas: 0,
          version: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },
  incrementIf(
    filter: Record<string, unknown>,
    inc: Record<string, number>,
  ): Promise<ICorporateTreasury | null> {
    return CorporateTreasury.findOneAndUpdate(
      { key: CORPORATE_TREASURY_KEY, ...filter },
      { $inc: { ...inc, version: 1 } },
      { new: true },
    );
  },
};

export const corporateLedgerRepository = {
  create(data: Partial<ICorporateCashLedger>) {
    return CorporateCashLedger.create(data);
  },
  findRecent(limit: number) {
    return CorporateCashLedger.find({}).sort({ createdAt: -1 }).limit(limit);
  },
};
