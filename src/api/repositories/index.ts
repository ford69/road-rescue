import { apiRequest } from '../client/http';
import type {
  AdminDashboardDto,
  ChatMessageDto,
  LiveLocationDto,
  MechanicDto,
  MechanicEarningsDto,
  NotificationDto,
  PaymentDto,
  PaymentInitializationDto,
  ProviderPaymentDto,
  ProviderPayoutInfoDto,
  RescueRequestDto,
  ServiceTypeDto,
  SubscriptionPlanDto,
  SubscriptionPlanSlug,
  SubscriptionSummaryDto,
  SubscriptionUpgradeDto,
  VehicleDto,
} from '../types';

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

export const paymentsApi = {
  initialize(requestId: string) {
    return apiRequest<PaymentInitializationDto>(`/payments/${requestId}/initialize`, {
      method: 'POST',
    });
  },
  verify(reference: string) {
    return apiRequest<PaymentDto>(`/payments/verify/${encodeURIComponent(reference)}`);
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
  initializeUpgrade(planSlug: SubscriptionPlanSlug) {
    return apiRequest<SubscriptionUpgradeDto>('/subscriptions/upgrade', {
      method: 'POST',
      body: JSON.stringify({ planSlug }),
    });
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
