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

// Module-level single-flight for the boot refresh (shared across mounts).
let bootRefreshPromise: Promise<void> | null = null;
function bootRefresh(): Promise<void> {
  if (!bootRefreshPromise) {
    bootRefreshPromise = api
      .post<RefreshResponse>('/auth/refresh')
      .then(({ accessToken }) => setAccessToken(accessToken))
      .finally(() => {
        bootRefreshPromise = null;
      });
  }
  return bootRefreshPromise;
}

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

  // Single-flight boot refresh: StrictMode double-mounts this effect in dev,
  // and rapid reloads can re-enter it — share one in-flight refresh instead
  // of firing parallel rotations (which race and can kill the session).
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await bootRefresh();
        if (!cancelled) await fetchUser();
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
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
