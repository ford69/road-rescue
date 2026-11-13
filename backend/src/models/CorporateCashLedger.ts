import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const CORPORATE_LEDGER_TYPES = [
  'settlement_received',
  'payout_allocated',
  'payout_released',
  'payout_completed',
  'other_commitment',
  'other_commitment_release',
  'adjustment',
] as const;

export type CorporateLedgerType = (typeof CORPORATE_LEDGER_TYPES)[number];

export interface ICorporateCashLedger extends Document {
  reference: string;
  type: CorporateLedgerType;
  amountPesewas: number;
  currency: 'GHS';
  direction: 'credit' | 'debit';
  description: string;
  relatedSettlement?: Types.ObjectId;
  relatedWithdrawal?: Types.ObjectId;
  idempotencyKey: string;
  createdBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const corporateCashLedgerSchema = new Schema<ICorporateCashLedger>(
  {
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: CORPORATE_LEDGER_TYPES, required: true, index: true },
    amountPesewas: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    description: { type: String, required: true },
    relatedSettlement: { type: Schema.Types.ObjectId, ref: 'SettlementBatch', index: true, sparse: true },
    relatedWithdrawal: { type: Schema.Types.ObjectId, ref: 'WalletWithdrawal', index: true, sparse: true },
    idempotencyKey: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

corporateCashLedgerSchema.index({ createdAt: -1 });

export const CorporateCashLedger: Model<ICorporateCashLedger> =
  mongoose.models.CorporateCashLedger ??
  mongoose.model<ICorporateCashLedger>('CorporateCashLedger', corporateCashLedgerSchema);
