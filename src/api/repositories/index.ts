import { ApiClientError, apiRequest } from '../client/http';
import type {
  AdminDashboardDto,
  ChatMessageDto,
  LiveLocationDto,
  MechanicDto,
  MechanicPublicProfileDto,
  MechanicReviewDto,
  MechanicEarningsDto,
  NotificationDto,
  ProviderPaymentDto,
  ProviderPayoutInfoDto,
  RescueRequestDto,
  ServiceTypeDto,
  SubscriptionCheckoutDto,
  SubscriptionPlanDto,
  SubscriptionPlanSlug,
  SubscriptionSummaryDto,
  VehicleDto,
  PaginatedDto,
  CustomerHistoryDto,
  ProviderWalletDto,
  ProviderServicesBoardDto,
  ProviderServiceOfferingDto,
  ServiceProviderOfferDto,
  WalletTransactionDto,
  WalletDepositDto,
  PayoutMethodDto,
  WalletWithdrawalDto,
  WalletDepositInitDto,
  AdminFinancialOverviewDto,
  AdminProviderFinancialAccountDto,
  FinanceSummaryDto,
  FinanceTransactionDto,
  CorporateCashDto,
  JobPaymentInitDto,
  SettlementAwaitingItemDto,
  SettlementBatchDto,
} from '../types';

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function isRejectedStatusValue(error: unknown, status: string): boolean {
  if (!(error instanceof ApiClientError) || error.status !== 400) return false;
  const details = error.details as { fieldErrors?: { status?: string[] } } | undefined;
  return (details?.fieldErrors?.status ?? []).some((message) => message.includes(status));
}

export type SupportTicketCategory = 'complaint' | 'billing' | 'account' | 'rescue' | 'other';

export interface SupportTicketDto {
  id: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
}

export const catalogApi = {
  serviceTypes() {
    return apiRequest<ServiceTypeDto[]>('/service-types');
  },
  providersForService(slug: string, lat: number, lng: number) {
    return apiRequest<ServiceProviderOfferDto[]>(
      `/service-types/${slug}/providers${queryString({ lat, lng })}`,
    );
  },
};

