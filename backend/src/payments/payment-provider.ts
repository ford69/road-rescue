import type { SettlementStatus } from '../types/index.js';

export interface PaymentSplitInput {
  grossAmountGhs: number;
  providerSubaccountCode?: string;
  platformFeePercent: number;
}

export interface PaymentSplitResult {
  grossAmount: number;
  platformFee: number;
  providerAmount: number;
}

export interface InitializePaymentInput {
  email: string;
  amountGhs: number;
  reference: string;
  requestId?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
  providerSubaccountCode?: string;
  platformFeePercent: number;
  channels?: Array<'card' | 'mobile_money'>;
}

export interface InitializeSubscriptionInput {
  email: string;
  amountGhs: number;
  reference: string;
  callbackUrl: string;
  planCode?: string;
  metadata: Record<string, string>;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyPaymentResult {
  status: string;
  reference: string;
  amountPesewas: number;
  currency: string;
  paid_at?: string;
  channel?: string;
  authorizationCode?: string;
  authorizationReusable?: boolean;
  authorizationChannel?: string;
  customerCode?: string;
  customerEmail?: string;
}

export interface CreateRecurringSubscriptionInput {
  customer: string;
  planCode: string;
  authorizationCode: string;
  startDate: Date;
}

export interface RecurringSubscriptionResult {
  subscriptionCode: string;
  emailToken?: string;
  status?: string;
}

export interface ProviderPayoutStatus {
  configured: boolean;
  provider: 'paystack';
  subaccountCode?: string;
  managementUrl?: string;
  message: string;
}

export interface PaymentProvider {
  readonly name: 'paystack';
  isConfigured(): boolean;
  calculateSplit(input: PaymentSplitInput): PaymentSplitResult;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  initializeSubscription(input: InitializeSubscriptionInput): Promise<InitializePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  refundTransaction(reference: string, merchantNote?: string): Promise<void>;
  createRecurringSubscription(
    input: CreateRecurringSubscriptionInput,
  ): Promise<RecurringSubscriptionResult>;
  verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean;
  getProviderPayoutStatus(subaccountCode?: string): ProviderPayoutStatus;
  resolveSettlementStatus(input: {
    paymentSucceeded: boolean;
    providerSubaccountCode?: string;
  }): SettlementStatus;
}
