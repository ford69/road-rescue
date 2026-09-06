import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IProcessedPaystackEvent extends Document {
  eventKey: string;
  event: string;
  createdAt: Date;
}

const processedPaystackEventSchema = new Schema<IProcessedPaystackEvent>(
  {
    eventKey: { type: String, required: true, unique: true },
    event: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ProcessedPaystackEvent: Model<IProcessedPaystackEvent> =
  mongoose.models.ProcessedPaystackEvent ??
  mongoose.model<IProcessedPaystackEvent>('ProcessedPaystackEvent', processedPaystackEventSchema);
