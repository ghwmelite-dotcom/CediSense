import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const primaryItems = [
  { to: '/dashboard', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Txns', icon: '📋' },
  { to: '/ai-chat', label: 'AI', icon: '💬' },
];

const moreItems = [
  { to: '/susu', label: 'Susu Groups', icon: '🤝', highlight: true },
  { to: '/budgets', label: 'Budgets', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/investments', label: 'Investments', icon: '📈' },
  { to: '/recurring', label: 'Bills & Recurring', icon: '🔄' },
  { to: '/splits', label: 'Shared Expenses', icon: '💸' },
  { to: '/insights', label: 'Insights', icon: '✨' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-[72px] left-3 right-3 bg-ghana-surface rounded-2xl shadow-card-hover p-3 motion-safe:animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1">
              {moreItems.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => { navigate(item.to); setMoreOpen(false); }}
                  className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors duration-150 ${
                    item.highlight
                      ? 'bg-gold/[0.06] hover:bg-gold/[0.1]'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`text-[10px] font-medium leading-tight text-center ${
                    item.highlight ? 'text-gold' : 'text-muted'
                  }`}>
                    {item.label}
                  </span>
                  {item.highlight && (
                    <span className="text-[8px] font-bold uppercase tracking-wider bg-gold/10 text-gold px-1 py-px rounded">New</span>
                  )}
                </button>
              ))}
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
          background: 'rgba(12, 12, 20, 0.92)',
        }}
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors duration-150 min-w-[44px] min-h-[44px] justify-center ${
                isActive ? 'text-gold' : 'text-muted hover:text-text-primary/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
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
            className="w-12 h-12 rounded-full flex items-center justify-center text-ghana-dark text-2xl font-bold transition-all duration-200 group-hover:scale-105 group-active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #E8C873 0%, #D4A843 50%, #C49A3C 100%)',
              boxShadow: '0 4px 16px rgba(212, 168, 67, 0.35)',
            }}
          >
            +
          </div>
          <span className="text-[10px] text-muted mt-1">Add</span>
        </NavLink>

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors duration-150 min-w-[44px] min-h-[44px] justify-center ${
            moreOpen ? 'text-gold' : 'text-muted hover:text-text-primary/70'
          }`}
        >
          <span className="text-xl leading-none">☰</span>
          <span className="text-[10px] font-medium leading-none">More</span>
          {moreOpen && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
          )}
        </button>
      </nav>
    </>
  );
}
