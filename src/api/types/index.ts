export type Role = 'customer' | 'mechanic' | 'admin';

export type ServiceType =
  | 'towing'
  | 'flat-tire'
  | 'battery'
  | 'lockout'
  | 'fuel'
  | 'accident'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type SettlementStatus = 'pending' | 'processing' | 'settled' | 'failed';

export type SubscriptionPlanSlug = 'free' | 'basic' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'non_renewing'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'expired';

export type SubscriptionFeature =
  | 'priority_matching'
  | 'member_discount'
  | 'premium_support'
  | 'higher_member_discount'
  | 'mechanic_discovery'
  | 'mechanic_profile'
  | 'mechanic_reviews'
  | 'service_upload'
  | 'service_towing'
  | 'service_fuel'
  | 'service_accident';

export type RequestStatus =
  | 'requested'
  | 'searching'
  | 'assigned'
  | 'accepted'
  | 'enroute'
  | 'arrived'
  | 'inprogress'
  | 'awaiting_confirmation'
  | 'issue_reported'
  | 'completed'
  | 'cancelled';

export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  avatar: string | null;
  status: string;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  lastLogin: string | null;
  createdAt: string;
  hasActiveSubscription?: boolean;
  subscriptionPlanSlug?: SubscriptionPlanSlug;
  subscriptionStatus?: SubscriptionStatus;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  code?: string;
  details?: unknown;
}

export interface VehicleDto {
  _id: string;
  make: string;
  vehicleModel: string;
  colour: string;
  registrationNumber: string;
  year: number;
  engineType: string;
  nickname?: string;
}

export interface ServiceTypeDto {
  _id: string;
  slug: ServiceType;
  name: string;
  description: string;
  icon: string;
  active?: boolean;
}

export type PricingModel = 'fixed' | 'starting_from' | 'quote';

export type AdditionalChargeKind =
  | 'call_out'
  | 'distance'
  | 'emergency'
  | 'inspection'
  | 'labour'
  | 'other';

export type PricingConfirmationStatus =
  | 'unconfirmed'
  | 'confirmed'
  | 'pending_quote'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'pending_revision';

export interface AdditionalChargeDto {
  kind: AdditionalChargeKind;
  label: string;
  amountGhs: number;
  perKmGhs?: number;
  commissionable: boolean;
}

export interface ProviderPriceRangeDto {
  minGhs: number | null;
  maxGhs: number | null;
  hasStartingFrom: boolean;
  quoteCount: number;
  pricedCount: number;
}

export interface ProviderServiceOfferingDto {
  id: string;
  serviceType: ServiceType;
  serviceName?: string;
  serviceDescription?: string;
  categoryId?: string;
  categoryName?: string;
  pricingModel: PricingModel;
  basePriceGhs: number | null;
  currency: 'GHS';
  additionalCharges: AdditionalChargeDto[];
  partsNotIncluded: boolean;
  active: boolean;
  displayLabel: string;
  updatedAt?: string;
}

export interface ProviderServicesBoardDto {
  currency: 'GHS';
  minPriceGhs: number;
  maxPriceGhs: number;
  maxChargeGhs: number;
  chargeKinds: Array<{ id: AdditionalChargeKind; label: string }>;
  categories: Array<{
    id: string;
    name: string;
    services: Array<{
      slug: ServiceType;
      name: string;
      description: string;
      categoryId: string;
      offering: ProviderServiceOfferingDto | null;
    }>;
  }>;
  offerings: ProviderServiceOfferingDto[];
}

export interface ServiceProviderOfferDto {
  mechanicId: string;
  garageName: string;
  name: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  availability: boolean;
  experience: number;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  avatar: string | null;
  serviceType: ServiceType;
  serviceName: string;
  pricingModel: PricingModel;
  basePriceGhs: number | null;
  displayLabel: string;
  additionalCharges: AdditionalChargeDto[];
  displayedTotalGhs: number;
  partsNotIncluded: boolean;
  currency: 'GHS';
}

export interface PricingSnapshotDto {
  serviceType: ServiceType;
  serviceName: string;
  pricingModel: PricingModel;
  basePriceGhs: number;
  additionalCharges: AdditionalChargeDto[];
  distanceKm?: number;
  currency: 'GHS';
  displayedTotalGhs: number;
  commissionableAmountGhs: number;
  partsNotIncluded: boolean;
  snapshotAt: string;
}

