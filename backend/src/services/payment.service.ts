import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getPaymentProvider } from '../payments/payment-provider.impl.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { paymentRepository } from '../repositories/misc.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { walletService } from './wallet.service.js';
import { isPriceConfirmed } from './provider-pricing.service.js';
import { commissionPesewas, ghsToPesewas, pesewasToGhs } from '../utils/money.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { refId } from '../utils/objectId.js';
import type { SettlementStatus } from '../types/index.js';

const provider = getPaymentProvider();

export const JOB_PAYMENT_PREFIX = 'RR_JOB_';

export function isJobPaymentReference(reference?: string): boolean {
  return typeof reference === 'string' && reference.startsWith(JOB_PAYMENT_PREFIX);
}

export function isPaymentAvailable(status: string): boolean {
  return status === 'completed';
}

function serializePayment(payment: {
  _id: { toString(): string };
  customer: unknown;
  mechanic?: unknown;
  request: unknown;
  grossAmount?: number;
  amount: number;
  platformFee?: number;
  providerAmount?: number;
  currency: 'GHS';
  paymentProvider?: string;
  paymentMethod: string;
  transactionReference?: string;
  channel?: string;
  paidAt?: Date;
  status: string;
  settlementStatus?: SettlementStatus;
  settledAt?: Date;
  entitlementPesewas?: number;
  entitlementCredited?: boolean;
  createdAt: Date;
}) {
  return {
    id: payment._id.toString(),
    customerId: refId(payment.customer),
    providerId: payment.mechanic ? refId(payment.mechanic) : undefined,
    serviceRequestId: refId(payment.request),
    paymentProvider: payment.paymentProvider ?? 'paystack',
    paymentReference: payment.transactionReference,
    grossAmount: payment.grossAmount ?? payment.amount,
    platformFee: payment.platformFee ?? 0,
    providerAmount: payment.providerAmount ?? payment.amount,
    currency: payment.currency,
    paymentStatus: payment.status,
    settlementStatus: payment.settlementStatus ?? 'pending',
    paymentMethod: payment.paymentMethod,
    channel: payment.channel,
    paidAt: payment.paidAt,
    settledAt: payment.settledAt,
    entitlementGhs: pesewasToGhs(payment.entitlementPesewas ?? 0),
    entitlementCredited: Boolean(payment.entitlementCredited),
    createdAt: payment.createdAt,
  };
}

function newJobReference(): string {
  return `${JOB_PAYMENT_PREFIX}${crypto.randomBytes(12).toString('hex')}`;
}

