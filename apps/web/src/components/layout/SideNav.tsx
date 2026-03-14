import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '📋' },
  { to: '/budgets', label: 'Budgets', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-52 lg:w-56 bg-ghana-surface border-r border-white/5 min-h-screen flex-shrink-0 relative">
      {/* Gold accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-gold/60 via-gold/30 to-transparent rounded-tr-full" />

      {/* Subtle inner left glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(212,168,67,0.03) 0%, transparent 30%)',
        }}
        aria-hidden="true"
      />

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 relative">
        <span className="text-gold font-extrabold text-2xl leading-none drop-shadow-sm">₵</span>
        <span className="text-white font-semibold text-lg tracking-tight">CediSense</span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/5 mb-2" />

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-2 mt-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative overflow-hidden ${
                isActive
                  ? 'bg-ghana-green/15 text-white shadow-green-glow'
                  : 'text-muted hover:text-white hover:bg-white/[0.06]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active left accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-ghana-green rounded-r-full" />
                )}
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom version badge */}
      <div className="px-5 py-4">
        <p className="text-[11px] text-muted/50 tracking-wide">v0.1.0-beta</p>
      </div>
    </aside>
  );
}
