import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type SettlementBatchStatus = 'draft' | 'discrepancy' | 'confirmed';
export type SettlementItemKind = 'job_payment' | 'provider_deposit';

export interface ISettlementItem {
  kind: SettlementItemKind;
  payment?: Types.ObjectId;
  deposit?: Types.ObjectId;
  mechanic?: Types.ObjectId;
  amountPesewas: number;
  entitlementPesewas: number;
}

export interface ISettlementBatch extends Document {
  reference: string;
  settlementReference: string;
  paystackReference?: string;
  bankReference?: string;
  amountReceivedPesewas: number;
  /** Gross Paystack charges included in this batch. */
  expectedGrossPesewas: number;
  /** Paystack fees deducted before payout, as shown on the Paystack settlement report. */
  paystackFeesPesewas: number;
  /** Received minus (gross minus fees). Zero when reconciled exactly. */
  discrepancyPesewas: number;
  currency: 'GHS';
  settlementDate: Date;
  status: SettlementBatchStatus;
  items: ISettlementItem[];
  notes?: string;
  resolutionNote?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdBy: Types.ObjectId;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const settlementItemSchema = new Schema<ISettlementItem>(
  {
    kind: { type: String, enum: ['job_payment', 'provider_deposit'], required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    deposit: { type: Schema.Types.ObjectId, ref: 'WalletDeposit' },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic' },
    amountPesewas: { type: Number, required: true, min: 0 },
    entitlementPesewas: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const settlementBatchSchema = new Schema<ISettlementBatch>(
  {
    reference: { type: String, required: true, unique: true },
    settlementReference: { type: String, required: true, unique: true, trim: true },
    paystackReference: { type: String, trim: true, index: true, sparse: true },
    bankReference: { type: String, trim: true },
    amountReceivedPesewas: { type: Number, required: true, min: 1 },
    expectedGrossPesewas: { type: Number, default: 0, min: 0 },
    paystackFeesPesewas: { type: Number, default: 0, min: 0 },
    discrepancyPesewas: { type: Number, default: 0 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    settlementDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'discrepancy', 'confirmed'],
      default: 'draft',
      index: true,
    },
    items: { type: [settlementItemSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 1000 },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

settlementBatchSchema.index({ status: 1, createdAt: -1 });

export const SettlementBatch: Model<ISettlementBatch> =
  mongoose.models.SettlementBatch ??
  mongoose.model<ISettlementBatch>('SettlementBatch', settlementBatchSchema);
