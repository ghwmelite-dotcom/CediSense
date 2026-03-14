import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '📋' },
  { to: '/budgets', label: 'Budgets', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-52 lg:w-56 bg-[#111120] min-h-screen flex-shrink-0 relative border-r border-[#1F1F35]/60">
      {/* Subtle ambient glow at top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(212,168,67,0.03) 0%, transparent 25%)',
        }}
        aria-hidden="true"
      />

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 relative">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg bg-gold/10 blur-lg scale-150" />
          <span className="relative text-gold font-extrabold text-2xl leading-none drop-shadow-sm">₵</span>
        </div>
        <span className="text-text-primary font-semibold text-lg tracking-tight">CediSense</span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[#1F1F35]/60 mb-2" />

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3 mt-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                isActive
                  ? 'bg-white/[0.03] text-text-primary'
                  : 'text-muted hover:text-text-primary hover:bg-white/[0.02]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active left accent bar — subtle gold, 2px */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-gradient-to-b from-gold-light to-gold rounded-r-full shadow-[0_0_8px_rgba(212,168,67,0.3)]" />
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
        <p className="text-[11px] text-muted-dim/50 tracking-wide">v0.1.0-beta</p>
      </div>
    </aside>
  );
}
