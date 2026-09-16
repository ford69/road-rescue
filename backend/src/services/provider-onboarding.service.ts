import crypto from 'node:crypto';
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
import { ProviderRegistrationIntent } from '../models/ProviderRegistrationIntent.js';
import type { registerMechanicSchema } from '../validators/auth.validators.js';
import type { z } from 'zod';
import { isProviderPlanSlug } from './provider-plans.js';
import {
  startAuthorizedTrial,
  tokenizationAmountGhs,
} from './provider-subscription.service.js';
import type { IMechanic } from '../models/Mechanic.js';

type RegisterMechanicInput = z.infer<typeof registerMechanicSchema>;

export const ONBOARDING_REFERENCE_PREFIX = 'RR_PONB_';

function paystack() {
  return getPaymentProvider();
}

function onboardingCallbackUrl(): string {
  return `${env.PRIMARY_CLIENT_ORIGIN}/auth/register?role=provider`;
}

function registrationPendingResponse(email: string, token: string) {
  return {
    requiresEmailVerification: true,
    email,
    emailVerificationToken: env.NODE_ENV === 'production' ? undefined : token,
  };
}

export function isProviderOnboardingReference(reference?: string): boolean {
  return Boolean(reference && reference.startsWith(ONBOARDING_REFERENCE_PREFIX));
}

export const providerOnboardingService = {
  async start(input: RegisterMechanicInput, selfie: Express.Multer.File | undefined, res: Response) {
    if (!selfie) {
      throw new ValidationError('A clear selfie photo is required');
    }
    if (!isProviderPlanSlug(input.planSlug)) {
      throw new ValidationError('Select a provider subscription plan.');
    }
    if (!paystack().isConfigured()) {
      throw new ValidationError('Paystack is not configured for provider registration yet.');
    }

    await ensureUniqueIdentity(input.email, input.phone);
    await resolveGhanaCardConflict(input.ghanaCardNumber, input.email);

    const existingOpen = await providerRegistrationIntentRepository.findOpenByEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const selfiePath = getPublicUploadPath(selfie.filename);
    const reference = `${ONBOARDING_REFERENCE_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
    const amountGhs = tokenizationAmountGhs();

    const initialized = await paystack().initializePayment({
      email: input.email.toLowerCase(),
      amountGhs,
      reference,
      callbackUrl: onboardingCallbackUrl(),
      metadata: {
        purpose: 'provider_onboarding',
        planSlug: input.planSlug,
      },
      platformFeePercent: 0,
      channels: ['card'],
    });

    if (existingOpen) {
      existingOpen.firstName = input.firstName;
      existingOpen.lastName = input.lastName;
      existingOpen.phone = input.phone;
      existingOpen.passwordHash = passwordHash;
      existingOpen.garageName = input.garageName;
      existingOpen.ghanaCardNumber = input.ghanaCardNumber;
      existingOpen.experience = input.experience;
      existingOpen.city = input.city;
      existingOpen.address = input.address;
      existingOpen.latitude = input.latitude;
      existingOpen.longitude = input.longitude;
      existingOpen.specialties = input.specialties;
      existingOpen.truck = input.truck;
      existingOpen.selfiePath = selfiePath;
      existingOpen.planSlug = input.planSlug;
      existingOpen.status = 'pending_payment';
      existingOpen.paystackReference = initialized.reference;
      existingOpen.authorizationUrl = initialized.authorizationUrl;
      existingOpen.accessCode = initialized.accessCode;
      existingOpen.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await existingOpen.save();
    } else {
      await providerRegistrationIntentRepository.create({
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
        planSlug: input.planSlug,
        status: 'pending_payment',
        paystackReference: initialized.reference,
        authorizationUrl: initialized.authorizationUrl,
        accessCode: initialized.accessCode,
        tokenizationRefunded: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    clearAuthCookies(res);
    logger.info('Provider onboarding Paystack checkout started', {
      event: 'provider.onboarding.checkout.started',
      email: input.email.toLowerCase(),
      planSlug: input.planSlug,
      reference: initialized.reference,
    });

    return {
      requiresAccount: false,
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      accessCode: initialized.accessCode,
      publicKey: env.PAYSTACK_PUBLIC_KEY,
      callbackUrl: onboardingCallbackUrl(),
      planSlug: input.planSlug,
    };
  },

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
    const channel = (verified.authorizationChannel ?? verified.channel ?? '').toLowerCase();
    if (channel && channel !== 'card') {
      intent.status = 'failed';
      await intent.save();
      throw new ValidationError('Use a debit or credit card so we can store it for later billing.');
    }
    if (!verified.authorizationCode || verified.authorizationReusable === false) {
      intent.status = 'failed';
      await intent.save();
      throw new ValidationError('Paystack did not return a reusable card authorization.');
    }
    if (!verified.customerCode) {
      intent.status = 'failed';
      await intent.save();
      throw new ValidationError('Paystack did not return a customer code.');
    }

    let refunded = intent.tokenizationRefunded;
    if (!refunded) {
      try {
        await paystack().refundTransaction(
          reference,
          'Card verification / tokenization refund — no subscription payment yet',
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

    await ensureUniqueIdentity(intent.email, intent.phone);
    await resolveGhanaCardConflict(intent.ghanaCardNumber, intent.email);

    const verification = createEmailVerification();
    const user = await userRepository.create({
      firstName: intent.firstName,
      lastName: intent.lastName,
      email: intent.email,
      phone: intent.phone,
      password: intent.passwordHash,
      role: 'mechanic',
      avatar: intent.selfiePath,
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
        garageName: intent.garageName,
        ghanaCardNumber: intent.ghanaCardNumber,
        experience: intent.experience,
        location: { city: intent.city, address: intent.address },
        latitude: intent.latitude,
        longitude: intent.longitude,
        specialties: intent.specialties,
        availability: false,
        verificationStatus: 'pending',
        truck: intent.truck,
        documents: [intent.selfiePath],
      });
    } catch (error) {
      await userRepository.deleteById(user._id.toString());
      intent.status = 'failed';
      await intent.save();
      throw error;
    }

    await startAuthorizedTrial({
      mechanicId: mechanic._id.toString(),
      userId: user._id.toString(),
      planSlug: intent.planSlug,
      authorizationCode: verified.authorizationCode,
      customerCode: verified.customerCode,
      tokenizationReference: reference,
      refunded,
    });

    intent.status = 'completed';
    intent.userId = user._id;
    intent.mechanicId = mechanic._id;
    intent.authorizationCode = verified.authorizationCode;
    intent.paystackCustomerCode = verified.customerCode;
    intent.tokenizationRefunded = refunded;
    await intent.save();

    await notificationRepository.create({
      title: 'Provider application received',
      body: 'Verify your email. Going online still requires KYC approval. Your plan will be billed after the 30-day trial.',
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
        garageName: intent.garageName,
      }),
    ]).catch((error: unknown) => {
      logger.error('Provider onboarding email flow failed', {
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    if (res) clearAuthCookies(res);
    logger.info('Provider account created after card authorization', {
      event: 'provider.onboarding.completed',
      userId: user._id.toString(),
      planSlug: intent.planSlug,
      reference,
    });
    return registrationPendingResponse(user.email, verification.token);
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
