export type Role = 'customer' | 'mechanic' | 'admin';

export type ServiceType =
  | 'towing'
  | 'flat-tire'
  | 'battery'
  | 'lockout'
  | 'fuel'
  | 'accident'
  | 'other';

export type RequestStatus =
  | 'requested'
  | 'searching'
  | 'assigned'
  | 'accepted'
  | 'enroute'
  | 'arrived'
  | 'inprogress'
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
  currency: 'GHS';
  paymentMethod: 'paystack' | 'cash' | 'mobile_money' | 'card';
  transactionReference?: string;
  channel?: string;
  paidAt?: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
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
  eta?: number;
}
