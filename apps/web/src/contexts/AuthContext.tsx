import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { RegisterInput, LoginInput, AuthResponse, RefreshResponse, User } from '@cedisense/shared';
import { api, setAccessToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await api.get<User>('/users/me');
      setUser(userData);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  // Try silent refresh on mount
  useEffect(() => {
    async function init() {
      try {
        const { accessToken } = await api.post<RefreshResponse>('/auth/refresh');
        setAccessToken(accessToken);
        await fetchUser();
      } catch {
        // No valid refresh token — user needs to log in
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [fetchUser]);

  const login = useCallback(async (input: LoginInput) => {
    const { accessToken } = await api.post<AuthResponse>('/auth/login', input);
    setAccessToken(accessToken);
    // Fetch full user and set state directly — don't rely on fetchUser
    // to avoid race condition where navigation happens before state propagates
    const userData = await api.get<User>('/users/me');
    setUser(userData);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { accessToken } = await api.post<AuthResponse>('/auth/register', input);
    setAccessToken(accessToken);
    const userData = await api.get<User>('/users/me');
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout even if API call fails
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  }), [user, isLoading, login, register, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
