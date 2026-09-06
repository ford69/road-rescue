import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { SubscriptionPlanSlug, SubscriptionStatus } from '../types/index.js';

export interface ISubscription extends Document {
  customer: Types.ObjectId;
  planSlug: SubscriptionPlanSlug;
  status: SubscriptionStatus;
  provider: 'paystack' | 'none';
  providerPlanCode?: string;
  paystackSubscriptionCode?: string;
  paystackCustomerCode?: string;
  paystackEmailToken?: string;
  lastTransactionReference?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
    planSlug: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'non_renewing', 'cancelled', 'past_due', 'incomplete', 'expired'],
      default: 'active',
    },
    provider: { type: String, enum: ['paystack', 'none'], default: 'none' },
    providerPlanCode: { type: String },
    paystackSubscriptionCode: { type: String, index: true, sparse: true },
    paystackCustomerCode: { type: String },
    paystackEmailToken: { type: String },
    lastTransactionReference: { type: String, index: true, sparse: true },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ??
  mongoose.model<ISubscription>('Subscription', subscriptionSchema);
