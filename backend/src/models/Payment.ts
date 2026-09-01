import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { PaymentStatus, SettlementStatus } from '../types/index.js';

export interface IPayment extends Document {
  customer: Types.ObjectId;
  mechanic?: Types.ObjectId;
  request: Types.ObjectId;
  /** Gross amount charged to the customer (GHS). */
  grossAmount: number;
  /** @deprecated Use grossAmount — kept for backward compatibility. */
  amount: number;
  platformFee: number;
  /** Recorded provider entitlement — not a Road Rescue wallet balance. */
  providerAmount: number;
  currency: 'GHS';
  paymentProvider: 'paystack';
  paymentMethod: 'paystack' | 'cash' | 'mobile_money' | 'card';
  transactionReference?: string;
  paystackAccessCode?: string;
  providerSubaccountCode?: string;
  channel?: string;
  paidAt?: Date;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  settlementFailureReason?: string;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', index: true },
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', required: true, unique: true },
    grossAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    platformFee: { type: Number, required: true, default: 0 },
    providerAmount: { type: Number, required: true, default: 0 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    paymentProvider: { type: String, enum: ['paystack'], default: 'paystack' },
    paymentMethod: {
      type: String,
      enum: ['paystack', 'cash', 'mobile_money', 'card'],
      default: 'mobile_money',
    },
    transactionReference: { type: String, unique: true, sparse: true },
    paystackAccessCode: { type: String },
    providerSubaccountCode: { type: String },
    channel: { type: String },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    settlementStatus: {
      type: String,
      enum: ['pending', 'processing', 'settled', 'failed'],
      default: 'pending',
    },
    settlementFailureReason: { type: String },
    settledAt: { type: Date },
  },
  { timestamps: true },
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', paymentSchema);
