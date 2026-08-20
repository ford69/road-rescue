import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  emergencyContacts: IEmergencyContact[];
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String },
      },
    ],
  },
  { timestamps: true },
);

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ?? mongoose.model<ICustomer>('Customer', customerSchema);
