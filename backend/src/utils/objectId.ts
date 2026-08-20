import mongoose from 'mongoose';
import { ValidationError } from './errors.js';

export function assertObjectId(id: string, label = 'id'): string {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return id;
}

export function refId(value: unknown): string {
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}
