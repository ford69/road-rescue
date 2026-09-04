import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { SubscriptionFeature, SubscriptionPlanSlug } from '../types/index.js';

export interface ISubscriptionPlan extends Document {
  slug: SubscriptionPlanSlug;
  name: string;
  description: string;
  monthlyPriceGhs: number;
  features: SubscriptionFeature[];
  paystackPlanCode?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    slug: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    monthlyPriceGhs: { type: Number, required: true, default: 0 },
    features: {
      type: [String],
      default: [],
    },
    paystackPlanCode: { type: String },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

subscriptionPlanSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.features = Array.isArray(ret.features) ? ret.features : [];
    return ret;
  },
});

export const SubscriptionPlan: Model<ISubscriptionPlan> =
  mongoose.models.SubscriptionPlan ??
  mongoose.model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);
