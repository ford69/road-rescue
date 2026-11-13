import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type WalletDepositStatus = 'pending' | 'completed' | 'failed' | 'abandoned';

export interface IWalletDeposit extends Document {
  reference: string;
  mechanic: Types.ObjectId;
  amountPesewas: number;
  currency: 'GHS';
  status: WalletDepositStatus;
  settlementStatus: 'pending' | 'settled';
  settlementBatch?: Types.ObjectId;
  settledAt?: Date;
  channel?: string;
  authorizationUrl?: string;
  accessCode?: string;
  paystackReference: string;
  credited: boolean;
  notified: boolean;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const walletDepositSchema = new Schema<IWalletDeposit>(
  {
    reference: { type: String, required: true, unique: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    amountPesewas: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'abandoned'],
      default: 'pending',
      index: true,
    },
    settlementStatus: {
      type: String,
      enum: ['pending', 'settled'],
      default: 'pending',
      index: true,
    },
    settlementBatch: { type: Schema.Types.ObjectId, ref: 'SettlementBatch', index: true, sparse: true },
    settledAt: { type: Date },
    channel: { type: String },
    authorizationUrl: { type: String },
    accessCode: { type: String },
    paystackReference: { type: String, required: true, unique: true },
    credited: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

walletDepositSchema.index({ mechanic: 1, createdAt: -1 });

export const WalletDeposit: Model<IWalletDeposit> =
  mongoose.models.WalletDeposit ??
  mongoose.model<IWalletDeposit>('WalletDeposit', walletDepositSchema);
