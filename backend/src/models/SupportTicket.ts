import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ISupportTicket extends Document {
  user: Types.ObjectId;
  subject: string;
  description: string;
  category: 'complaint' | 'billing' | 'account' | 'rescue' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    category: {
      type: String,
      enum: ['complaint', 'billing', 'account', 'rescue', 'other'],
      default: 'complaint',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
  },
  { timestamps: true },
);

export const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ??
  mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
