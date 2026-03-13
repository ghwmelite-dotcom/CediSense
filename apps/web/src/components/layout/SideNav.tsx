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
    <aside className="hidden md:flex flex-col w-52 lg:w-56 bg-ghana-surface border-r border-ghana-surface/50 min-h-screen flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-gold font-extrabold text-2xl">₵</span>
        <span className="text-white font-semibold text-lg">CediSense</span>
      </div>
      <nav className="flex flex-col gap-0.5 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-ghana-green/15 border-l-[3px] border-ghana-green text-white'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
