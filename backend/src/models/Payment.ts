import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { PaymentStatus } from '../types/index.js';

export interface IPayment extends Document {
  customer: Types.ObjectId;
  mechanic?: Types.ObjectId;
  request: Types.ObjectId;
  amount: number;
  currency: 'GHS';
  paymentMethod: 'paystack' | 'cash' | 'mobile_money' | 'card';
  transactionReference?: string;
  paystackAccessCode?: string;
  channel?: string;
  paidAt?: Date;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic' },
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    paymentMethod: {
      type: String,
      enum: ['paystack', 'cash', 'mobile_money', 'card'],
      default: 'mobile_money',
    },
    transactionReference: { type: String, unique: true, sparse: true },
    paystackAccessCode: { type: String },
    channel: { type: String },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', paymentSchema);
