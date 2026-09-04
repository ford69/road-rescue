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
  estimatedPrice: number;
  icon: string;
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

export interface SubscriptionUpgradeDto {
  plan: SubscriptionPlanDto;
  checkoutConfigured: boolean;
  message: string;
  callbackUrl: string;
  customerEmail: string;
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

export interface RescueRequestDto {
  _id: string;
  status: RequestStatus;
  serviceType: ServiceType;
  quotedPrice: number;
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
    userId?: { firstName: string; lastName: string; phone: string };
  };
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
