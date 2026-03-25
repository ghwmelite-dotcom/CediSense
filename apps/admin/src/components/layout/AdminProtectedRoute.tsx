import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Gold ₵ pulse loader */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute w-16 h-16 rounded-full bg-gold/10 animate-ping"
              aria-hidden="true"
            />
            <div
              className="absolute w-12 h-12 rounded-full bg-gold/20 animate-pulse"
              aria-hidden="true"
            />
            <span
              className="relative z-10 text-3xl font-bold text-gold font-display animate-gold-pulse"
              aria-hidden="true"
            >
              ₵
            </span>
          </div>
          <p className="text-white/40 text-sm">Loading admin portal…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
