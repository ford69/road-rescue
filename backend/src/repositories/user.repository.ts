import { User, type IUser } from '../models/User.js';
import type { Role } from '../types/index.js';

export const userRepository = {
  create(data: Partial<IUser>) {
    return User.create(data);
  },

  findByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase() });
  },

  findByEmailWithSecrets(email: string) {
    return User.findOne({ email: email.toLowerCase() }).select(
      '+password +refreshTokenHash +emailVerificationToken +emailVerificationExpires +passwordResetToken +passwordResetExpires',
    );
  },

  findById(id: string) {
    return User.findById(id);
  },

  findByIdWithSecrets(id: string) {
    return User.findById(id).select(
      '+password +refreshTokenHash +emailVerificationToken +emailVerificationExpires +passwordResetToken +passwordResetExpires',
    );
  },

  findByPhone(phone: string) {
    return User.findOne({ phone });
  },

  findByEmailVerificationToken(tokenHash: string) {
    return User.findOne({ emailVerificationToken: tokenHash }).select(
      '+emailVerificationToken +emailVerificationExpires',
    );
  },

  findByPasswordResetToken(tokenHash: string) {
    return User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');
  },

  findByRole(role: Role) {
    return User.find({ role }).sort({ createdAt: -1 });
  },

  countByRole(role: Role) {
    return User.countDocuments({ role });
  },

  deleteById(id: string) {
    return User.deleteOne({ _id: id });
  },
};
