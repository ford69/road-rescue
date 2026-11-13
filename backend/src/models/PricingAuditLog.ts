import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IPricingAuditLog extends Document {
  actorUser: Types.ObjectId;
  mechanic?: Types.ObjectId;
  action: string;
  serviceType?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const pricingAuditLogSchema = new Schema<IPricingAuditLog>(
  {
    actorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', index: true },
    action: { type: String, required: true, index: true },
    serviceType: { type: String },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PricingAuditLog: Model<IPricingAuditLog> =
  mongoose.models.PricingAuditLog ??
  mongoose.model<IPricingAuditLog>('PricingAuditLog', pricingAuditLogSchema);
