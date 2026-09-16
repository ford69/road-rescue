import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ServiceTypeSlug } from '../types/index.js';
import type { ProviderPlanSlug } from '../services/provider-plans.js';

export type ProviderIntentStatus = 'pending_payment' | 'completing' | 'completed' | 'failed';

export interface IProviderRegistrationIntent extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  garageName: string;
  ghanaCardNumber: string;
  experience: number;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  specialties: ServiceTypeSlug[];
  truck?: string;
  selfiePath: string;
  planSlug: ProviderPlanSlug;
  status: ProviderIntentStatus;
  paystackReference: string;
  authorizationUrl?: string;
  accessCode?: string;
  userId?: Types.ObjectId;
  mechanicId?: Types.ObjectId;
  authorizationCode?: string;
  paystackCustomerCode?: string;
  tokenizationRefunded: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const providerRegistrationIntentSchema = new Schema<IProviderRegistrationIntent>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    phone: { type: String, required: true, index: true },
    passwordHash: { type: String, required: true },
    garageName: { type: String, required: true },
    ghanaCardNumber: { type: String, required: true, uppercase: true, index: true },
    experience: { type: Number, default: 0 },
    city: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    specialties: [{ type: String }],
    truck: { type: String },
    selfiePath: { type: String, required: true },
    planSlug: {
      type: String,
      enum: ['provider_monthly', 'provider_quarterly', 'provider_semiannual', 'provider_annual'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_payment', 'completing', 'completed', 'failed'],
      default: 'pending_payment',
      index: true,
    },
    paystackReference: { type: String, required: true, unique: true },
    authorizationUrl: { type: String },
    accessCode: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    mechanicId: { type: Schema.Types.ObjectId, ref: 'Mechanic' },
    authorizationCode: { type: String },
    paystackCustomerCode: { type: String },
    tokenizationRefunded: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

providerRegistrationIntentSchema.index({ email: 1, status: 1 });

export const ProviderRegistrationIntent: Model<IProviderRegistrationIntent> =
  mongoose.models.ProviderRegistrationIntent ??
  mongoose.model<IProviderRegistrationIntent>(
    'ProviderRegistrationIntent',
    providerRegistrationIntentSchema,
  );
