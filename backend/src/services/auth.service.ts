import type { Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  comparePassword,
  compareToken,
  createRandomToken,
  createTokenPair,
  hashPassword,
  hashSha256,
  hashToken,
  verifyRefreshToken,
} from '../auth/tokens.js';
import { createEmailVerification, evaluateVerificationToken, isLegacyAccount } from '../auth/email-verification.js';
import { customerRepository } from '../repositories/customer.repository.js';
import type { IMechanic } from '../models/Mechanic.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { Role } from '../types/index.js';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  AuthErrorCode,
} from '../utils/errors.js';
import type {
  createAdminSchema,
  loginSchema,
  registerCustomerSchema,
  registerMechanicSchema,
  resetPasswordSchema,
} from '../validators/auth.validators.js';
import type { z } from 'zod';
import { getPublicUploadPath } from '../uploads/storage.js';
import { emailService } from '../email/index.js';
import { subscriptionService } from './subscription.service.js';
import { entitlementService } from './entitlement.service.js';
import { isPaidCustomerPlan } from './plan-access.js';

type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
type RegisterMechanicInput = z.infer<typeof registerMechanicSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
type CreateAdminInput = z.infer<typeof createAdminSchema>;

function sanitizeUser(user: {
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  avatar?: string;
  status: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date | null;
  lastLogin?: Date;
  createdAt: Date;
}) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar ?? null,
    status: user.status,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    lastLogin: user.lastLogin ?? null,
    createdAt: user.createdAt,
  };
}

async function presentAuthUser(user: Parameters<typeof sanitizeUser>[0] & { role: Role; _id: { toString(): string } }) {
  const base = sanitizeUser(user);
  if (user.role !== 'customer') {
    return { ...base, hasActiveSubscription: true as const };
  }
  const entitlements = await entitlementService.getCustomerEntitlements(user._id.toString());
  return {
    ...base,
    hasActiveSubscription: isPaidCustomerPlan(entitlements.planSlug, entitlements.status),
    subscriptionPlanSlug: entitlements.planSlug,
    subscriptionStatus: entitlements.status,
  };
}

