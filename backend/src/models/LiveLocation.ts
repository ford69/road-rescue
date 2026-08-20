import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ILiveLocation extends Document {
  mechanic: Types.ObjectId;
  request?: Types.ObjectId;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const liveLocationSchema = new Schema<ILiveLocation>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const LiveLocation: Model<ILiveLocation> =
  mongoose.models.LiveLocation ?? mongoose.model<ILiveLocation>('LiveLocation', liveLocationSchema);
