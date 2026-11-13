import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const CORPORATE_TREASURY_KEY = 'default';

export interface ICorporateTreasury extends Document {
  key: string;
  currency: 'GHS';
  /** Lifetime confirmed Paystack / bank receipts. */
  settledPesewas: number;
  /** Cash reserved for approved or processing provider payouts. */
  allocatedPesewas: number;
  /** Lifetime successful provider payouts. */
  paidPesewas: number;
  /** Other committed company obligations that must not be paid to providers. */
  committedPesewas: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const corporateTreasurySchema = new Schema<ICorporateTreasury>(
  {
    key: { type: String, required: true, unique: true, default: CORPORATE_TREASURY_KEY },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    settledPesewas: { type: Number, default: 0, min: 0 },
    allocatedPesewas: { type: Number, default: 0, min: 0 },
    paidPesewas: { type: Number, default: 0, min: 0 },
    committedPesewas: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const CorporateTreasury: Model<ICorporateTreasury> =
  mongoose.models.CorporateTreasury ??
  mongoose.model<ICorporateTreasury>('CorporateTreasury', corporateTreasurySchema);
