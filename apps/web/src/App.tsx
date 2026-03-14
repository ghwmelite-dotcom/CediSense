import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
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
import { AIChatPage } from '@/pages/AIChatPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { RecurringPage } from '@/pages/RecurringPage';

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
    <LanguageProvider>
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
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/ai-chat" element={<AIChatPage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}
