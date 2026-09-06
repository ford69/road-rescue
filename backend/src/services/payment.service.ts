import { getPaymentProvider } from '../payments/payment-provider.impl.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { paymentRepository } from '../repositories/misc.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { refId } from '../utils/objectId.js';
import type { SettlementStatus } from '../types/index.js';

const provider = getPaymentProvider();

export function isPaymentAvailable(_status: string): boolean {
  return false;
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
  async initialize(_userId: string, _requestId: string) {
    throw new ValidationError(
      'Road Rescue does not process payments for mechanic services. Pay your provider directly outside the app.',
    );
  },

  async verify(_userId: string, _reference: string) {
    throw new ValidationError(
      'Road Rescue does not process payments for mechanic services.',
    );
  },

  async handleChargeSuccess(_data: {
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
  }) {
    return null;
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
