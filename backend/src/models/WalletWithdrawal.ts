import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type WalletWithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type WalletWithdrawalSource = 'service_earnings' | 'deposit_refund';

export interface IWalletWithdrawal extends Document {
  reference: string;
  mechanic: Types.ObjectId;
  payoutMethod: Types.ObjectId;
  amountPesewas: number;
  currency: 'GHS';
  sourceType: WalletWithdrawalSource;
  status: WalletWithdrawalStatus;
  destinationSnapshot: {
    kind: 'bank' | 'mobile_money';
    label: string;
    accountName: string;
    accountLast4: string;
    bankName?: string;
    network?: string;
  };
  rejectionReason?: string;
  failureReason?: string;
  cancelReason?: string;
  payoutReference?: string;
  payoutMethodUsed?: string;
  amountPaidPesewas?: number;
  payoutDate?: Date;
  proofUrl?: string;
  destinationNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  corporateAllocated: boolean;
  reserved: boolean;
  released: boolean;
  captured: boolean;
  notifiedEvents: string[];
  createdAt: Date;
  updatedAt: Date;
}

const walletWithdrawalSchema = new Schema<IWalletWithdrawal>(
  {
    reference: { type: String, required: true, unique: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    payoutMethod: { type: Schema.Types.ObjectId, ref: 'PayoutMethod', required: true },
    amountPesewas: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    sourceType: {
      type: String,
      enum: ['service_earnings', 'deposit_refund'],
      default: 'deposit_refund',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    destinationSnapshot: {
      kind: { type: String, enum: ['bank', 'mobile_money'], required: true },
      label: { type: String, required: true },
      accountName: { type: String, required: true },
      accountLast4: { type: String, required: true },
      bankName: { type: String },
      network: { type: String },
    },
    rejectionReason: { type: String },
    failureReason: { type: String },
    cancelReason: { type: String },
    payoutReference: { type: String },
    payoutMethodUsed: { type: String },
    amountPaidPesewas: { type: Number, min: 0 },
    payoutDate: { type: Date },
    proofUrl: { type: String },
    destinationNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    corporateAllocated: { type: Boolean, default: false },
    reserved: { type: Boolean, default: false },
    released: { type: Boolean, default: false },
    captured: { type: Boolean, default: false },
    notifiedEvents: [{ type: String }],
  },
  { timestamps: true },
);

walletWithdrawalSchema.index({ mechanic: 1, createdAt: -1 });
walletWithdrawalSchema.index({ status: 1, createdAt: -1 });

export const WalletWithdrawal: Model<IWalletWithdrawal> =
  mongoose.models.WalletWithdrawal ??
  mongoose.model<IWalletWithdrawal>('WalletWithdrawal', walletWithdrawalSchema);
