import { NavLink } from 'react-router-dom';
import { NotificationBell } from '../shared/NotificationBell';

interface SideNavProps {
  susuUnreadCount?: number;
}

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '📋' },
  { to: '/budgets', label: 'Budgets', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/susu', label: 'Susu Groups', icon: '🤝', highlight: true, badge: 'susu' as const },
  { to: '/collector', label: 'Collector', icon: '🏪', highlight: true },
  { to: '/investments', label: 'Investments', icon: '📈' },
];

const secondaryNav = [
  { to: '/recurring', label: 'Bills & Recurring', icon: '🔄' },
  { to: '/splits', label: 'Shared Expenses', icon: '💸' },
  { to: '/insights', label: 'Insights', icon: '✨' },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
];

const bottomNav = [
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function SideNav({ susuUnreadCount = 0 }: SideNavProps) {
  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-60 bg-[#0E0E1A] min-h-screen flex-shrink-0 relative z-20">
      {/* Logo area — brand-confident */}
      <div className="flex items-center justify-between px-6 py-6 relative overflow-visible">
        <div className="flex items-center gap-3">
          <span className="text-gold font-extrabold text-2xl leading-none">₵</span>
          <span className="text-text-primary font-semibold text-lg tracking-[-0.02em]">CediSense</span>
        </div>
        <NotificationBell />
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-1 px-3 mt-2 flex-1 overflow-y-auto">
        <p className="section-label px-3 mb-2">Menu</p>
        {mainNav.map((item) => {
          const badgeCount = 'badge' in item && item.badge === 'susu' ? susuUnreadCount : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? 'bg-white/[0.04] text-text-primary'
                    : item.highlight
                      ? 'text-gold/80 hover:text-gold hover:bg-gold/[0.04]'
                      : 'text-muted hover:text-text-primary hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-gold rounded-r-full" />
                  )}
                  <span className="text-base leading-none relative">
                    {item.icon}
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </span>
                  <span>{item.label}</span>
                  {item.highlight && !isActive && badgeCount === 0 && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-gold/10 text-gold px-1.5 py-0.5 rounded-md">New</span>
                  )}
                  {badgeCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Secondary nav */}
        <div className="mt-6 mb-2">
          <p className="section-label px-3 mb-2">More</p>
        </div>
        {secondaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                isActive
                  ? 'bg-white/[0.04] text-text-primary'
                  : 'text-muted hover:text-text-primary hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-gold rounded-r-full" />
                )}
                <span className="text-sm leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Bottom nav */}
        <div className="mt-auto pt-4">
          {bottomNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? 'bg-white/[0.04] text-text-primary'
                    : 'text-muted hover:text-text-primary hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-gold rounded-r-full" />
                  )}
                  <span className="text-sm leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Version badge */}
      <div className="px-6 py-5">
        <p className="text-[11px] text-muted-dim/40 tracking-wide">v0.1.0-beta</p>
      </div>
    </aside>
  );
}
