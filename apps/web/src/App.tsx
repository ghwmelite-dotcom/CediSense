import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';

// Lazy-loaded page components
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const TransactionFeedPage = lazy(() => import('@/pages/TransactionFeedPage').then(m => ({ default: m.TransactionFeedPage })));
const AddTransactionPage = lazy(() => import('@/pages/AddTransactionPage').then(m => ({ default: m.AddTransactionPage })));
const ImportPage = lazy(() => import('@/pages/ImportPage').then(m => ({ default: m.ImportPage })));
const AIChatPage = lazy(() => import('@/pages/AIChatPage').then(m => ({ default: m.AIChatPage })));
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const GoalsPage = lazy(() => import('@/pages/GoalsPage').then(m => ({ default: m.GoalsPage })));
const InsightsPage = lazy(() => import('@/pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const RecurringPage = lazy(() => import('@/pages/RecurringPage').then(m => ({ default: m.RecurringPage })));
const SplitsPage = lazy(() => import('@/pages/SplitsPage').then(m => ({ default: m.SplitsPage })));
const InvestmentsPage = lazy(() => import('@/pages/InvestmentsPage').then(m => ({ default: m.InvestmentsPage })));
const SusuPage = lazy(() => import('@/pages/SusuPage').then(m => ({ default: m.SusuPage })));
const CollectorPage = lazy(() => import('@/pages/CollectorPage').then(m => ({ default: m.CollectorPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const JoinByLinkPage = lazy(() => import('@/pages/JoinByLinkPage').then(m => ({ default: m.JoinByLinkPage })));
const MonthlyReportPrint = lazy(() => import('@/pages/print/MonthlyReportPrint').then(m => ({ default: m.MonthlyReportPrint })));
const TransactionsPrint = lazy(() => import('@/pages/print/TransactionsPrint').then(m => ({ default: m.TransactionsPrint })));
const VerifyCertificatePage = lazy(() => import('@/pages/VerifyCertificatePage').then(m => ({ default: m.VerifyCertificatePage })));

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
    <ErrorBoundary>
    <LanguageProvider>
      <AuthProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-ghana-dark">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      }>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join" element={<JoinByLinkPage />} />
        <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />

        {/* Onboarding (protected, no shell) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Print routes (protected, no shell) */}
        <Route
          path="/print/report"
          element={
            <ProtectedRoute>
              <MonthlyReportPrint />
            </ProtectedRoute>
          }
        />
        <Route
          path="/print/transactions"
          element={
            <ProtectedRoute>
              <TransactionsPrint />
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
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/transactions" element={<TransactionFeedPage />} />
          <Route path="/transactions/import" element={<ImportPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/ai-chat" element={<ErrorBoundary><AIChatPage /></ErrorBoundary>} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/splits" element={<SplitsPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/susu" element={<ErrorBoundary><SusuPage /></ErrorBoundary>} />
          <Route path="/collector" element={<CollectorPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </AuthProvider>
    </LanguageProvider>
    </ErrorBoundary>
  );
}