export const paymentService = {
  async initialize(userId: string, requestId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const user = await userRepository.findById(userId);
    if (!user?.email) throw new ValidationError('Your account needs an email to pay');
    const request = await requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Rescue request not found');
    if (refId(request.customer) !== customer._id.toString()) {
      throw new ForbiddenError('You do not own this request');
    }
    if (!isPaymentAvailable(request.status)) {
      throw new ValidationError('Pay after you confirm that the service is complete');
    }
    if (request.quotedPrice <= 0) {
      throw new ValidationError('This service does not have a confirmed amount to charge');
    }
    if (request.pricingSnapshot && !isPriceConfirmed(request.pricingConfirmationStatus)) {
      throw new ValidationError('The customer must accept the quoted price before paying');
    }
    if (!request.mechanic) {
      throw new ValidationError('This service has no assigned provider');
    }
    if (!provider.isConfigured()) {
      throw new ValidationError('Paystack is not configured for service payments');
    }

    const existing = await paymentRepository.findByRequest(request._id.toString());
    if (existing?.status === 'paid') {
      throw new ConflictError('This service has already been paid');
    }
    if (existing?.status === 'pending' && existing.paystackAccessCode && existing.transactionReference) {
      const paystack = await provider.verifyPayment(existing.transactionReference).catch(() => null);
      if (paystack?.status === 'success') {
        await this.fulfillJobPayment(existing.transactionReference);
        throw new ConflictError('This service has already been paid');
      }
    }

    const grossPesewas = ghsToPesewas(request.quotedPrice);
    const platformFeePesewas = commissionPesewas(grossPesewas, env.PROVIDER_COMMISSION_PERCENT);
    const providerPesewas = grossPesewas - platformFeePesewas;
    const reference = existing?.transactionReference?.startsWith(JOB_PAYMENT_PREFIX)
      ? existing.transactionReference
      : newJobReference();

    const initialized = await provider.initializePayment({
      email: user.email,
      amountGhs: pesewasToGhs(grossPesewas),
      reference,
      requestId: request._id.toString(),
      callbackUrl: `${env.PRIMARY_CLIENT_ORIGIN}/customer/tracking`,
      metadata: {
        kind: 'job_payment',
        requestId: request._id.toString(),
        mechanicId: refId(request.mechanic),
        customerId: customer._id.toString(),
      },
      platformFeePercent: 100,
    });

    const payload = {
      customer: customer._id,
      mechanic: request.mechanic,
      request: request._id,
      grossAmount: pesewasToGhs(grossPesewas),
      amount: pesewasToGhs(grossPesewas),
      platformFee: pesewasToGhs(platformFeePesewas),
      providerAmount: pesewasToGhs(providerPesewas),
      currency: 'GHS' as const,
      paymentProvider: 'paystack' as const,
      paymentMethod: 'paystack' as const,
      transactionReference: initialized.reference,
      paystackAccessCode: initialized.accessCode,
      status: 'pending' as const,
      settlementStatus: 'pending' as const,
      sourceType: 'job_payment' as const,
      entitlementPesewas: providerPesewas,
      entitlementCredited: false,
    };

    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
    } else {
      await paymentRepository.create(payload);
    }

    return {
      reference: initialized.reference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
      amountGhs: pesewasToGhs(grossPesewas),
      platformFeeGhs: pesewasToGhs(platformFeePesewas),
      providerAmountGhs: pesewasToGhs(providerPesewas),
    };
  },

  async verify(userId: string, reference: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const payment = await paymentRepository.findByReference(reference);
    if (!payment) throw new NotFoundError('Payment not found');
    if (refId(payment.customer) !== customer._id.toString()) {
      throw new ForbiddenError('You cannot verify another customer’s payment');
    }
    const fulfilled = await this.fulfillJobPayment(reference);
    return fulfilled ? serializePayment(fulfilled) : serializePayment(payment);
  },

  async fulfillJobPayment(reference: string) {
    const payment = await paymentRepository.findByReference(reference);
    if (!payment) return null;
    if (payment.status === 'paid' && payment.entitlementCredited) return payment;

    const verified = await provider.verifyPayment(payment.transactionReference ?? reference);
    const expectedPesewas = ghsToPesewas(payment.grossAmount ?? payment.amount);

    if (verified.currency && verified.currency.toUpperCase() !== 'GHS') {
      payment.status = 'failed';
      payment.settlementStatus = 'failed';
      payment.settlementFailureReason = 'Currency mismatch';
      await payment.save();
      throw new ValidationError('Payment currency must be GHS');
    }
    if (verified.amountPesewas !== expectedPesewas) {
      payment.status = 'failed';
      payment.settlementStatus = 'failed';
      payment.settlementFailureReason = 'Amount mismatch';
      await payment.save();
      throw new ValidationError('Payment amount does not match the Paystack charge');
    }
    if (verified.status !== 'success') {
      payment.status = verified.status === 'abandoned' ? 'cancelled' : 'failed';
      await payment.save();
      return payment;
    }

    payment.status = 'paid';
    payment.channel = verified.channel;
    payment.paidAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
    payment.settlementStatus = 'pending';
    await payment.save();

    const request = await requestRepository.findById(refId(payment.request));
    if (request) {
      request.paymentStatus = 'paid';
      await request.save();
      await walletService.reversePrepaidCommissionForJobPayment(request);
    }

    if (payment.mechanic && payment.entitlementPesewas > 0 && !payment.entitlementCredited) {
      await walletService.creditPendingEarning({
        mechanicId: refId(payment.mechanic),
        amountPesewas: payment.entitlementPesewas,
        paymentId: payment._id.toString(),
        requestId: refId(payment.request),
        paystackReference: payment.transactionReference,
      });
      payment.entitlementCredited = true;
      await payment.save();
    }

    return payment;
  },

  async handleChargeSuccess(data: {
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
  }) {
    if (!isJobPaymentReference(data.reference)) return null;
    return this.fulfillJobPayment(data.reference as string);
  },

  async getForRequest(userId: string, requestId: string) {
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError('Customer profile not found');
    const request = await requestRepository.findById(requestId);
    if (!request) throw new NotFoundError('Rescue request not found');
    if (refId(request.customer) !== customer._id.toString()) {
      throw new ForbiddenError('You do not own this request');
    }
    const payment = await paymentRepository.findByRequest(requestId);
    return payment ? serializePayment(payment) : null;
  },

  async listForMechanic(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Provider profile not found');
    const payments = await paymentRepository.findByMechanic(mechanic._id.toString());
    return payments.map(serializePayment);
  },

  async getMechanicPayoutInfo(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Provider profile not found');
    return {
      configured: true,
      provider: 'paystack' as const,
      message:
        'Road Rescue pays providers from its corporate account after Paystack settlement is confirmed. Add a verified bank or mobile money destination in Wallet.',
    };
  },

  serializePayment,
};
