import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { SubscriptionPlanSlug, SubscriptionStatus } from '../types/index.js';

export interface ISubscription extends Document {
  customer: Types.ObjectId;
  planSlug: SubscriptionPlanSlug;
  status: SubscriptionStatus;
  paystackSubscriptionCode?: string;
  paystackCustomerCode?: string;
  paystackEmailToken?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
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
      enum: ['active', 'cancelled', 'past_due', 'incomplete'],
      default: 'active',
    },
    paystackSubscriptionCode: { type: String },
    paystackCustomerCode: { type: String },
    paystackEmailToken: { type: String },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ??
  mongoose.model<ISubscription>('Subscription', subscriptionSchema);