export interface JobQuoteDto {
  amountGhs: number;
  commissionableAmountGhs: number;
  partsGhs: number;
  reason?: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface NotificationDto {
  _id: string;
  title: string;
  body: string;
  type: 'success' | 'info' | 'warning' | 'critical';
  read: boolean;
  createdAt: string;
  meta?: { requestId?: string };
}

export interface MechanicPublicProfileDto {
  id: string;
  name: string;
  garageName: string;
  avatar: string | null;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  experience: number;
  specialties: ServiceType[];
  services?: ProviderServiceOfferingDto[];
  priceRange?: ProviderPriceRangeDto;
  city: string;
  availability: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
}

export interface MechanicReviewDto {
  id: string;
  stars: number;
  review: string;
  customerName: string;
  createdAt: string;
}

export interface MechanicDto {
  _id: string;
  garageName: string;
  ghanaCardNumber?: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  earnings: number;
  availability: boolean;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  experience?: number;
  specialties: ServiceType[];
  truck?: string;
  documents?: string[];
  location: { city: string; address: string };
  latitude: number;
  longitude: number;
  userId?: {
    _id?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    avatar?: string;
    status?: string;
  };
  createdAt?: string;
}

export interface CustomerDto {
  _id: string;
  userId?: {
    _id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status?: string;
    emailVerified?: boolean;
    lastLogin?: string;
    createdAt?: string;
  };
  createdAt?: string;
}

export interface PaymentDto {
  _id: string;
  customer: string;
  mechanic?: string;
  request: string;
  amount: number;
  grossAmount?: number;
  platformFee?: number;
  providerAmount?: number;
  currency: 'GHS';
  paymentProvider?: string;
  paymentMethod: 'paystack' | 'cash' | 'mobile_money' | 'card';
  transactionReference?: string;
  channel?: string;
  paidAt?: string;
  status: PaymentStatus;
  settlementStatus?: SettlementStatus;
  settledAt?: string;
  createdAt: string;
}

export interface ProviderPaymentDto {
  id: string;
  customerId: string;
  providerId?: string;
  serviceRequestId: string;
  paymentProvider: string;
  paymentReference?: string;
  grossAmount: number;
  platformFee: number;
  providerAmount: number;
  currency: 'GHS';
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;
  paymentMethod: string;
  channel?: string;
  paidAt?: string;
  settledAt?: string;
  createdAt: string;
}

export interface ProviderPayoutInfoDto {
  configured: boolean;
  provider: string;
  subaccountCode?: string;
  managementUrl?: string;
  message: string;
}

export interface MechanicEarningsDto {
  totalEarnings: number;
  pendingPayments: number;
  settledPayments: number;
  completedJobs: number;
  rating: number;
  jobs: RescueRequestDto[];
  recentPayments: ProviderPaymentDto[];
  payoutInfo: ProviderPayoutInfoDto;
  disclaimer: string;
}

export interface SubscriptionPlanDto {
  _id: string;
  slug: SubscriptionPlanSlug;
  name: string;
  description: string;
  monthlyPriceGhs: number;
  features: SubscriptionFeature[];
  active: boolean;
  sortOrder: number;
}

export interface SubscriptionDto {
  _id: string;
  planSlug: SubscriptionPlanSlug;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionSummaryDto {
  subscription: SubscriptionDto | null;
  plan: SubscriptionPlanDto | null;
  entitlements: SubscriptionFeature[];
  planSlug?: SubscriptionPlanSlug;
  status?: SubscriptionStatus;
  allowedServiceTypes?: ServiceType[];
  restrictedServiceTypes?: ServiceType[];
  memberDiscountPercent: number;
}

export interface SubscriptionCheckoutDto {
  authorizationUrl: string;
  reference: string;
  callbackUrl: string;
  publicKey?: string;
  planSlug: SubscriptionPlanSlug;
}

export interface PaymentInitializationDto {
  authorizationUrl: string;
  reference: string;
  callbackUrl: string;
}

export interface LiveLocationDto {
  _id: string;
  mechanic: string;
  request?: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
}

export interface ChatMessageDto {
  _id: string;
  request: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    role: Role;
    avatar?: string;
  };
  body: string;
  createdAt: string;
}

export interface AdminDashboardDto {
  kpis: { customers: number; mechanics: number; liveJobs: number; revenueGhs: number };
  liveJobs: RescueRequestDto[];
  mechanics: MechanicDto[];
  customers: CustomerDto[];
  payments: PaymentDto[];
  serviceTypes: ServiceTypeDto[];
}

export interface PaginatedDto<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CustomerHistoryDto extends PaginatedDto<RescueRequestDto> {
  counts: {
    total: number;
    completed: number;
    cancelled: number;
  };
}

export interface CustomerRatingDto {
  stars: number;
  review: string;
  createdAt: string;
}

export interface RescueRequestDto {
  _id: string;
  status: RequestStatus;
  serviceType: ServiceType;
  quotedPrice?: number;
  pricingSnapshot?: PricingSnapshotDto;
  pricingConfirmationStatus?: PricingConfirmationStatus;
  pendingQuote?: JobQuoteDto;
  quoteHistory?: JobQuoteDto[];
  paymentStatus: string;
  description?: string;
  images?: string[];
  pickupLocation: {
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  vehicle?: VehicleDto;
  mechanic?: MechanicDto;
  customer?: {
    _id: string;
    userId?: { firstName: string; lastName: string; phone?: string };
  };
  customerRating?: CustomerRatingDto | null;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  completionRequestedAt?: string;
  customerConfirmedAt?: string;
  issueReportedAt?: string;
  issueReason?: string;
  eta?: number;
}

export interface ProviderWalletDto {
  currency: 'GHS';
  availableGhs: number;
  pendingSettlementGhs: number;
  reservedGhs: number;
  paidGhs: number;
  depositAvailableGhs: number;
  totalDepositedGhs: number;
  totalCommissionGhs: number;
  totalEarnedGhs: number;
  totalWithdrawnGhs: number;
  totalReversedGhs: number;
  commissionPercent: number;
  minDepositGhs: number;
  minWithdrawalGhs: number;
  maxWithdrawalGhs: number;
  minAvailableGhs: number;
  pendingWithdrawalGhs?: number;
  payoutInProgressGhs?: number;
}

export interface WalletTransactionDto {
  id?: string;
  reference: string;
  type: string;
  description: string;
  amountGhs: number;
  status: string;
  requestId?: string;
  paystackReference?: string;
  createdAt: string;
}

export interface WalletDepositDto {
  id: string;
  reference: string;
  amountGhs: number;
  status: string;
  channel?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PayoutMethodDto {
  id: string;
  kind: 'bank' | 'mobile_money';
  label: string;
  accountName: string;
  accountLast4: string;
  bankName?: string;
  bankCode?: string;
  network?: 'mtn' | 'vodafone' | 'airteltigo';
  verified: boolean;
  isDefault: boolean;
  mechanicId?: string;
  garageName?: string;
}

export interface WalletWithdrawalDto {
  id: string;
  reference: string;
  amountGhs: number;
  sourceType?: 'service_earnings' | 'deposit_refund';
  status: string;
  destination: {
    kind: 'bank' | 'mobile_money';
    label: string;
    accountName: string;
    accountLast4: string;
    accountNumber?: string;
    bankName?: string;
    network?: string;
  };
  rejectionReason?: string;
  failureReason?: string;
  payoutReference?: string;
  payoutMethodUsed?: string;
  amountPaidGhs?: number;
  payoutDate?: string;
  proofUrl?: string;
  destinationNote?: string;
  cancelReason?: string;
  createdAt: string;
  reviewedAt?: string;
  processedAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  mechanicId?: string;
  garageName?: string;
  reviewedBy?: string;
  processedBy?: string;
  confirmedBy?: string;
  wallet?: ProviderWalletDto;
  /** Provider's current available balance, included on admin lists. */
  availableGhs?: number;
}

export interface WalletDepositInitDto {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountGhs: number;
}

export interface CorporateCashDto {
  currency: 'GHS';
  settledGhs: number;
  allocatedGhs: number;
  paidGhs: number;
  committedGhs: number;
  unallocatedPayoutCashGhs: number;
  activity?: Array<{
    id: string;
    reference: string;
    type: string;
    direction: string;
    amountGhs: number;
    description: string;
    createdAt: string;
  }>;
}

export interface SettlementAwaitingItemDto {
  id: string;
  kind: 'job_payment' | 'provider_deposit';
  reference?: string;
  mechanicId?: string;
  requestId?: string;
  grossGhs: number;
  platformFeeGhs: number;
  entitlementGhs: number;
  paidAt?: string;
  createdAt: string;
}

export interface SettlementBatchDto {
  id: string;
  reference: string;
  settlementReference: string;
  paystackReference?: string;
  bankReference?: string;
  amountReceivedGhs: number;
  expectedGrossGhs: number;
  paystackFeesGhs: number;
  expectedNetGhs: number;
  /** Received minus expected net; negative means less arrived than expected. */
  discrepancyGhs: number;
  currency: 'GHS';
  settlementDate: string;
  status: 'draft' | 'discrepancy' | 'confirmed';
  notes?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  confirmedAt?: string;
  createdAt: string;
  itemCount: number;
  entitlementGhs: number;
  items?: Array<{
    kind: 'job_payment' | 'provider_deposit';
    paymentId?: string;
    depositId?: string;
    mechanicId?: string;
    amountGhs: number;
    entitlementGhs: number;
  }>;
}

export type FinanceTransactionType =
  | 'customer_payment'
  | 'provider_deposit'
  | 'commission'
  | 'provider_withdrawal'
  | 'refund'
  | 'adjustment';

export type FinanceTransactionMethod = 'card' | 'mobile_money' | 'bank' | 'wallet' | 'other';

export interface FinanceTransactionDto {
  id: string;
  reference: string;
  type: FinanceTransactionType;
  providerId?: string;
  providerName?: string;
  customerId?: string;
  customerName?: string;
  requestId?: string;
  amountGhs: number;
  commissionGhs?: number;
  direction: 'in' | 'out' | 'internal';
  date: string;
  method: FinanceTransactionMethod;
  status: string;
  description: string;
  details: Record<string, string | number | undefined>;
}

export interface FinanceAttentionItemDto {
  id:
    | 'settlements_pending'
    | 'settlement_discrepancies'
    | 'withdrawals_pending'
    | 'payouts_in_progress'
    | 'payouts_failed';
  title: string;
  description: string;
  count: number;
  amountGhs: number;
  severity: 'warning' | 'critical';
  action: { tab: 'settlements' | 'payouts'; status?: string };
}

export interface FinanceSummaryDto {
  currency: 'GHS';
  range: { from: string; to: string };
  commissionPercent: number;
  collected: {
    totalGhs: number;
    count: number;
    providerDepositsGhs: number;
    providerDepositCount: number;
    customerPaymentsGhs: number;
    customerPaymentCount: number;
    confirmedBankReceiptsGhs: number;
    confirmedSettlementCount: number;
    directCustomerPaymentsGhs: number;
    directJobCount: number;
  };
  providerEarnings: {
    totalGhs: number;
    availableGhs: number;
    setAsideGhs: number;
    setAsideForWithdrawalsGhs: number;
    setAsideForActiveJobsGhs: number;
    awaitingBankConfirmationGhs: number;
    providerCount: number;
  };
  roadRescueEarnings: {
    totalGhs: number;
    commissionDeductedGhs: number;
    commissionReversedGhs: number;
    inAppPaymentFeesGhs: number;
    jobCount: number;
  };
  awaitingSettlement: {
    totalGhs: number;
    transactionCount: number;
    openBatchCount: number;
    discrepancyCount: number;
  };
  providerPayments: {
    totalGhs: number;
    count: number;
    inProgressGhs: number;
    inProgressCount: number;
  };
  companyFunds: {
    availableGhs: number;
    confirmedBankReceiptsGhs: number;
    payoutsAssignedGhs: number;
    paidOutGhs: number;
    obligationsGhs: number;
  };
  needsAttention: FinanceAttentionItemDto[];
  recentActivity: FinanceTransactionDto[];
}

export interface JobPaymentInitDto {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountGhs: number;
  platformFeeGhs: number;
  providerAmountGhs: number;
}

export interface AdminFinancialOverviewDto {
  currency: string;
  totalAvailableGhs: number;
  totalPendingSettlementGhs?: number;
  totalDepositAvailableGhs?: number;
  totalReservedGhs: number;
  totalDepositedGhs: number;
  totalCommissionGhs: number;
  totalEarnedGhs?: number;
  totalWithdrawnGhs: number;
  pendingWithdrawals: number;
  failedWithdrawals: number;
  providerAccounts: number;
  corporateCash?: CorporateCashDto;
  recentActivity: Array<{
    reference: string;
    mechanicId: string;
    type: string;
    description: string;
    amountGhs: number;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminProviderFinancialAccountDto {
  mechanicId: string;
  garageName: string;
  wallet: ProviderWalletDto;
  payoutMethods?: PayoutMethodDto[];
  deposits: WalletDepositDto[];
  withdrawals: WalletWithdrawalDto[];
  ledger: WalletTransactionDto[];
}
