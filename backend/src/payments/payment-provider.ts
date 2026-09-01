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
  requestId: string;
  providerSubaccountCode?: string;
  platformFeePercent: number;
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
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean;
  getProviderPayoutStatus(subaccountCode?: string): ProviderPayoutStatus;
  resolveSettlementStatus(input: {
    paymentSucceeded: boolean;
    providerSubaccountCode?: string;
  }): SettlementStatus;
}
