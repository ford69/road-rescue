import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import type { Role, UserStatus } from '../types/index.js';

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  avatar?: string;
  status: UserStatus;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokenHash?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'mechanic', 'admin'], required: true },
    avatar: { type: String },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending'],
      default: 'active',
    },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    lastLogin: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);
