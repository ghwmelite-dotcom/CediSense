import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

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

const COLLAPSE_KEY = 'cedisense-sidenav-collapsed';

interface NavItemProps {
  to: string;
  label: string;
  icon: string;
  collapsed: boolean;
  highlight?: boolean;
  badgeCount?: number;
  end?: boolean;
  onShowTip?: (label: string, badgeCount: number, top: number) => void;
  onHideTip?: () => void;
}

function SideNavItem({ to, label, icon, collapsed, highlight = false, badgeCount = 0, end = false, onShowTip, onHideTip }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onMouseEnter={collapsed && onShowTip ? (e) => onShowTip(label, badgeCount, e.currentTarget.getBoundingClientRect().top) : undefined}
      onMouseLeave={collapsed && onHideTip ? onHideTip : undefined}
      className={({ isActive }) =>
        `group flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative ${
          collapsed ? 'justify-center px-0 py-3 mx-1' : 'gap-3 px-3 py-2.5'
        } ${
          isActive
            ? 'bg-flame/[0.06] text-text-primary'
            : highlight
              ? 'text-gold/80 hover:text-gold hover:bg-gold/[0.04]'
              : 'text-muted hover:text-text-primary hover:bg-flame/[0.04]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className={`absolute bg-gold rounded-r-full ${
                collapsed
                  ? 'left-0 top-1/2 -translate-y-1/2 w-[3px] h-6'
                  : 'left-0 top-1/2 -translate-y-1/2 w-[2px] h-5'
              }`}
            />
          )}
          <span className="text-base leading-none relative shrink-0">
            {icon}
            {badgeCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </span>

          {/* Label: fades + slides away as the rail collapses */}
          <span
            className={`whitespace-nowrap transition-all duration-200 ${
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            {label}
          </span>
          {highlight && !isActive && badgeCount === 0 && !collapsed && (
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-gold/10 text-gold px-1.5 py-0.5 rounded-md">
              New
            </span>
          )}
          {badgeCount > 0 && !collapsed && (
            <span className="ml-auto min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function SideNav({ susuUnreadCount = 0 }: SideNavProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Floating tooltip state (fixed-position so it escapes the nav's scroll clipping)
  const [tip, setTip] = useState<{ label: string; badgeCount: number; top: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // storage unavailable — state still works for the session
    }
    if (!collapsed) setTip(null);
  }, [collapsed]);

  const tipHandlers = {
    onShowTip: (label: string, badgeCount: number, top: number) => setTip({ label, badgeCount, top }),
    onHideTip: () => setTip(null),
  };

  return (
    <aside
      className={`hidden md:flex flex-col min-h-screen flex-shrink-0 relative z-20 transition-[width] duration-300 ease-out ${
        collapsed ? 'w-[68px]' : 'w-56 lg:w-60'
      }`}
      style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Logo area */}
      <div className={`flex items-center py-6 transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'px-6'}`}>
        <div className="flex items-center gap-3">
          <span className="text-gold font-extrabold text-2xl leading-none">₵</span>
          <span
            className={`text-text-primary font-semibold text-lg tracking-[-0.02em] whitespace-nowrap transition-all duration-200 ${
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            CediSense
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className={`flex flex-col gap-1 mt-2 flex-1 overflow-y-auto overflow-x-visible transition-all duration-300 ${collapsed ? 'px-1' : 'px-3'}`}>
        {!collapsed && <p className="section-label px-3 mb-2">Menu</p>}
        {collapsed && <div className="mx-3 mb-3 border-t" style={{ borderColor: 'var(--color-border)' }} />}

        {mainNav.map((item) => (
          <SideNavItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            highlight={item.highlight}
            badgeCount={'badge' in item && item.badge === 'susu' ? susuUnreadCount : 0}
            end={item.to === '/dashboard'}
            {...tipHandlers}
          />
        ))}

        {/* Secondary nav */}
        {!collapsed && (
          <div className="mt-6 mb-2">
            <p className="section-label px-3 mb-2">More</p>
          </div>
        )}
        {collapsed && <div className="mx-3 my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />}

        {secondaryNav.map((item) => (
          <SideNavItem key={item.to} to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} {...tipHandlers} />
        ))}

        {/* Bottom nav */}
        <div className="mt-auto pt-4">
          {bottomNav.map((item) => (
            <SideNavItem key={item.to} to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} {...tipHandlers} />
          ))}
        </div>
      </nav>

      {/* Floating label pill — fixed position, escapes the scroll container */}
      {collapsed && tip && (
        <div
          className="pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap animate-fade-in"
          style={{
            left: 80,
            top: tip.top + 6,
            background: '#1c1c2e',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <span className="text-text-primary">{tip.label}</span>
          {tip.badgeCount > 0 && (
            <span className="ml-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {tip.badgeCount > 99 ? '99+' : tip.badgeCount}
            </span>
          )}
        </div>
      )}

      {/* Version badge */}
      {!collapsed && (
        <div className="px-6 py-5">
          <p className="text-[11px] text-muted-dim/40 tracking-wide">v0.1.0-beta</p>
        </div>
      )}

      {/* Collapse toggle — straddles the rail edge */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3.5 top-[72px] w-7 h-7 rounded-full flex items-center justify-center z-30
          transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <svg
          className={`w-3.5 h-3.5 text-gold transition-transform duration-300 ${collapsed ? 'rotate-0' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </aside>
  );
}
