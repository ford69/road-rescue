import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ProviderPlanSlug } from '../services/provider-plans.js';

export type ProviderSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'incomplete';

export interface IProviderSubscription extends Document {
  mechanic: Types.ObjectId;
  user: Types.ObjectId;
  planSlug: ProviderPlanSlug;
  status: ProviderSubscriptionStatus;
  provider: 'paystack' | 'none';
  providerPlanCode?: string;
  paystackSubscriptionCode?: string;
  paystackCustomerCode?: string;
    lastTransactionReference?: string;
  paystackAuthorizationCode?: string;
  billingStartsAt?: Date;
  cardAuthorizedAt?: Date;
  tokenizationRefunded?: boolean;
  trialUsed: boolean;
  trialEndsAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const providerSubscriptionSchema = new Schema<IProviderSubscription>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planSlug: {
      type: String,
      enum: ['provider_monthly', 'provider_quarterly', 'provider_semiannual', 'provider_annual'],
      required: true,
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled', 'expired', 'incomplete'],
      default: 'incomplete',
    },
    provider: { type: String, enum: ['paystack', 'none'], default: 'none' },
    providerPlanCode: { type: String },
    paystackSubscriptionCode: { type: String, index: true, sparse: true },
    paystackCustomerCode: { type: String },
    lastTransactionReference: { type: String, index: true, sparse: true },
    paystackAuthorizationCode: { type: String },
    billingStartsAt: { type: Date },
    cardAuthorizedAt: { type: Date },
    tokenizationRefunded: { type: Boolean, default: false },
    trialUsed: { type: Boolean, default: false },
    trialEndsAt: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

export const ProviderSubscription: Model<IProviderSubscription> =
  mongoose.models.ProviderSubscription ??
  mongoose.model<IProviderSubscription>('ProviderSubscription', providerSubscriptionSchema);
