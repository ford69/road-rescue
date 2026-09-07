import * as React from 'react';
import { authApi } from '@/api/auth';
import type { ApiUser, Role } from '@/api/types';
import { tokenStore } from '@/api/utils/tokenStore';
import { ApiClientError } from '@/api/client/http';
import { shouldRestoreSessionOnPath } from '@/api/client/auth-session';

type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: ApiUser | null;
  status: AuthStatus;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  loginAdmin: (email: string, password: string) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setUser: (user: ApiUser | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<ApiUser | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('initializing');

  const setUser = React.useCallback((next: ApiUser | null) => {
    setUserState(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  const refreshMe = React.useCallback(async () => {
    const epoch = tokenStore.generation();
    if (!tokenStore.getAccess()) {
      if (tokenStore.generation() === epoch) {
        setUserState(null);
        setStatus('unauthenticated');
      }
      return;
    }
    try {
      const data = await authApi.me();
      if (tokenStore.generation() !== epoch) return;
      setUserState(data.user);
      setStatus('authenticated');
    } catch (error) {
      if (tokenStore.generation() !== epoch) return;
      if (error instanceof ApiClientError && error.status === 401) {
        tokenStore.clear();
        setUserState(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        const path = window.location.pathname;
        if (!shouldRestoreSessionOnPath(path) || !tokenStore.getAccess()) {
          setStatus('unauthenticated');
          setUserState(null);
          return;
        }
        await refreshMe();
      } finally {
        setStatus((current) => (current === 'initializing' ? 'unauthenticated' : current));
      }
    })();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data.user;
  };

  const loginAdmin = async (email: string, password: string) => {
    const data = await authApi.loginAdmin(email, password);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    try {
      localStorage.removeItem('rr_active_rescue');
    } catch {
      // ignore
    }
  };

  const value: AuthContextValue = {
    user,
    status,
    loading: status === 'initializing',
    isAuthenticated: status === 'authenticated' && Boolean(user),
    login,
    loginAdmin,
    logout,
    refreshMe,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useRequireRole(roles: Role[]): boolean {
  const { user } = useAuth();
  return Boolean(user && roles.includes(user.role));
}
