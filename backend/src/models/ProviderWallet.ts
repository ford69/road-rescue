import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IProviderWallet extends Document {
  mechanic: Types.ObjectId;
  currency: 'GHS';
  /** Prepaid commission float. Not customer service earnings. */
  availablePesewas: number;
  /** Settled service earnings eligible for withdrawal. */
  earningsAvailablePesewas: number;
  /** Service earnings awaiting Paystack T+1 settlement confirmation. */
  pendingPesewas: number;
  reservedPesewas: number;
  totalDepositedPesewas: number;
  totalCommissionPesewas: number;
  totalEarnedPesewas: number;
  totalWithdrawnPesewas: number;
  totalReversedPesewas: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerWalletSchema = new Schema<IProviderWallet>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, unique: true },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    availablePesewas: { type: Number, default: 0, min: 0 },
    earningsAvailablePesewas: { type: Number, default: 0, min: 0 },
    pendingPesewas: { type: Number, default: 0, min: 0 },
    reservedPesewas: { type: Number, default: 0, min: 0 },
    totalDepositedPesewas: { type: Number, default: 0, min: 0 },
    totalCommissionPesewas: { type: Number, default: 0, min: 0 },
    totalEarnedPesewas: { type: Number, default: 0, min: 0 },
    totalWithdrawnPesewas: { type: Number, default: 0, min: 0 },
    totalReversedPesewas: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ProviderWallet: Model<IProviderWallet> =
  mongoose.models.ProviderWallet ??
  mongoose.model<IProviderWallet>('ProviderWallet', providerWalletSchema);
