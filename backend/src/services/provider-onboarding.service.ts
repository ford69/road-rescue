import type { Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { createEmailVerification } from '../auth/email-verification.js';
import { hashPassword } from '../auth/tokens.js';
import { clearAuthCookies } from '../auth/cookies.js';
import { getPaymentProvider } from '../payments/payment-provider.impl.js';
import { getPublicUploadPath } from '../uploads/storage.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { providerRegistrationIntentRepository } from '../repositories/provider-registration-intent.repository.js';
import { emailService } from '../email/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { ProviderRegistrationIntent } from '../models/ProviderRegistrationIntent.js';
import type { registerMechanicSchema } from '../validators/auth.validators.js';
import type { z } from 'zod';
import type { IMechanic } from '../models/Mechanic.js';

type RegisterMechanicInput = z.infer<typeof registerMechanicSchema>;

export const ONBOARDING_REFERENCE_PREFIX = 'RR_PONB_';

function paystack() {
  return getPaymentProvider();
}

function registrationPendingResponse(email: string, token: string) {
  return {
    requiresEmailVerification: true,
    email,
    emailVerificationToken: env.NODE_ENV === 'production' ? undefined : token,
  };
}

export function isProviderOnboardingReference(reference?: string): reference is string {
  return Boolean(reference && reference.startsWith(ONBOARDING_REFERENCE_PREFIX));
}

async function createProviderAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  garageName: string;
  ghanaCardNumber: string;
  experience: number;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  specialties: RegisterMechanicInput['specialties'];
  truck?: string;
  selfiePath: string;
}) {
  await ensureUniqueIdentity(input.email, input.phone);
  await resolveGhanaCardConflict(input.ghanaCardNumber, input.email);

  const verification = createEmailVerification();
  const user = await userRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    password: input.passwordHash,
    role: 'mechanic',
    avatar: input.selfiePath,
    status: 'pending',
    emailVerified: false,
    emailVerifiedAt: null,
    emailVerificationToken: verification.tokenHash,
    emailVerificationExpires: verification.expiresAt,
  });

  let mechanic: IMechanic;
  try {
    mechanic = await mechanicRepository.create({
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
      documents: [input.selfiePath],
    });
  } catch (error) {
    await userRepository.deleteById(user._id.toString());
    throw error;
  }

  await notificationRepository.create({
    title: 'Provider application received',
    body: 'Verify your email. Going online still requires KYC approval.',
    recipient: user._id,
    type: 'info',
  });

  void Promise.all([
    emailService.sendVerificationEmail({
      email: user.email,
      firstName: user.firstName,
      token: verification.token,
      audience: 'mechanic',
    }),
    emailService.sendMechanicApplicationReceivedEmail({
      email: user.email,
      firstName: user.firstName,
      garageName: input.garageName,
    }),
  ]).catch((error: unknown) => {
    logger.error('Provider onboarding email flow failed', {
      email: user.email,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { user, mechanic, verification };
}

export const providerOnboardingService = {
  async start(input: RegisterMechanicInput, selfie: Express.Multer.File | undefined, res: Response) {
    if (!selfie) {
      throw new ValidationError('A clear selfie photo is required');
    }

    await ensureUniqueIdentity(input.email, input.phone);
    await resolveGhanaCardConflict(input.ghanaCardNumber, input.email);

    const passwordHash = await hashPassword(input.password);
    const selfiePath = getPublicUploadPath(selfie.filename);
    const created = await createProviderAccount({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      garageName: input.garageName,
      ghanaCardNumber: input.ghanaCardNumber,
      experience: input.experience,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      specialties: input.specialties,
      truck: input.truck,
      selfiePath,
    });

    clearAuthCookies(res);
    logger.info('Provider account created', {
      event: 'provider.onboarding.completed',
      userId: created.user._id.toString(),
    });
    return registrationPendingResponse(created.user.email, created.verification.token);
  },

  /** Completes leftover Paystack card-auth registrations started before subscriptions were removed. */
  async complete(reference: string, res?: Response) {
    const existing = await providerRegistrationIntentRepository.findByReference(reference);
    if (!existing) throw new NotFoundError('Provider registration checkout not found');
    if (existing.status === 'completed') {
      if (res) clearAuthCookies(res);
      return registrationPendingResponse(existing.email, '');
    }

    const intent = await ProviderRegistrationIntent.findOneAndUpdate(
      { paystackReference: reference, status: 'pending_payment' },
      { $set: { status: 'completing' } },
      { new: true },
    );
    if (!intent) {
      const latest = await providerRegistrationIntentRepository.findByReference(reference);
      if (latest?.status === 'completed') {
        if (res) clearAuthCookies(res);
        return registrationPendingResponse(latest.email, '');
      }
      throw new ValidationError('This card checkout is still being processed. Try again in a moment.');
    }

    if (intent.expiresAt.getTime() < Date.now()) {
      intent.status = 'failed';
      await intent.save();
      throw new ValidationError('This card checkout expired. Start registration again.');
    }

    const verified = await paystack().verifyPayment(reference);
    if (verified.status !== 'success') {
      intent.status = 'failed';
      await intent.save();
      throw new ValidationError('Card authentication has not completed successfully');
    }

    let refunded = intent.tokenizationRefunded;
    if (!refunded) {
      try {
        await paystack().refundTransaction(
          reference,
          'Unused provider registration card verification refund',
        );
        refunded = true;
      } catch (error) {
        logger.warn('Onboarding tokenization refund failed', {
          event: 'provider.onboarding.refund.failed',
          reference,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const created = await createProviderAccount({
      firstName: intent.firstName,
      lastName: intent.lastName,
      email: intent.email,
      phone: intent.phone,
      passwordHash: intent.passwordHash,
      garageName: intent.garageName,
      ghanaCardNumber: intent.ghanaCardNumber,
      experience: intent.experience,
      city: intent.city,
      address: intent.address,
      latitude: intent.latitude,
      longitude: intent.longitude,
      specialties: intent.specialties as RegisterMechanicInput['specialties'],
      truck: intent.truck,
      selfiePath: intent.selfiePath,
    });

    intent.status = 'completed';
    intent.userId = created.user._id;
    intent.mechanicId = created.mechanic._id;
    intent.tokenizationRefunded = refunded;
    await intent.save();

    if (res) clearAuthCookies(res);
    logger.info('Provider account created after leftover card checkout', {
      event: 'provider.onboarding.completed',
      userId: created.user._id.toString(),
      reference,
    });
    return registrationPendingResponse(created.user.email, created.verification.token);
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

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}

async function resolveGhanaCardConflict(ghanaCardNumber: string, email: string): Promise<void> {
  const existing = await mechanicRepository.findByGhanaCardNumber(ghanaCardNumber);
  if (!existing) return;
  const linkedUser = await userRepository.findById(existing.userId.toString());
  if (!linkedUser) {
    await mechanicRepository.deleteById(existing._id.toString());
    return;
  }
  if (linkedUser.email.toLowerCase() === email.toLowerCase()) {
    throw new ConflictError('An account with this email already exists. Please sign in instead.');
  }
  throw new ConflictError(
    `This Ghana Card is already linked to another account (${maskEmail(linkedUser.email)}). Sign in with that email or contact support.`,
  );
}
