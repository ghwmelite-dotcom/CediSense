import { useAuth } from '@/contexts/AuthContext';

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
      className="md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b border-white/5"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: 'rgba(17, 17, 17, 0.82)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-gold font-extrabold text-xl leading-none">₵</span>
        <span className="text-white font-semibold text-base tracking-tight">CediSense</span>
      </div>

      {/* Avatar */}
      <button
        type="button"
        aria-label="Open account menu"
        className="relative w-9 h-9 rounded-full bg-ghana-green flex items-center justify-center text-white text-xs font-semibold ring-2 ring-ghana-green/30 hover:ring-gold/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-gold/60"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}
      >
        {initials}
        {/* Online indicator dot */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-income border-2 border-ghana-dark" />
      </button>
    </header>
  );
}
