import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Home', icon: '🏠', isAction: false },
  { to: '/transactions', label: 'Txns', icon: '📋', isAction: false },
  { to: '/add', label: 'Add', icon: '+', isAction: true },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬', isAction: false },
  { to: '/settings', label: 'More', icon: '⚙️', isAction: false },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-end md:hidden z-50 border-t border-white/[0.07]"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(26, 26, 46, 0.88)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.04), 0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {navItems.map((item) =>
        item.isAction ? (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label="Add transaction"
            className="flex flex-col items-center -mt-5 group"
          >
            <div
              className="w-12 h-12 rounded-full bg-gold flex items-center justify-center text-ghana-black text-2xl font-bold transition-all duration-200 group-hover:scale-110 group-active:scale-95"
              style={{
                boxShadow:
                  '0 4px 16px rgba(212, 168, 67, 0.45), 0 0 0 3px rgba(212,168,67,0.12)',
              }}
            >
              {item.icon}
            </div>
            <span className="text-[10px] text-muted mt-1">{item.label}</span>
          </NavLink>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 relative transition-colors duration-150 min-w-[44px] min-h-[44px] justify-center ${
                isActive ? 'text-gold' : 'text-muted hover:text-white/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                )}
              </>
            )}
          </NavLink>
        ),
      )}
    </nav>
  );
}
