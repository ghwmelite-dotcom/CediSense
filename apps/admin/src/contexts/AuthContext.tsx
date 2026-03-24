import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { LoginInput, AuthResponse, RefreshResponse, User } from '@cedisense/shared';
import { api, setAccessToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: { phone: string; pin: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try silent refresh on mount
  useEffect(() => {
    async function init() {
      try {
        const { accessToken } = await api.post<RefreshResponse>('/auth/refresh');
        setAccessToken(accessToken);
        const userData = await api.get<User>('/users/me');
        if (userData.role === 'user') {
          setAccessToken(null);
          setUser(null);
        } else {
          setUser(userData);
        }
      } catch {
        // No valid refresh token — user needs to log in
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { accessToken } = await api.post<AuthResponse>('/auth/login', input);
    setAccessToken(accessToken);
    const userData = await api.get<User>('/users/me');
    if (userData.role === 'user') {
      setAccessToken(null);
      setUser(null);
      throw new Error('Access denied — admin privileges required');
    }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
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
