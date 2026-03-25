import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '../shared/NotificationBell';

export function TopBar() {
  const { user } = useAuth();

  const initials =
    user?.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '';

  return (
    <header
      className="md:hidden sticky top-0 z-40 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between border-b border-white/5"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(13, 13, 26, 0.88)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Logo — flame orange gradient icon with Clash Display brand */}
      <div className="flex items-center gap-2">
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

      {/* Right side: bell + avatar */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        {/* Avatar */}
        <button
          type="button"
          aria-label="Open account menu"
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-200 focus-visible:outline-none"
          style={{
            background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
            boxShadow: '0 0 0 2px rgba(255,107,53,0.2), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {initials}
          {/* Online indicator dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-income border-2 border-ghana-dark" />
        </button>
      </div>
    </header>
  );
}
