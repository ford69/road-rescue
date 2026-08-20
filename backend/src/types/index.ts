export type Role = 'customer' | 'mechanic' | 'admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type RequestStatus =
  | 'requested'
  | 'accepted'
  | 'enroute'
  | 'arrived'
  | 'inprogress'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

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
