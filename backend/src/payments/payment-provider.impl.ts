import { env } from '../config/env.js';
import {
  createPaystackSubscription,
  initializePaystackPayment,
  initializePaystackSubscription,
  isPaystackConfigured,
  refundPaystackTransaction,
  verifyPaystackPayment,
  verifyPaystackSignature,
} from './paystack.js';
import type {
  CreateRecurringSubscriptionInput,
  InitializePaymentInput,
  InitializePaymentResult,
  InitializeSubscriptionInput,
  PaymentProvider,
  PaymentSplitInput,
  PaymentSplitResult,
  ProviderPayoutStatus,
  RecurringSubscriptionResult,
  VerifyPaymentResult,
} from './payment-provider.js';
import type { SettlementStatus } from '../types/index.js';

function roundGhs(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePaymentSplit(input: PaymentSplitInput): PaymentSplitResult {
  const grossAmount = roundGhs(input.grossAmountGhs);
  const platformFee = roundGhs((grossAmount * input.platformFeePercent) / 100);
  const providerAmount = roundGhs(Math.max(0, grossAmount - platformFee));
  return { grossAmount, platformFee, providerAmount };
}

const paystackProvider: PaymentProvider = {
  name: 'paystack',
  isConfigured: isPaystackConfigured,
  calculateSplit: calculatePaymentSplit,
  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    return initializePaystackPayment({
      email: input.email,
      amountGhs: input.amountGhs,
      reference: input.reference,
      requestId: input.requestId,
      callbackUrl: input.callbackUrl,
      metadata: input.metadata,
      providerSubaccountCode: input.providerSubaccountCode,
      platformFeePercent: input.platformFeePercent,
      channels: input.channels,
    });
  },
  async initializeSubscription(input: InitializeSubscriptionInput): Promise<InitializePaymentResult> {
    if (input.planCode) {
      return initializePaystackSubscription({
        email: input.email,
        amountGhs: input.amountGhs,
        reference: input.reference,
        planCode: input.planCode,
        callbackUrl: input.callbackUrl,
        metadata: input.metadata,
      });
    }
    return initializePaystackPayment({
      email: input.email,
      amountGhs: input.amountGhs,
      reference: input.reference,
      callbackUrl: input.callbackUrl,
      metadata: input.metadata,
      platformFeePercent: 0,
    });
  },
  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const result = await verifyPaystackPayment(reference);
    return {
      status: result.status,
      reference: result.reference,
      amountPesewas: result.amount,
      currency: result.currency,
      paid_at: result.paid_at,
      channel: result.channel,
      authorizationCode: result.authorization?.authorization_code,
      authorizationReusable: result.authorization?.reusable,
      authorizationChannel: result.authorization?.channel ?? result.channel,
      customerCode: result.customer?.customer_code,
      customerEmail: result.customer?.email,
    };
  },
  async refundTransaction(reference: string, merchantNote?: string): Promise<void> {
    await refundPaystackTransaction({ reference, merchantNote });
  },
  async createRecurringSubscription(
    input: CreateRecurringSubscriptionInput,
  ): Promise<RecurringSubscriptionResult> {
    const created = await createPaystackSubscription(input);
    return {
      subscriptionCode: created.subscription_code,
      emailToken: created.email_token,
      status: created.status,
    };
  },
  verifyWebhookSignature: verifyPaystackSignature,
  getProviderPayoutStatus(subaccountCode?: string): ProviderPayoutStatus {
    if (!isPaystackConfigured()) {
      return {
        configured: false,
        provider: 'paystack',
        message:
          'Online payments are not configured yet. Payout management will be available once Paystack is connected.',
      };
    }
    if (!subaccountCode) {
      return {
        configured: false,
        provider: 'paystack',
        message:
          'Your payments are settled through Paystack. Payout management will be available once your payment account is configured.',
      };
    }
    return {
      configured: true,
      provider: 'paystack',
      subaccountCode,
      managementUrl: 'https://dashboard.paystack.com/#/subaccounts',
      message:
        'Your payout destination is configured with Paystack. Road Rescue does not hold your funds.',
    };
  },
  resolveSettlementStatus(input: {
    paymentSucceeded: boolean;
    providerSubaccountCode?: string;
  }): SettlementStatus {
    if (!input.paymentSucceeded) return 'failed';
    if (input.providerSubaccountCode) return 'processing';
    return 'pending';
  },
};

export function getPaymentProvider(): PaymentProvider {
  return paystackProvider;
}

export function getPlatformFeePercent(): number {
  return env.PLATFORM_FEE_PERCENT;
}
