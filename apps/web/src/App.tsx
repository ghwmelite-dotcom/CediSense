import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TransactionFeedPage } from '@/pages/TransactionFeedPage';
import { AddTransactionPage } from '@/pages/AddTransactionPage';
import { ImportPage } from '@/pages/ImportPage';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-4 md:p-6">
      <div className="bg-ghana-surface rounded-xl p-6 text-center">
        <p className="text-muted">{name} — coming in a future subsystem</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Onboarding (protected, no shell) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Protected routes with app shell */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionFeedPage />} />
          <Route path="/transactions/import" element={<ImportPage />} />
          <Route path="/budgets" element={<Placeholder name="Budgets" />} />
          <Route path="/goals" element={<Placeholder name="Goals" />} />
          <Route path="/ai-chat" element={<Placeholder name="AI Chat" />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
