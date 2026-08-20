import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { ServiceTypeSlug, VerificationStatus } from '../types/index.js';

export interface IMechanic extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  garageName: string;
  ghanaCardNumber?: string;
  experience: number;
  location: {
    city: string;
    address: string;
  };
  latitude: number;
  longitude: number;
  specialties: ServiceTypeSlug[];
  availability: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  earnings: number;
  verificationStatus: VerificationStatus;
  documents: string[];
  truck?: string;
  createdAt: Date;
  updatedAt: Date;
}

const mechanicSchema = new Schema<IMechanic>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    garageName: { type: String, required: true },
    ghanaCardNumber: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    experience: { type: Number, default: 0 },
    location: {
      city: { type: String, required: true },
      address: { type: String, required: true },
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    specialties: [
      {
        type: String,
        enum: ['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other'],
      },
    ],
    availability: { type: Boolean, default: false },
    rating: { type: Number, default: 5 },
    reviewCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'pending',
    },
    documents: [{ type: String }],
    truck: { type: String },
  },
  { timestamps: true },
);

mechanicSchema.index({ latitude: 1, longitude: 1 });
mechanicSchema.index({ availability: 1, verificationStatus: 1 });

export const Mechanic: Model<IMechanic> =
  mongoose.models.Mechanic ?? mongoose.model<IMechanic>('Mechanic', mechanicSchema);
