import { env } from '../config/env.js';
import { getPaymentProvider, getPlatformFeePercent } from '../payments/payment-provider.impl.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { notificationRepository, paymentRepository } from '../repositories/misc.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { emitToRequest } from '../sockets/index.js';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { assertObjectId, refId } from '../utils/objectId.js';
import type { SettlementStatus } from '../types/index.js';

const provider = getPaymentProvider();

async function assertCustomerOwnsRequest(userId: string, requestId: string) {
  const [customer, request] = await Promise.all([
    customerRepository.findByUserId(userId),
    requestRepository.findById(assertObjectId(requestId, 'request id')),
  ]);
  if (!customer || !request) throw new NotFoundError('Rescue request not found');
  if (refId(request.customer) !== customer._id.toString()) {
    throw new ForbiddenError('You do not own this rescue request');
  }
  return { customer, request };
}

function buildPaymentAmounts(grossAmountGhs: number, providerSubaccountCode?: string) {
  const split = provider.calculateSplit({
    grossAmountGhs,
    providerSubaccountCode,
    platformFeePercent: getPlatformFeePercent(),
  });
  return split;
}

async function markPaid(input: {
  reference: string;
  amountPesewas: number;
  currency: string;
  channel?: string;
  paidAt?: string;
}) {
  const payment = await paymentRepository.findByReference(input.reference);
  if (!payment) throw new NotFoundError('Payment reference not found');
  if (payment.status === 'paid') return payment;

  const expectedPesewas = Math.round((payment.grossAmount ?? payment.amount) * 100);
  if (input.currency !== 'GHS' || input.amountPesewas !== expectedPesewas) {
    throw new ValidationError('Payment amount or currency does not match');
  }

  const request = await requestRepository.findById(payment.request.toString());
  if (!request) throw new NotFoundError('Rescue request not found');

  const settlementStatus = provider.resolveSettlementStatus({
    paymentSucceeded: true,
    providerSubaccountCode: payment.providerSubaccountCode,
  });

  payment.status = 'paid';
  payment.paymentMethod = 'paystack';
  payment.channel = input.channel;
  payment.paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  payment.settlementStatus = settlementStatus;
  if (settlementStatus === 'settled') {
    payment.settledAt = payment.paidAt;
  }
  await payment.save();

  request.paymentStatus = 'paid';
  await request.save();

  const customer = await customerRepository.findById(refId(request.customer));
  if (customer) {
    await notificationRepository.create({
      title: 'Payment received',
      body: `Payment of ₵${payment.grossAmount ?? payment.amount} was successful.`,
      recipient: customer.userId,
      type: 'success',
    });
  }

  if (payment.mechanic) {
    const mechanic = await mechanicRepository.findById(payment.mechanic.toString());
    const mechanicUser = mechanic ? await userRepository.findById(mechanic.userId.toString()) : null;
    if (mechanicUser) {
      await notificationRepository.create({
        title: 'Service payment recorded',
        body: `A payment of ₵${payment.providerAmount} was recorded for your completed service.`,
        recipient: mechanicUser._id,
        type: 'info',
      });
    }
  }

  emitToRequest(request._id.toString(), 'payment:updated', {
    requestId: request._id.toString(),
    status: 'paid',
    reference: input.reference,
    settlementStatus: payment.settlementStatus,
  });
  return payment;
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
    createdAt: payment.createdAt,
  };
}

export const paymentService = {
  async initialize(userId: string, requestId: string) {
    if (!provider.isConfigured()) {
      throw new ApiError(503, 'Online payments are not configured yet');
    }
    const { customer, request } = await assertCustomerOwnsRequest(userId, requestId);
    if (request.status !== 'completed') {
      throw new ValidationError('Payment is available after the service is completed');
    }
    if (request.paymentStatus === 'paid') {
      throw new ConflictError('This request is already paid');
    }

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Customer account not found');

    let mechanicSubaccount: string | undefined;
    if (request.mechanic) {
      const mechanic = await mechanicRepository.findById(refId(request.mechanic));
      if (mechanic?.payoutAccountConfigured && mechanic.paystackSubaccountCode) {
        mechanicSubaccount = mechanic.paystackSubaccountCode;
      }
    }

    const amounts = buildPaymentAmounts(request.quotedPrice, mechanicSubaccount);
    let payment = await paymentRepository.findByRequest(requestId);
    if (!payment) {
      payment = await paymentRepository.create({
        customer: customer._id,
        mechanic: request.mechanic ? refId(request.mechanic) : undefined,
        request: request._id,
        grossAmount: amounts.grossAmount,
        amount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        providerAmount: amounts.providerAmount,
        currency: 'GHS',
        paymentProvider: 'paystack',
        paymentMethod: 'paystack',
        providerSubaccountCode: mechanicSubaccount,
        status: 'pending',
        settlementStatus: 'pending',
      });
    }

    const reference = `RR_${request._id}_${Date.now()}`;
    const initialized = await provider.initializePayment({
      email: user.email,
      amountGhs: amounts.grossAmount,
      reference,
      requestId,
      providerSubaccountCode: mechanicSubaccount,
      platformFeePercent: getPlatformFeePercent(),
    });

    payment.grossAmount = amounts.grossAmount;
    payment.amount = amounts.grossAmount;
    payment.platformFee = amounts.platformFee;
    payment.providerAmount = amounts.providerAmount;
    payment.paymentMethod = 'paystack';
    payment.providerSubaccountCode = mechanicSubaccount;
    payment.transactionReference = initialized.reference;
    payment.paystackAccessCode = initialized.accessCode;
    payment.status = 'pending';
    payment.settlementStatus = 'pending';
    await payment.save();

    return {
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      callbackUrl: env.PAYSTACK_CALLBACK_URL ?? `${env.PRIMARY_CLIENT_ORIGIN}/customer/history`,
    };
  },

  async verify(userId: string, reference: string) {
    const payment = await paymentRepository.findByReference(reference);
    if (!payment) throw new NotFoundError('Payment reference not found');
    await assertCustomerOwnsRequest(userId, payment.request.toString());
    if (payment.status === 'paid') return payment;

    const result = await provider.verifyPayment(reference);
    if (result.status !== 'success') {
      payment.status = 'failed';
      payment.settlementStatus = 'failed';
      await payment.save();
      throw new ValidationError('Payment has not completed successfully');
    }
    return markPaid({
      reference,
      amountPesewas: result.amountPesewas,
      currency: result.currency,
      channel: result.channel,
      paidAt: result.paid_at,
    });
  },

  async handleChargeSuccess(data: {
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
  }) {
    if (!data.reference || typeof data.amount !== 'number' || !data.currency) {
      throw new ValidationError('Invalid Paystack webhook payload');
    }
    return markPaid({
      reference: data.reference,
      amountPesewas: data.amount,
      currency: data.currency,
      channel: data.channel,
      paidAt: data.paid_at,
    });
  },

  async listForMechanic(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    const payments = await paymentRepository.findByMechanic(mechanic._id.toString());
    return payments.map(serializePayment);
  },

  async getMechanicPayoutInfo(userId: string) {
    const mechanic = await mechanicRepository.findByUserId(userId);
    if (!mechanic) throw new NotFoundError('Mechanic profile not found');
    return provider.getProviderPayoutStatus(mechanic.paystackSubaccountCode);
  },

  serializePayment,
};
