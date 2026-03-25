import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { NotificationBell } from '../shared/NotificationBell';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/goals': 'Goals',
  '/susu': 'Susu Groups',
  '/collector': 'Collector',
  '/investments': 'Investments',
  '/recurring': 'Bills & Recurring',
  '/splits': 'Shared Expenses',
  '/insights': 'Insights',
  '/ai-chat': 'AI Chat',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/add': 'Add Transaction',
  '/transactions/import': 'Import Transactions',
};

export function TopBar() {
  const { user } = useAuth();
  const location = useLocation();

  const initials =
    user?.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '';

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';

  return (
    <header
      className="sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between border-b border-white/5"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(13, 13, 26, 0.88)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Mobile: Logo | Desktop: Page title */}
      <div className="flex items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:pt-3">
        {/* Mobile logo — hidden on desktop */}
        <div className="flex items-center gap-2 md:hidden">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-lg leading-none"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
              boxShadow: '0 2px 8px rgba(255,107,53,0.3)',
            }}
          >
            ₵
          </div>
          <span className="text-white font-display font-bold text-base tracking-tight">CediSense</span>
        </div>

        {/* Desktop page title — hidden on mobile */}
        {pageTitle && (
          <h1 className="hidden md:block text-white/90 text-sm font-medium tracking-tight">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Right side: bell + avatar */}
      <div className="flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:pt-3">
        <NotificationBell />

        {/* Avatar */}
        <button
          type="button"
          aria-label="Open account menu"
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          style={{
            background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
            boxShadow: '0 0 0 2px rgba(255,107,53,0.2), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {initials}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-income border-2 border-ghana-dark" />
        </button>
      </div>
    </header>
  );
}
