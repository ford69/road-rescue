export type Role = 'customer' | 'mechanic' | 'admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type RequestStatus =
  | 'requested'
  | 'accepted'
  | 'enroute'
  | 'arrived'
  | 'inprogress'
  | 'awaiting_confirmation'
  | 'issue_reported'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type SettlementStatus = 'pending' | 'processing' | 'settled' | 'failed';

export type SubscriptionPlanSlug = 'free' | 'basic' | 'premium';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'expired';

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

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type NotificationType = 'success' | 'info' | 'warning' | 'critical';

export type ServiceTypeSlug =
  | 'towing'
  | 'flat-tire'
  | 'battery'
  | 'lockout'
  | 'fuel'
  | 'accident'
  | 'other';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
}
