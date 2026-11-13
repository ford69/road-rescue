import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { AdditionalChargeKind, PricingModel, ServiceTypeSlug } from '../types/index.js';

export interface IAdditionalCharge {
  kind: AdditionalChargeKind;
  label: string;
  amountGhs: number;
  perKmGhs?: number;
  commissionable: boolean;
}

export interface IProviderServicePricing extends Document {
  _id: Types.ObjectId;
  mechanic: Types.ObjectId;
  serviceType: ServiceTypeSlug;
  pricingModel: PricingModel;
  basePriceGhs: number;
  currency: 'GHS';
  additionalCharges: IAdditionalCharge[];
  partsNotIncluded: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const additionalChargeSchema = new Schema<IAdditionalCharge>(
  {
    kind: {
      type: String,
      enum: ['call_out', 'distance', 'emergency', 'inspection', 'labour', 'other'],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    amountGhs: { type: Number, default: 0, min: 0 },
    perKmGhs: { type: Number, min: 0 },
    commissionable: { type: Boolean, default: true },
  },
  { _id: false },
);

const providerServicePricingSchema = new Schema<IProviderServicePricing>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    serviceType: {
      type: String,
      enum: ['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other'],
      required: true,
    },
    pricingModel: {
      type: String,
      enum: ['fixed', 'starting_from', 'quote'],
      required: true,
    },
    basePriceGhs: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['GHS'], default: 'GHS' },
    additionalCharges: { type: [additionalChargeSchema], default: [] },
    partsNotIncluded: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

providerServicePricingSchema.index({ mechanic: 1, serviceType: 1 }, { unique: true });
providerServicePricingSchema.index({ serviceType: 1, active: 1 });

export const ProviderServicePricing: Model<IProviderServicePricing> =
  mongoose.models.ProviderServicePricing ??
  mongoose.model<IProviderServicePricing>('ProviderServicePricing', providerServicePricingSchema);
