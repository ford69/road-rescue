import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type PayoutMethodKind = 'bank' | 'mobile_money';
export type MobileMoneyNetwork = 'mtn' | 'vodafone' | 'airteltigo';

export interface IPayoutMethod extends Document {
  mechanic: Types.ObjectId;
  kind: PayoutMethodKind;
  label: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  network?: MobileMoneyNetwork;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const payoutMethodSchema = new Schema<IPayoutMethod>(
  {
    mechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', required: true, index: true },
    kind: { type: String, enum: ['bank', 'mobile_money'], required: true },
    label: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bankCode: { type: String, trim: true },
    bankName: { type: String, trim: true },
    network: { type: String, enum: ['mtn', 'vodafone', 'airteltigo'] },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

payoutMethodSchema.index({ mechanic: 1, active: 1 });

export const PayoutMethod: Model<IPayoutMethod> =
  mongoose.models.PayoutMethod ?? mongoose.model<IPayoutMethod>('PayoutMethod', payoutMethodSchema);
