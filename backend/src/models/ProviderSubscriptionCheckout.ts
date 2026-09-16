import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ProviderPlanSlug } from '../services/provider-plans.js';

export type ProviderCheckoutKind = 'card_authorization' | 'subscription_charge';

export type ProviderCheckoutStatus = 'pending' | 'success' | 'failed';

export interface IProviderSubscriptionCheckout extends Document {
  mechanic: Types.ObjectId;
  user: Types.ObjectId;
  planSlug: ProviderPlanSlug;
  provider: 'paystack';
  kind: ProviderCheckoutKind;
  providerPlanCode: string;
  reference: string;
  amountGhs: number;
  amountPesewas: number;
  currency: 'GHS';
  status: ProviderCheckoutStatus;
  authorizationUrl?: string;
  accessCode?: string;
  providerEventId?: string;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const providerSubscriptionCheckoutSchema = new Schema<IProviderSubscriptionCheckout>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planSlug: {
      type: String,
      enum: ['provider_monthly', 'provider_quarterly', 'provider_semiannual', 'provider_annual'],
      required: true,
    },
    provider: { type: String, enum: ['paystack'], default: 'paystack' },
    kind: {
      type: String,
      enum: ['card_authorization', 'subscription_charge'],
      default: 'card_authorization',
    },
    providerPlanCode: { type: String, required: true, default: 'none' },
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

export const ProviderSubscriptionCheckout: Model<IProviderSubscriptionCheckout> =
  mongoose.models.ProviderSubscriptionCheckout ??
  mongoose.model<IProviderSubscriptionCheckout>(
    'ProviderSubscriptionCheckout',
    providerSubscriptionCheckoutSchema,
  );
