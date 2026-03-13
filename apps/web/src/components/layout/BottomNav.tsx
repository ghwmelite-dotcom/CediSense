import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Txns', icon: '📋' },
  { to: '/add', label: 'Add', icon: '+', isAction: true },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
  { to: '/settings', label: 'More', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-ghana-surface border-t border-ghana-surface/50 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-end md:hidden z-50">
      {navItems.map((item) =>
        item.isAction ? (
          <NavLink key={item.to} to={item.to} className="flex flex-col items-center -mt-4">
            <div className="w-11 h-11 rounded-full bg-gold flex items-center justify-center text-ghana-black text-xl font-bold shadow-lg shadow-gold/30">
              {item.icon}
            </div>
            <span className="text-[10px] text-muted mt-1">{item.label}</span>
          </NavLink>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center ${isActive ? 'text-gold' : 'text-muted'}`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}