async function issueSession(
  user: { _id: { toString(): string }; role: Role; email: string; refreshTokenHash?: string; lastLogin?: Date; save: () => Promise<unknown> },
  res: Response,
  touchLastLogin: boolean,
) {
  const tokens = createTokenPair(user._id.toString(), user.role, user.email);
  user.refreshTokenHash = await hashToken(tokens.refreshToken);
  if (touchLastLogin) {
    user.lastLogin = new Date();
  }
  await user.save();
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  return tokens;
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  // Frontend (roadrescue4u.com) and API (api.roadrescue4u.com) are cross-site.
  // SameSite=None is required for the browser to accept/send cookies on fetch.
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (env.COOKIE_SECURE ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
  res.cookie('accessToken', accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res: Response): void {
  const common = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (env.COOKIE_SECURE ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', common);
  res.clearCookie('refreshToken', common);
}

export const authService = {
  async registerCustomer(input: RegisterCustomerInput, res: Response) {
    await ensureUniqueIdentity(input.email, input.phone);
    const password = await hashPassword(input.password);
    const verification = createEmailVerification();

    const user = await userRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password,
      role: 'customer',
      status: 'active',
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: verification.tokenHash,
      emailVerificationExpires: verification.expiresAt,
    });

    await customerRepository.create({ userId: user._id, emergencyContacts: [] });
    await subscriptionService.ensureFreePlanForCustomer(user._id.toString());
    await notificationRepository.create({
      title: 'Welcome to Road Rescue Ghana',
      body: 'Verify your email and complete Basic membership to start requesting roadside help.',
      recipient: user._id,
      type: 'success',
    });

    void emailService
      .sendVerificationEmail({
        email: user.email,
        firstName: user.firstName,
        token: verification.token,
      })
      .catch((error: unknown) => {
        logger.error('Customer verification email failed', {
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    const tokens = await issueSession(user, res, false);
    return {
      ...registrationPendingResponse(user.email, verification.token),
      requiresSubscription: true,
      user: await presentAuthUser(user),
      tokens,
    };
  },

  async registerMechanic(
    input: RegisterMechanicInput,
    selfie: Express.Multer.File | undefined,
    _res: Response,
  ) {
    if (!selfie) {
      throw new ValidationError('A clear selfie photo is required');
    }
    await ensureUniqueIdentity(input.email, input.phone);
    await resolveGhanaCardConflict(input.ghanaCardNumber, input.email);
    const password = await hashPassword(input.password);
    const verification = createEmailVerification();
    const selfiePath = getPublicUploadPath(selfie.filename);

    const user = await userRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password,
      role: 'mechanic',
      avatar: selfiePath,
      status: 'pending',
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: verification.tokenHash,
      emailVerificationExpires: verification.expiresAt,
    });

    try {
      await mechanicRepository.create({
        userId: user._id,
        garageName: input.garageName,
        ghanaCardNumber: input.ghanaCardNumber,
        experience: input.experience,
        location: { city: input.city, address: input.address },
        latitude: input.latitude,
        longitude: input.longitude,
        specialties: input.specialties,
        availability: false,
        verificationStatus: 'pending',
        truck: input.truck,
        documents: [selfiePath],
      });
    } catch (error) {
      await userRepository.deleteById(user._id.toString());
      if (isDuplicateGhanaCardError(error)) {
        try {
          await handleGhanaCardConflict(input.ghanaCardNumber, input.email);
        } catch (conflict) {
          throw conflict;
        }
        throw new ConflictError(
          'Registration was interrupted by a stale mechanic record. Please submit the form again.',
        );
      }
      throw error;
    }

    await notificationRepository.create({
      title: 'Mechanic application received',
      body: 'Your Road Rescue Ghana mechanic profile is pending verification.',
      recipient: user._id,
      type: 'info',
    });

    void Promise.all([
      emailService.sendVerificationEmail({
        email: user.email,
        firstName: user.firstName,
        token: verification.token,
      }),
      emailService.sendMechanicApplicationReceivedEmail({
        email: user.email,
        firstName: user.firstName,
        garageName: input.garageName,
      }),
    ]).catch((error: unknown) => {
      logger.error('Mechanic registration email flow failed', {
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return registrationPendingResponse(user.email, verification.token);
  },

  async createAdmin(input: CreateAdminInput, actorRole: Role) {
    if (actorRole !== 'admin') {
      throw new ForbiddenError('Only administrators can create admin accounts');
    }
    await ensureUniqueIdentity(input.email, input.phone);
    const password = await hashPassword(input.password);
    const user = await userRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });
    return sanitizeUser(user);
  },

  async login(input: LoginInput, res: Response) {
    return this.completeLogin(input, res);
  },

  async loginAdmin(input: LoginInput, res: Response) {
    return this.completeLogin(input, res, 'admin');
  },

  async completeLogin(input: LoginInput, res: Response, requiredRole?: Role) {
    const user = await userRepository.findByEmailWithSecrets(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenError('Account suspended. Contact Road Rescue support.');
    }
    if (requiredRole && user.role !== requiredRole) {
      // Same message as bad credentials — do not reveal account role.
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.emailVerified && isLegacyAccount(user)) {
      user.emailVerified = true;
      user.emailVerifiedAt = user.lastLogin ?? new Date();
      await user.save();
    }

    const tokens = await issueSession(user, res, user.emailVerified);
    return { user: await presentAuthUser(user), tokens };
  },

  async logout(userId: string | undefined, res: Response) {
    if (userId) {
      const user = await userRepository.findByIdWithSecrets(userId);
      if (user) {
        user.refreshTokenHash = undefined;
        await user.save();
      }
    }
    clearAuthCookies(res);
    return { success: true };
  },

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await userRepository.findByIdWithSecrets(payload.sub);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedError('Session expired');
    }

    const matches = await compareToken(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedError('Session expired');
    }

    const tokens = createTokenPair(user._id.toString(), user.role, user.email);
    user.refreshTokenHash = await hashToken(tokens.refreshToken);
    await user.save();
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return { user: await presentAuthUser(user), tokens };
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmailWithSecrets(email);
    // Always succeed to avoid account enumeration.
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }
    const token = createRandomToken();
    user.passwordResetToken = hashSha256(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const emailResult = await emailService.sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      token,
    });
    logger.info('Password reset email attempt finished', {
      email: user.email,
      sent: emailResult.sent,
      skipped: emailResult.skipped,
      reason: emailResult.reason,
      messageId: emailResult.messageId,
    });

    return {
      message: 'If that email exists, a reset link has been sent.',
      resetToken: env.NODE_ENV === 'production' ? undefined : token,
    };
  },

  async resetPassword(input: ResetPasswordInput) {
    const user = await userRepository.findByPasswordResetToken(hashSha256(input.token));
    if (!user) {
      throw new ValidationError('Invalid or expired reset token');
    }
    user.password = await hashPassword(input.password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = undefined;
    await user.save();
    return { message: 'Password updated successfully' };
  },

  async verifyEmail(token: string, res: Response) {
    const user = await userRepository.findByEmailVerificationToken(hashSha256(token));
    if (!user) {
      throw new ValidationError(
        'This verification link is invalid or has expired.',
        undefined,
        AuthErrorCode.VERIFICATION_TOKEN_INVALID,
      );
    }

    const tokenState = evaluateVerificationToken({
      emailVerified: user.emailVerified,
      expiresAt: user.emailVerificationExpires,
    });
    if (tokenState === 'already_verified') {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      throw new ConflictError('Your email is already verified.', AuthErrorCode.EMAIL_ALREADY_VERIFIED);
    }
    if (tokenState === 'expired') {
      throw new ValidationError(
        'This verification link has expired.',
        undefined,
        AuthErrorCode.VERIFICATION_TOKEN_EXPIRED,
      );
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    const tokens = createTokenPair(user._id.toString(), user.role, user.email);
    user.refreshTokenHash = await hashToken(tokens.refreshToken);
    user.lastLogin = new Date();
    await user.save();
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    if (user.role === 'customer' || user.role === 'mechanic') {
      void emailService
        .sendWelcomeEmail({
          email: user.email,
          firstName: user.firstName,
          role: user.role,
        })
        .catch((error: unknown) => {
          logger.error('Welcome email failed', {
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    return { message: 'Email verified successfully', user: await presentAuthUser(user), tokens };
  },

  async resendVerification(email: string) {
    const user = await userRepository.findByEmailWithSecrets(email);
    if (!user) {
      return { message: 'If that email exists, a verification link has been sent.' };
    }
    if (user.emailVerified) {
      throw new ConflictError('Your email is already verified.', AuthErrorCode.EMAIL_ALREADY_VERIFIED);
    }
    if (isLegacyAccount(user)) {
      user.emailVerified = true;
      user.emailVerifiedAt = user.lastLogin ?? new Date();
      await user.save();
      throw new ConflictError('Your email is already verified.', AuthErrorCode.EMAIL_ALREADY_VERIFIED);
    }

    const verification = createEmailVerification();
    user.emailVerificationToken = verification.tokenHash;
    user.emailVerificationExpires = verification.expiresAt;
    await user.save();

    const emailed = await emailService.sendVerificationEmail({
      email: user.email,
      firstName: user.firstName,
      token: verification.token,
    });
    if (!emailed.sent) {
      logger.error('Resend verification email was not sent', {
        email: user.email,
        reason: emailed.reason,
      });
      if (emailed.skipped && env.NODE_ENV !== 'production') {
        return {
          message: 'If that email exists, a verification link has been sent.',
          emailVerificationToken: verification.token,
        };
      }
      throw new ApiError(
        503,
        'We could not send the verification email. Please try again shortly.',
      );
    }

    return {
      message: 'If that email exists, a verification link has been sent.',
      emailVerificationToken: env.NODE_ENV === 'production' ? undefined : verification.token,
    };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const profile =
      user.role === 'customer'
        ? await customerRepository.findByUserId(userId)
        : user.role === 'mechanic'
          ? await mechanicRepository.findByUserId(userId)
          : null;

    return { user: await presentAuthUser(user), profile };
  },
};

async function ensureUniqueIdentity(email: string, phone: string): Promise<void> {
  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) {
    throw new ConflictError('An account with this email already exists');
  }
  const existingPhone = await userRepository.findByPhone(phone);
  if (existingPhone) {
    throw new ConflictError('An account with this phone number already exists');
  }
}

function registrationPendingResponse(email: string, token: string) {
  return {
    requiresEmailVerification: true,
    email,
    emailVerificationToken: env.NODE_ENV === 'production' ? undefined : token,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}

function isDuplicateGhanaCardError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000 &&
    'keyPattern' in error &&
    typeof (error as { keyPattern?: Record<string, unknown> }).keyPattern === 'object' &&
    Boolean((error as { keyPattern?: Record<string, unknown> }).keyPattern?.ghanaCardNumber)
  );
}

async function resolveGhanaCardConflict(ghanaCardNumber: string, email: string): Promise<void> {
  const existing = await mechanicRepository.findByGhanaCardNumber(ghanaCardNumber);
  if (!existing) return;
  await handleGhanaCardConflict(ghanaCardNumber, email, existing);
}

async function handleGhanaCardConflict(
  ghanaCardNumber: string,
  email: string,
  existing?: IMechanic | null,
): Promise<void> {
  const mechanic = existing ?? (await mechanicRepository.findByGhanaCardNumber(ghanaCardNumber));
  if (!mechanic) return;

  const linkedUser = await userRepository.findById(mechanic.userId.toString());
  if (!linkedUser) {
    await mechanicRepository.deleteById(mechanic._id.toString());
    logger.warn('Removed orphan mechanic record blocking registration', {
      mechanicId: mechanic._id.toString(),
      ghanaCardPrefix: ghanaCardNumber.slice(0, 7),
    });
    return;
  }

  if (linkedUser.email.toLowerCase() === email.toLowerCase()) {
    throw new ConflictError('An account with this email already exists. Please sign in instead.');
  }

  throw new ConflictError(
    `This Ghana Card is already linked to another account (${maskEmail(linkedUser.email)}). Sign in with that email or contact support.`,
  );
}
