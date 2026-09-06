import { apiRequest } from '../client/http';
import type { ApiUser, AuthTokens, ServiceType } from '../types';
import { tokenStore } from '../utils/tokenStore';

export interface AuthResult {
  user: ApiUser;
  tokens: AuthTokens;
  emailVerificationToken?: string;
}

export interface RegisterResult {
  requiresEmailVerification: boolean;
  requiresSubscription?: boolean;
  email?: string;
  emailVerificationToken?: string;
  user?: ApiUser;
  tokens?: AuthTokens;
}

export interface RegisterCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterMechanicInput extends RegisterCustomerInput {
  garageName: string;
  ghanaCardNumber: string;
  selfie: File;
  experience: number;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  specialties: ServiceType[];
  truck?: string;
}

async function dropExistingSession(): Promise<void> {
  try {
    if (tokenStore.getAccess() || tokenStore.getRefresh()) {
      await apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
    }
  } catch {
    // Stale tokens/cookies should not block a new registration.
  } finally {
    tokenStore.clear();
  }
}

export const authApi = {
  async registerCustomer(input: RegisterCustomerInput) {
    await dropExistingSession();
    const data = await apiRequest<RegisterResult>('/auth/register/customer', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (data.tokens) {
      tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    }
    return data;
  },

  async registerMechanic(input: RegisterMechanicInput) {
    await dropExistingSession();
    const formData = new FormData();
    formData.append('firstName', input.firstName);
    formData.append('lastName', input.lastName);
    formData.append('email', input.email);
    formData.append('phone', input.phone);
    formData.append('password', input.password);
    formData.append('garageName', input.garageName);
    formData.append('ghanaCardNumber', input.ghanaCardNumber);
    formData.append('selfie', input.selfie);
    formData.append('experience', String(input.experience));
    formData.append('city', input.city);
    formData.append('address', input.address);
    formData.append('latitude', String(input.latitude));
    formData.append('longitude', String(input.longitude));
    input.specialties.forEach((specialty) => formData.append('specialties', specialty));
    if (input.truck) formData.append('truck', input.truck);

    return apiRequest<RegisterResult>('/auth/register/mechanic', {
      method: 'POST',
      body: formData,
    });
  },

  async login(email: string, password: string) {
    tokenStore.clear();
    const data = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },

  async loginAdmin(email: string, password: string) {
    tokenStore.clear();
    const data = await apiRequest<AuthResult>('/auth/login/admin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },

  async logout() {
    try {
      await apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      tokenStore.clear();
    }
  },

  me() {
    return apiRequest<{ user: ApiUser; profile: unknown }>('/auth/me');
  },

  forgotPassword(email: string) {
    return apiRequest<{ message: string; resetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string) {
    return apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async verifyEmail(token: string) {
    const data = await apiRequest<{
      message: string;
      user: ApiUser;
      tokens?: AuthTokens;
    }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    if (data.tokens) {
      tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    }
    return data;
  },

  resendVerification(email: string) {
    return apiRequest<{ message: string; emailVerificationToken?: string }>(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
  },
};
