import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials =
    user?.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '';

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  }

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

      {/* Right side: bell + avatar menu */}
      <div className="flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:pt-3">
        <NotificationBell />

        {/* Avatar + Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open account menu"
            aria-expanded={menuOpen}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
              boxShadow: menuOpen
                ? '0 0 0 3px rgba(255,107,53,0.3), 0 0 0 1px rgba(255,255,255,0.12)'
                : '0 0 0 2px rgba(255,107,53,0.2), 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {initials}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-income border-2 border-ghana-dark" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute top-full right-0 mt-2 w-[220px] rounded-2xl border border-white/5 overflow-hidden motion-safe:animate-fadeIn z-50"
              style={{
                background: 'rgba(20, 20, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-muted text-xs truncate mt-0.5">{user?.phone ?? user?.email}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors min-h-[44px]"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); navigate('/notifications'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors min-h-[44px]"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  Notifications
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); navigate('/ai-chat'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors min-h-[44px]"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  AI Chat
                </button>
              </div>

              {/* Divider + Logout */}
              <div className="border-t border-white/5 py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-expense/80 hover:bg-expense/5 hover:text-expense transition-colors min-h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
