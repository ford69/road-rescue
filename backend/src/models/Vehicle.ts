import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IVehicleAttrs {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  make: string;
  /** Vehicle model name (e.g. Corolla). Named vehicleModel to avoid clashing with Document#model. */
  vehicleModel: string;
  colour: string;
  registrationNumber: string;
  year: number;
  engineType: string;
  nickname?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IVehicle = Document<Types.ObjectId> & IVehicleAttrs;

const vehicleSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    make: { type: String, required: true },
    vehicleModel: { type: String, required: true },
    colour: { type: String, required: true },
    registrationNumber: { type: String, required: true, uppercase: true },
    year: { type: Number, required: true },
    engineType: { type: String, default: 'petrol' },
    nickname: { type: String },
  },
  { timestamps: true },
);

export const Vehicle: Model<IVehicle> =
  (mongoose.models.Vehicle as Model<IVehicle>) ??
  mongoose.model<IVehicle>('Vehicle', vehicleSchema);
