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
} from '../types';

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
  create(input: {
    vehicleId: string;
    serviceType: string;
    pickupAddress: string;
    pickupCity: string;
    latitude: number;
    longitude: number;
    description?: string;
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
  async requestConfirmation(id: string) {
    try {
      return await apiRequest<RescueRequestDto>(`/requests/${id}/request-confirmation`, {
        method: 'POST',
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
  publicReviews(id: string) {
    return apiRequest<MechanicReviewDto[]>(`/mechanics/${id}/reviews`);
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
