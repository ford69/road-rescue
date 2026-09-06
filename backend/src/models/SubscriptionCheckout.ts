import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { SubscriptionPlanSlug } from '../types/index.js';

export type SubscriptionCheckoutStatus = 'pending' | 'success' | 'failed';

export interface ISubscriptionCheckout extends Document {
  customer: Types.ObjectId;
  user: Types.ObjectId;
  planSlug: SubscriptionPlanSlug;
  provider: 'paystack';
  providerPlanCode: string;
  reference: string;
  amountGhs: number;
  amountPesewas: number;
  currency: 'GHS';
  status: SubscriptionCheckoutStatus;
  authorizationUrl?: string;
  accessCode?: string;
  providerEventId?: string;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionCheckoutSchema = new Schema<ISubscriptionCheckout>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planSlug: { type: String, enum: ['basic'], required: true },
    provider: { type: String, enum: ['paystack'], default: 'paystack' },
    providerPlanCode: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    amountGhs: { type: Number, required: true },
    amountPesewas: { type: Number, required: true },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    authorizationUrl: { type: String },
    accessCode: { type: String },
    providerEventId: { type: String },
    fulfilledAt: { type: Date },
  },
  { timestamps: true },
);

export const SubscriptionCheckout: Model<ISubscriptionCheckout> =
  mongoose.models.SubscriptionCheckout ??
  mongoose.model<ISubscriptionCheckout>('SubscriptionCheckout', subscriptionCheckoutSchema);