export const vehiclesApi = {
  list() {
    return apiRequest<VehicleDto[]>('/vehicles');
  },
  create(input: {
    make: string;
    model: string;
    colour: string;
    registrationNumber: string;
    year: number;
    engineType?: string;
    nickname?: string;
  }) {
    return apiRequest<VehicleDto>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export const requestsApi = {
  list() {
    return apiRequest<RescueRequestDto[]>('/requests');
  },
  history(params?: { page?: number; limit?: number; q?: string; status?: 'completed' | 'cancelled' }) {
    return apiRequest<CustomerHistoryDto>(
      `/requests/history${queryString({
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status,
      })}`,
    );
  },
  create(input: {
    vehicleId: string;
    serviceType: string;
    pickupAddress: string;
    pickupCity: string;
    latitude: number;
    longitude: number;
    description?: string;
    mechanicId?: string;
  }) {
    return apiRequest<RescueRequestDto>('/requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  available() {
    return apiRequest<RescueRequestDto[]>('/requests/available');
  },
  accept(id: string) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/accept`, { method: 'POST' });
  },
  updateStatus(id: string, status: string) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  getQuote(id: string) {
    return apiRequest<{
      snapshot: RescueRequestDto['pricingSnapshot'];
      status: RescueRequestDto['pricingConfirmationStatus'];
      quotedPrice: number;
      pendingQuote: RescueRequestDto['pendingQuote'];
      quoteHistory: RescueRequestDto['quoteHistory'];
    }>(`/requests/${id}/quote`);
  },
  submitQuote(id: string, input: { amountGhs: number; partsGhs?: number; reason?: string }) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/quote`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  acceptQuote(id: string) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/quote/accept`, { method: 'POST' });
  },
  rejectQuote(id: string, reason?: string) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/quote/reject`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },
  async requestConfirmation(id: string, quotedPrice?: number) {
    try {
      return await apiRequest<RescueRequestDto>(`/requests/${id}/request-confirmation`, {
        method: 'POST',
        body: JSON.stringify(quotedPrice != null ? { quotedPrice } : {}),
      });
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
      try {
        return await apiRequest<RescueRequestDto>(`/requests/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'awaiting_confirmation' }),
        });
      } catch (patchError) {
        // Production still validates the older status enum (no awaiting_confirmation).
        if (!isRejectedStatusValue(patchError, 'awaiting_confirmation')) throw patchError;
        return apiRequest<RescueRequestDto>(`/requests/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' }),
        });
      }
    }
  },
  async confirmCompletion(id: string) {
    try {
      return await apiRequest<RescueRequestDto>(`/requests/${id}/confirm-completion`, {
        method: 'POST',
      });
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 404) throw error;
      return apiRequest<RescueRequestDto>(`/requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
    }
  },
  reportIssue(id: string, reason: string) {
    return apiRequest<RescueRequestDto>(`/requests/${id}/report-issue`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  rate(id: string, input: { stars: number; review?: string }) {
    return apiRequest<{
      rating: number;
      review: string;
      serviceId: string;
      providerId: string;
      createdAt: string;
    }>(`/requests/${id}/rating`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  location(id: string) {
    return apiRequest<LiveLocationDto | null>(`/requests/${id}/location`);
  },
};

export const mechanicsApi = {
  profile() {
    return apiRequest<{ profile: MechanicDto }>('/auth/me').then((data) => data.profile);
  },
  nearby(lat = 5.6037, lng = -0.187) {
    return apiRequest<MechanicDto[]>(`/mechanics/nearby?lat=${lat}&lng=${lng}`);
  },
  publicProfile(id: string) {
    return apiRequest<MechanicPublicProfileDto>(`/mechanics/${id}`);
  },
  publicServices(id: string) {
    return apiRequest<ProviderServiceOfferingDto[]>(`/mechanics/${id}/services`);
  },
  publicReviews(id: string, params?: { page?: number; limit?: number }) {
    return apiRequest<PaginatedDto<MechanicReviewDto>>(
      `/mechanics/${id}/reviews${queryString({ page: params?.page, limit: params?.limit })}`,
    );
  },
  setAvailability(availability: boolean) {
    return apiRequest('/mechanics/me/availability', {
      method: 'PATCH',
      body: JSON.stringify({ availability }),
    });
  },
  updateLocation(input: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    requestId?: string;
  }) {
    return apiRequest<LiveLocationDto>('/mechanics/me/location', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  earnings() {
    return apiRequest<MechanicEarningsDto>('/mechanics/me/earnings');
  },
  jobHistory(params?: { page?: number; limit?: number; q?: string }) {
    return apiRequest<PaginatedDto<RescueRequestDto>>(
      `/mechanics/me/jobs/history${queryString({
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
      })}`,
    );
  },
  payments() {
    return apiRequest<ProviderPaymentDto[]>('/mechanics/me/payments');
  },
  payoutInfo() {
    return apiRequest<ProviderPayoutInfoDto>('/mechanics/me/payout-info');
  },
};

export const notificationsApi = {
  list() {
    return apiRequest<NotificationDto[]>('/notifications');
  },
  markRead(id: string) {
    return apiRequest<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' });
  },
  markAllRead() {
    return apiRequest<{ success: boolean }>('/notifications/read-all', { method: 'POST' });
  },
};

export const chatApi = {
  list(requestId: string) {
    return apiRequest<ChatMessageDto[]>(`/requests/${requestId}/messages`);
  },
  send(requestId: string, body: string) {
    return apiRequest<ChatMessageDto>(`/requests/${requestId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },
};

export const subscriptionsApi = {
  listPlans() {
    return apiRequest<SubscriptionPlanDto[]>('/subscriptions/plans');
  },
  current() {
    return apiRequest<SubscriptionSummaryDto>('/subscriptions/me');
  },
  checkout(planSlug: SubscriptionPlanSlug = 'basic') {
    return apiRequest<SubscriptionCheckoutDto>('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ planSlug }),
    });
  },
  verify(reference: string) {
    return apiRequest<SubscriptionSummaryDto>(
      `/subscriptions/verify/${encodeURIComponent(reference)}`,
    );
  },
  downgradeToFree() {
    return apiRequest<SubscriptionSummaryDto>('/subscriptions/downgrade', { method: 'POST' });
  },
};

export const walletApi = {
  get() {
    return apiRequest<ProviderWalletDto>('/provider/wallet');
  },
  transactions(params: { page?: number; limit?: number; type?: string } = {}) {
    return apiRequest<PaginatedDto<WalletTransactionDto>>(
      `/provider/wallet/transactions${queryString(params)}`,
    );
  },
  deposits(params: { page?: number; limit?: number } = {}) {
    return apiRequest<PaginatedDto<WalletDepositDto>>(
      `/provider/wallet/deposits${queryString(params)}`,
    );
  },
  initiateDeposit(amountGhs: number) {
    return apiRequest<WalletDepositInitDto>('/provider/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountGhs }),
    });
  },
  verifyDeposit(reference: string) {
    return apiRequest<{
      wallet?: ProviderWalletDto;
      status?: string;
      duplicate?: boolean;
    }>(`/provider/wallet/deposit/verify/${encodeURIComponent(reference)}`);
  },
  payoutMethods() {
    return apiRequest<PayoutMethodDto[]>('/provider/wallet/payout-methods');
  },
  addPayoutMethod(input: {
    kind: 'bank' | 'mobile_money';
    label: string;
    accountName: string;
    accountNumber: string;
    bankName?: string;
    bankCode?: string;
    network?: 'mtn' | 'vodafone' | 'airteltigo';
    isDefault?: boolean;
  }) {
    return apiRequest<PayoutMethodDto>('/provider/wallet/payout-methods', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  updatePayoutMethod(id: string, input: { isDefault?: boolean; active?: boolean; label?: string }) {
    return apiRequest<PayoutMethodDto>(`/provider/wallet/payout-methods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  withdrawals(params: { page?: number; limit?: number } = {}) {
    return apiRequest<PaginatedDto<WalletWithdrawalDto>>(
      `/provider/wallet/withdrawals${queryString(params)}`,
    );
  },
  requestWithdrawal(
    amountGhs: number,
    payoutMethodId: string,
    sourceType: 'service_earnings' | 'deposit_refund' = 'deposit_refund',
  ) {
    return apiRequest<WalletWithdrawalDto>('/provider/wallet/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amountGhs, payoutMethodId, sourceType }),
    });
  },
  cancelWithdrawal(id: string, reason: string) {
    return apiRequest<WalletWithdrawalDto>(`/provider/wallet/withdrawals/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

export const paymentsApi = {
  initialize(requestId: string) {
    return apiRequest<JobPaymentInitDto>(`/payments/initialize/${requestId}`, { method: 'POST' });
  },
  verify(reference: string) {
    return apiRequest<ProviderPaymentDto>(`/payments/verify/${encodeURIComponent(reference)}`);
  },
  forRequest(requestId: string) {
    return apiRequest<ProviderPaymentDto | null>(`/requests/${requestId}/payment`);
  },
};

export const adminFinanceApi = {
  overview() {
    return apiRequest<AdminFinancialOverviewDto>('/admin/financial-overview');
  },
  summary(params: { from?: string; to?: string } = {}) {
    return apiRequest<FinanceSummaryDto>(`/admin/finance/summary${queryString(params)}`);
  },
  transactions(
    params: {
      page?: number;
      limit?: number;
      q?: string;
      type?: string;
      status?: string;
      method?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    return apiRequest<PaginatedDto<FinanceTransactionDto>>(
      `/admin/finance/transactions${queryString(params)}`,
    );
  },
  withdrawals(params: { page?: number; limit?: number; status?: string; q?: string } = {}) {
    return apiRequest<PaginatedDto<WalletWithdrawalDto>>(
      `/admin/withdrawals${queryString(params)}`,
    );
  },
  withdrawal(id: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}`);
  },
  approve(id: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/approve`, { method: 'POST' });
  },
  reject(id: string, reason: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  process(id: string, payoutMethodUsed: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ payoutMethodUsed }),
    });
  },
  confirm(
    id: string,
    input: {
      payoutReference: string;
      amountPaidGhs?: number;
      payoutDate?: string;
      proofUrl?: string;
      destinationNote?: string;
    },
  ) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  fail(id: string, reason: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  cancel(id: string, reason: string) {
    return apiRequest<WalletWithdrawalDto>(`/admin/withdrawals/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  unverifiedPayoutMethods() {
    return apiRequest<PayoutMethodDto[]>('/admin/payout-methods/unverified');
  },
  verifyPayoutMethod(id: string) {
    return apiRequest<PayoutMethodDto>(`/admin/payout-methods/${id}/verify`, { method: 'POST' });
  },
  awaitingSettlements(params: { from?: string; to?: string; q?: string } = {}) {
    return apiRequest<{ items: SettlementAwaitingItemDto[] }>(
      `/admin/settlements/awaiting${queryString(params)}`,
    );
  },
  settlements(params: { page?: number; limit?: number; status?: string } = {}) {
    return apiRequest<PaginatedDto<SettlementBatchDto>>(
      `/admin/settlements${queryString(params)}`,
    );
  },
  settlement(id: string) {
    return apiRequest<SettlementBatchDto>(`/admin/settlements/${id}`);
  },
  createSettlement(input: {
    settlementReference: string;
    amountReceivedGhs: number;
    settlementDate: string;
    bankReference?: string;
    paystackReference?: string;
    paystackFeesGhs?: number;
    notes?: string;
    paymentIds?: string[];
    depositIds?: string[];
    confirm?: boolean;
  }) {
    return apiRequest<SettlementBatchDto>('/admin/settlements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  confirmSettlement(id: string) {
    return apiRequest<SettlementBatchDto>(`/admin/settlements/${id}/confirm`, { method: 'POST' });
  },
  resolveSettlement(
    id: string,
    input: {
      amountReceivedGhs?: number;
      paystackFeesGhs?: number;
      bankReference?: string;
      acceptDifference?: boolean;
      note?: string;
    },
  ) {
    return apiRequest<SettlementBatchDto>(`/admin/settlements/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  cash() {
    return apiRequest<CorporateCashDto>('/admin/cash-reconciliation');
  },
  recordCommitment(input: { amountGhs: number; reason: string; release?: boolean; reference?: string }) {
    return apiRequest<CorporateCashDto>('/admin/cash-commitments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  providerAccount(id: string) {
    return apiRequest<AdminProviderFinancialAccountDto>(`/admin/providers/${id}/financial-account`);
  },
  adjust(id: string, input: { amountGhs: number; reason: string; reference?: string }) {
    return apiRequest<AdminProviderFinancialAccountDto>(`/admin/providers/${id}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export const adminApi = {
  dashboard() {
    return apiRequest<AdminDashboardDto>('/admin/dashboard');
  },
  verifyMechanic(id: string, status: 'verified' | 'rejected') {
    return apiRequest<MechanicDto>(`/admin/mechanics/${id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  serviceTypes() {
    return apiRequest<ServiceTypeDto[]>('/admin/service-types');
  },
  setServiceTypeStatus(slug: string, active: boolean, reason?: string) {
    return apiRequest<ServiceTypeDto>(`/admin/service-types/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ active, reason }),
    });
  },
  providerServices(id: string) {
    return apiRequest<{
      mechanicId: string;
      garageName: string;
      offerings: ProviderServiceOfferingDto[];
    }>(`/admin/providers/${id}/services`);
  },
};

export const providerServicesApi = {
  board() {
    return apiRequest<ProviderServicesBoardDto>('/provider/services');
  },
  upsert(input: {
    serviceType: string;
    pricingModel: string;
    basePriceGhs?: number;
    additionalCharges?: Array<{
      kind: string;
      label: string;
      amountGhs?: number;
      perKmGhs?: number;
      commissionable?: boolean;
    }>;
    partsNotIncluded?: boolean;
    active?: boolean;
  }) {
    return apiRequest<ProviderServiceOfferingDto>('/provider/services', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
  setStatus(serviceType: string, active: boolean) {
    return apiRequest<ProviderServiceOfferingDto>(`/provider/services/${serviceType}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  },
  remove(serviceType: string) {
    return apiRequest<ProviderServiceOfferingDto>(`/provider/services/${serviceType}`, {
      method: 'DELETE',
    });
  },
};

export const supportApi = {
  createTicket(input: {
    subject: string;
    description: string;
    category?: SupportTicketCategory;
  }) {
    return apiRequest<SupportTicketDto>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
