import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import {
  Home, Receipt, Bot, Users, Wallet, Target, TrendingUp,
  Repeat, Split, Sparkles, Settings, Plus, Menu, type LucideIcon,
} from 'lucide-react';

interface BottomNavProps {
  susuUnreadCount?: number;
}

const primaryItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/transactions', label: 'Txns', icon: Receipt },
  { to: '/ai-chat', label: 'AI', icon: Bot },
];

const moreItems: { to: string; label: string; icon: LucideIcon; highlight?: boolean; badge?: 'susu' }[] = [
  { to: '/susu', label: 'Susu Groups', icon: Users, highlight: true, badge: 'susu' },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/recurring', label: 'Bills & Recurring', icon: Repeat },
  { to: '/splits', label: 'Shared Expenses', icon: Split },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav({ susuUnreadCount = 0 }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const handleMoreNav = useCallback((path: string) => {
    navigate(path);
    setMoreOpen(false);
  }, [navigate]);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-[72px] left-3 right-3 rounded-2xl shadow-card-hover p-3 motion-safe:animate-slide-up"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1">
              {moreItems.map((item) => {
                const badgeCount = 'badge' in item && item.badge === 'susu' ? susuUnreadCount : 0;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => handleMoreNav(item.to)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors duration-150 relative ${
                      item.highlight
                        ? 'bg-flame/[0.06] hover:bg-flame/[0.1]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="relative inline-flex">
                      <item.icon className="w-[22px] h-[22px]" strokeWidth={2} aria-hidden="true" />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-medium leading-tight text-center ${
                      item.highlight ? 'text-flame' : 'text-muted'
                    }`}>
                      {item.label}
                    </span>
                    {item.highlight && badgeCount === 0 && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-flame/10 text-flame px-1 py-px rounded">New</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-end md:hidden z-50"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'var(--color-overlay)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors duration-150 min-w-[44px] min-h-[44px] justify-center ${
                isActive ? 'text-flame' : 'text-muted hover:text-text-primary/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-[22px] h-[22px]" strokeWidth={2} aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-flame" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Add button */}
        <NavLink
          to="/add"
          aria-label="Add transaction"
          className="flex flex-col items-center -mt-5 group"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-200 group-hover:scale-105 group-active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
              boxShadow: '0 4px 16px rgba(255, 107, 53, 0.35)',
            }}
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <span className="text-[10px] text-muted mt-1">Add</span>
        </NavLink>

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors duration-150 min-w-[44px] min-h-[44px] justify-center ${
            moreOpen ? 'text-flame' : 'text-muted hover:text-text-primary/70'
          }`}
        >
          <span className="relative inline-flex leading-none">
            <Menu className="w-[22px] h-[22px]" strokeWidth={2} aria-hidden="true" />
            {susuUnreadCount > 0 && !moreOpen && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--color-bg)' }} />
            )}
          </span>
          <span className="text-[10px] font-medium leading-none">More</span>
          {moreOpen && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-flame" />
          )}
        </button>
      </nav>
    </>
  );
}
