import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    const { accessToken, user: publicUser } = await api.post<AuthResponse>('/auth/login', input);
    setAccessToken(accessToken);
    await fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (input: RegisterInput) => {
    const { accessToken, user: publicUser } = await api.post<AuthResponse>('/auth/register', input);
    setAccessToken(accessToken);
    await fetchUser();
  }, [fetchUser]);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
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
