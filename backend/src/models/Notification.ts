import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { NotificationType } from '../types/index.js';

export interface INotification extends Document {
  title: string;
  body: string;
  recipient: Types.ObjectId;
  read: boolean;
  type: NotificationType;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    read: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['success', 'info', 'warning', 'critical'],
      default: 'info',
    },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Notification: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>('Notification', notificationSchema);
