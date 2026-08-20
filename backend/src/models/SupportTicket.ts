import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ISupportTicket extends Document {
  user: Types.ObjectId;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
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
