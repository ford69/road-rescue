import { apiRequest } from '../client/http';
import type { ApiUser, AuthTokens, ServiceType } from '../types';
import { tokenStore } from '../utils/tokenStore';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

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

function authLog(event: string, extra?: Record<string, unknown>): void {
  console.info(`[auth] ${event}`, extra ?? {});
}

/**
 * Always hit logout with credentials so HttpOnly cookies are cleared even when
 * localStorage is already empty. Captures the current bearer before clearing.
 */
async function dropExistingSession(): Promise<void> {
  const access = tokenStore.getAccess();
  tokenStore.clear();
  try {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (access) headers.set('Authorization', `Bearer ${access}`);
    authLog('auth.logout.started', { reason: 'replace_session' });
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
    authLog('auth.logout.success', { reason: 'replace_session' });
  } catch {
    authLog('auth.logout.success', { reason: 'replace_session_client_cleared' });
  }
}

function storeSession(tokens?: AuthTokens): void {
  if (!tokens?.accessToken || !tokens?.refreshToken) return;
  tokenStore.set(tokens.accessToken, tokens.refreshToken);
}

export const authApi = {
  async registerCustomer(input: RegisterCustomerInput) {
    authLog('auth.registration.started', { role: 'customer' });
    await dropExistingSession();
    const data = await apiRequest<RegisterResult>('/auth/register/customer', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    storeSession(data.tokens);
    authLog('auth.registration.success', { role: 'customer', userId: data.user?.id });
    return data;
  },

  async registerMechanic(input: RegisterMechanicInput) {
    authLog('auth.registration.started', { role: 'mechanic' });
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

    const data = await apiRequest<RegisterResult>('/auth/register/mechanic', {
      method: 'POST',
      body: formData,
    });
    authLog('auth.registration.success', { role: 'mechanic' });
    return data;
  },

  async login(email: string, password: string) {
    authLog('auth.login.started');
    await dropExistingSession();
    const data = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeSession(data.tokens);
    authLog('auth.login.success', { userId: data.user.id });
    return data;
  },

  async loginAdmin(email: string, password: string) {
    authLog('auth.login.started', { role: 'admin' });
    await dropExistingSession();
    const data = await apiRequest<AuthResult>('/auth/login/admin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeSession(data.tokens);
    authLog('auth.login.success', { userId: data.user.id, role: 'admin' });
    return data;
  },

  async logout() {
    await dropExistingSession();
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
    storeSession(data.tokens);
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
