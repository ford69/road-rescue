import { env } from '../config/env.js';
import {
  initializePaystackPayment,
  isPaystackConfigured,
  verifyPaystackPayment,
} from '../payments/paystack.js';
import { customerRepository } from '../repositories/customer.repository.js';
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
  if (input.currency !== 'GHS' || input.amountPesewas !== Math.round(payment.amount * 100)) {
    throw new ValidationError('Payment amount or currency does not match');
  }

  const request = await requestRepository.findById(payment.request.toString());
  if (!request) throw new NotFoundError('Rescue request not found');

  payment.status = 'paid';
  payment.paymentMethod = 'paystack';
  payment.channel = input.channel;
  payment.paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  await payment.save();

  request.paymentStatus = 'paid';
  await request.save();

  const customer = await customerRepository.findById(refId(request.customer));
  if (customer) {
    await notificationRepository.create({
      title: 'Payment received',
      body: `Payment of ₵${payment.amount} was successful.`,
      recipient: customer.userId,
      type: 'success',
    });
  }
  emitToRequest(request._id.toString(), 'payment:updated', {
    requestId: request._id.toString(),
    status: 'paid',
    reference: input.reference,
  });
  return payment;
}

export const paymentService = {
  async initialize(userId: string, requestId: string) {
    if (!isPaystackConfigured()) {
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
    let payment = await paymentRepository.findByRequest(requestId);
    if (!payment) {
      payment = await paymentRepository.create({
        customer: customer._id,
        mechanic: request.mechanic ? refId(request.mechanic) : undefined,
        request: request._id,
        amount: request.quotedPrice,
        currency: 'GHS',
        paymentMethod: 'paystack',
        status: 'pending',
      });
    }

    const reference = `RR_${request._id}_${Date.now()}`;
    const initialized = await initializePaystackPayment({
      email: user.email,
      amountGhs: request.quotedPrice,
      reference,
      requestId,
    });
    payment.amount = request.quotedPrice;
    payment.paymentMethod = 'paystack';
    payment.transactionReference = initialized.reference;
    payment.paystackAccessCode = initialized.accessCode;
    payment.status = 'pending';
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

    const result = await verifyPaystackPayment(reference);
    if (result.status !== 'success') {
      payment.status = 'failed';
      await payment.save();
      throw new ValidationError('Payment has not completed successfully');
    }
    return markPaid({
      reference,
      amountPesewas: result.amount,
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
};
