import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const WALLET_LEDGER_SOURCE_TYPES = [
  'service_earnings',
  'provider_deposit',
  'commission',
  'adjustment',
] as const;

export type WalletLedgerSourceType = (typeof WALLET_LEDGER_SOURCE_TYPES)[number];

export const WALLET_LEDGER_TYPES = [
  'deposit',
  'deposit_reversal',
  'commission_reservation',
  'commission_release',
  'commission_deduction',
  'commission_reversal',
  'earning_pending',
  'earning_available',
  'earning_reversal',
  'withdrawal_reservation',
  'withdrawal_completed',
  'withdrawal_release',
  'refund',
  'adjustment',
] as const;

export type WalletLedgerType = (typeof WALLET_LEDGER_TYPES)[number];

export const WALLET_LEDGER_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected',
  'reversed',
] as const;

export type WalletLedgerStatus = (typeof WALLET_LEDGER_STATUSES)[number];

export interface IWalletLedgerEntry extends Document {
  reference: string;
  mechanic: Types.ObjectId;
  type: WalletLedgerType;
  sourceType?: WalletLedgerSourceType;
  amountPesewas: number;
  currency: 'GHS';
  status: WalletLedgerStatus;
  description: string;
  request?: Types.ObjectId;
  withdrawal?: Types.ObjectId;
  deposit?: Types.ObjectId;
  payment?: Types.ObjectId;
  settlement?: Types.ObjectId;
  paystackReference?: string;
  idempotencyKey: string;
  actorType: 'system' | 'provider' | 'admin';
  actorUser?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const walletLedgerEntrySchema = new Schema<IWalletLedgerEntry>(
  {
    reference: { type: String, required: true, unique: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    type: { type: String, enum: WALLET_LEDGER_TYPES, required: true, index: true },
    sourceType: { type: String, enum: WALLET_LEDGER_SOURCE_TYPES, index: true },
    amountPesewas: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    status: { type: String, enum: WALLET_LEDGER_STATUSES, default: 'completed', index: true },
    description: { type: String, required: true },
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', index: true, sparse: true },
    withdrawal: { type: Schema.Types.ObjectId, ref: 'WalletWithdrawal', index: true, sparse: true },
    deposit: { type: Schema.Types.ObjectId, ref: 'WalletDeposit', index: true, sparse: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', index: true, sparse: true },
    settlement: { type: Schema.Types.ObjectId, ref: 'SettlementBatch', index: true, sparse: true },
    paystackReference: { type: String, index: true, sparse: true },
    idempotencyKey: { type: String, required: true, unique: true },
    actorType: { type: String, enum: ['system', 'provider', 'admin'], default: 'system' },
    actorUser: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

walletLedgerEntrySchema.index({ mechanic: 1, createdAt: -1 });
walletLedgerEntrySchema.index({ mechanic: 1, type: 1, createdAt: -1 });
walletLedgerEntrySchema.index(
  { request: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'commission_deduction', request: { $exists: true } },
  },
);

export const WalletLedgerEntry: Model<IWalletLedgerEntry> =
  mongoose.models.WalletLedgerEntry ??
  mongoose.model<IWalletLedgerEntry>('WalletLedgerEntry', walletLedgerEntrySchema);
