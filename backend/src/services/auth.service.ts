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
import { clearAuthCookies, setAuthCookies } from '../auth/cookies.js';
import { createEmailVerification, evaluateVerificationToken, isLegacyAccount } from '../auth/email-verification.js';
import { customerRepository } from '../repositories/customer.repository.js';
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
import { emailService } from '../email/index.js';
import { subscriptionService } from './subscription.service.js';
import { entitlementService } from './entitlement.service.js';
import { isPaidCustomerPlan } from './plan-access.js';
import { providerOnboardingService } from './provider-onboarding.service.js';

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
  if (user.role === 'admin') {
    return { ...base, hasActiveSubscription: true as const };
  }
  if (user.role === 'mechanic') {
    const hasActiveSubscription = await providerSubscriptionService.hasAccess(user._id.toString());
    return { ...base, hasActiveSubscription };
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
    await subscriptionService.ensureBasicPlanForCustomer(user._id.toString());
    await notificationRepository.create({
      title: 'Welcome to Road Rescue Ghana',
      body: 'Verify your email to start requesting roadside help. You are on the Basic plan at no charge.',
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
    logger.info('auth.registration.success', {
      event: 'auth.registration.success',
      userId: user._id.toString(),
      role: 'customer',
    });
    return {
      ...registrationPendingResponse(user.email, verification.token),
      requiresSubscription: false,
      user: await presentAuthUser(user),
      tokens,
    };
  },

  async registerMechanic(
    input: RegisterMechanicInput,
    selfie: Express.Multer.File | undefined,
    res: Response,
  ) {
    return providerOnboardingService.start(input, selfie, res);
  },

  async completeMechanicRegistration(reference: string, res: Response) {
    return providerOnboardingService.complete(reference, res);
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
    logger.info('auth.login.success', {
      event: 'auth.login.success',
      userId: user._id.toString(),
      role: user.role,
    });
    return { user: await presentAuthUser(user), tokens };
  },

  async logout(userId: string | undefined, res: Response, requestId?: string) {
    logger.info('auth.logout.started', { event: 'auth.logout.started', requestId, userId });
    if (userId) {
      const user = await userRepository.findByIdWithSecrets(userId);
      if (user) {
        user.refreshTokenHash = undefined;
        await user.save();
        logger.info('auth.session.revoked', {
          event: 'auth.session.revoked',
          requestId,
          userId,
          reason: 'logout',
        });
      }
    }
    clearAuthCookies(res);
    logger.info('auth.logout.success', { event: 'auth.logout.success', requestId, userId });
    return { success: true };
  },

  async refresh(refreshToken: string | undefined, res: Response, requestId?: string) {
    logger.info('auth.refresh.started', { event: 'auth.refresh.started', requestId });
    if (!refreshToken) {
      logger.info('auth.refresh.failed', {
        event: 'auth.refresh.failed',
        requestId,
        reason: 'missing_token',
      });
      throw new UnauthorizedError('Refresh token required');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      logger.info('auth.refresh.failed', {
        event: 'auth.refresh.failed',
        requestId,
        reason: 'invalid_token',
      });
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await userRepository.findByIdWithSecrets(payload.sub);
    if (!user?.refreshTokenHash) {
      logger.info('auth.refresh.failed', {
        event: 'auth.refresh.failed',
        requestId,
        userId: payload.sub,
        reason: 'session_expired',
      });
      throw new UnauthorizedError('Session expired');
    }

    const matches = await compareToken(refreshToken, user.refreshTokenHash);
    if (!matches) {
      logger.info('auth.refresh.failed', {
        event: 'auth.refresh.failed',
        requestId,
        userId: payload.sub,
        reason: 'token_mismatch',
      });
      throw new UnauthorizedError('Session expired');
    }

    const tokens = createTokenPair(user._id.toString(), user.role, user.email);
    user.refreshTokenHash = await hashToken(tokens.refreshToken);
    await user.save();
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    logger.info('auth.refresh.success', {
      event: 'auth.refresh.success',
      requestId,
      userId: user._id.toString(),
    });

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
      audience: user.role === 'mechanic' ? 'mechanic' : 'customer',
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
