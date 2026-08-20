import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IAssignment extends Document {
  request: Types.ObjectId;
  mechanic: Types.ObjectId;
  customer: Types.ObjectId;
  status: 'offered' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  offeredAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'RescueRequest', required: true, index: true },
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    status: {
      type: String,
      enum: ['offered', 'accepted', 'declined', 'completed', 'cancelled'],
      default: 'offered',
    },
    offeredAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

assignmentSchema.index({ request: 1, mechanic: 1 }, { unique: true });

export const Assignment: Model<IAssignment> =
  mongoose.models.Assignment ?? mongoose.model<IAssignment>('Assignment', assignmentSchema);
