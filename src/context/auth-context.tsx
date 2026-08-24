import * as React from 'react';
import { authApi } from '@/api/auth';
import type { ApiUser, Role } from '@/api/types';
import { tokenStore } from '@/api/utils/tokenStore';
import { ApiClientError } from '@/api/client/http';

interface AuthContextValue {
  user: ApiUser | null;
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
  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshMe = React.useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setUser(null);
      return;
    }
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        tokenStore.clear();
        setUser(null);
      }
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
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
  };

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: Boolean(user),
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
