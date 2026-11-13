import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type {
  AdditionalChargeKind,
  PaymentStatus,
  PricingConfirmationStatus,
  PricingModel,
  RequestStatus,
  ServiceTypeSlug,
} from '../types/index.js';

export interface IPricingChargeSnapshot {
  kind: AdditionalChargeKind;
  label: string;
  amountGhs: number;
  perKmGhs?: number;
  commissionable: boolean;
}

export interface IPricingSnapshot {
  serviceType: ServiceTypeSlug;
  serviceName: string;
  pricingModel: PricingModel;
  basePriceGhs: number;
  additionalCharges: IPricingChargeSnapshot[];
  distanceKm?: number;
  currency: 'GHS';
  displayedTotalGhs: number;
  commissionableAmountGhs: number;
  partsNotIncluded: boolean;
  snapshotAt: Date;
}

export interface IJobQuote {
  amountGhs: number;
  commissionableAmountGhs: number;
  partsGhs: number;
  reason?: string;
  createdAt: Date;
  createdBy: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
}

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
  pricingSnapshot?: IPricingSnapshot;
  pricingConfirmationStatus: PricingConfirmationStatus;
  pendingQuote?: IJobQuote;
  quoteHistory: IJobQuote[];
  commissionHoldPesewas: number;
  commissionCapturedPesewas: number;
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
    quotedPrice: { type: Number, default: 0 },
    pricingSnapshot: { type: Schema.Types.Mixed },
    pricingConfirmationStatus: {
      type: String,
      enum: [
        'unconfirmed',
        'confirmed',
        'pending_quote',
        'quoted',
        'accepted',
        'rejected',
        'pending_revision',
      ],
      default: 'unconfirmed',
    },
    pendingQuote: { type: Schema.Types.Mixed, default: undefined },
    quoteHistory: { type: Schema.Types.Mixed, default: [] },
    commissionHoldPesewas: { type: Number, default: 0, min: 0 },
    commissionCapturedPesewas: { type: Number, default: 0, min: 0 },
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

rescueRequestSchema.set('toJSON', {
  transform(_doc, ret) {
    const value = ret as unknown as Record<string, unknown>;
    value.images = Array.isArray(value.images) ? value.images : [];
    value.quoteHistory = Array.isArray(value.quoteHistory) ? value.quoteHistory : [];
    return value;
  },
});

export const RescueRequest: Model<IRescueRequest> =
  mongoose.models.RescueRequest ??
  mongoose.model<IRescueRequest>('RescueRequest', rescueRequestSchema);
