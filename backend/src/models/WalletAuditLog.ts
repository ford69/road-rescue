import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IWalletAuditLog extends Document {
  mechanic: Types.ObjectId;
  actorUser: Types.ObjectId;
  action: string;
  reason?: string;
  amountPesewas?: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const walletAuditLogSchema = new Schema<IWalletAuditLog>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    actorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, index: true },
    reason: { type: String },
    amountPesewas: { type: Number },
    reference: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const WalletAuditLog: Model<IWalletAuditLog> =
  mongoose.models.WalletAuditLog ??
  mongoose.model<IWalletAuditLog>('WalletAuditLog', walletAuditLogSchema);
