import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { PaymentStatus, RequestStatus, ServiceTypeSlug } from '../types/index.js';

export interface IRescueRequest extends Document {
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  mechanic?: Types.ObjectId;
  vehicle: Types.ObjectId;
  serviceType: ServiceTypeSlug;
  pickupLocation: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  destination?: {
    address: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
  description?: string;
  images: string[];
  status: RequestStatus;
  quotedPrice: number;
  paymentStatus: PaymentStatus;
  acceptedAt?: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  completionRequestedAt?: Date;
  completionRequestedBy?: Types.ObjectId;
  customerConfirmedAt?: Date;
  customerConfirmedBy?: Types.ObjectId;
  issueReportedAt?: Date;
  issueReportedBy?: Types.ObjectId;
  issueReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const rescueRequestSchema = new Schema<IRescueRequest>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    serviceType: {
      type: String,
      enum: ['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other'],
      required: true,
    },
    pickupLocation: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: {
      address: { type: String },
      city: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    description: { type: String },
    images: [{ type: String }],
    status: {
      type: String,
      enum: [
        'requested',
        'accepted',
        'enroute',
        'arrived',
        'inprogress',
        'awaiting_confirmation',
        'issue_reported',
        'completed',
        'cancelled',
      ],
      default: 'requested',
      index: true,
    },
    quotedPrice: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    acceptedAt: { type: Date },
    arrivedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    completionRequestedAt: { type: Date },
    completionRequestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    customerConfirmedAt: { type: Date },
    customerConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    issueReportedAt: { type: Date },
    issueReportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    issueReason: { type: String },
  },
  { timestamps: true },
);

export const RescueRequest: Model<IRescueRequest> =
  mongoose.models.RescueRequest ??
  mongoose.model<IRescueRequest>('RescueRequest', rescueRequestSchema);
