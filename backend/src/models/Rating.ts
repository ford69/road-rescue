import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IRating extends Document {
  customer: Types.ObjectId;
  mechanic: Types.ObjectId;
  request: Types.ObjectId;
  stars: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', required: true, unique: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

ratingSchema.index({ customer: 1, request: 1 }, { unique: true });
ratingSchema.index({ mechanic: 1, createdAt: -1 });

export const Rating: Model<IRating> =
  mongoose.models.Rating ?? mongoose.model<IRating>('Rating', ratingSchema);
