import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ServiceTypeSlug } from '../types/index.js';

export interface IServiceType extends Document {
  slug: ServiceTypeSlug;
  name: string;
  description: string;
  estimatedPrice: number;
  icon: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceTypeSchema = new Schema<IServiceType>(
  {
    slug: {
      type: String,
      enum: ['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    estimatedPrice: { type: Number, required: true },
    icon: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ServiceType: Model<IServiceType> =
  mongoose.models.ServiceType ?? mongoose.model<IServiceType>('ServiceType', serviceTypeSchema);
