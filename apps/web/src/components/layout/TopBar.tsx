import { useAuth } from '@/contexts/AuthContext';

export function TopBar() {
  const { user } = useAuth();

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '';

  return (
    <header className="bg-ghana-surface border-b border-ghana-surface/50 px-4 py-3 flex items-center justify-between md:hidden">
      <div className="flex items-center gap-2">
        <span className="text-gold font-extrabold text-xl">₵</span>
        <span className="text-white font-semibold text-base">CediSense</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-ghana-green flex items-center justify-center text-white text-xs font-semibold">
        {initials}
      </div>
    </header>
  );
}
