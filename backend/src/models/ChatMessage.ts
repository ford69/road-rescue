import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IChatMessage extends Document {
  request: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

chatMessageSchema.index({ request: 1, createdAt: 1 });

export const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ?? mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
