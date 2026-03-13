import { useAuth } from '@/contexts/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="p-4 md:p-6">
      <p className="text-muted text-sm">{greeting}, {user?.name.split(' ')[0]}</p>
      <h1 className="text-white text-2xl md:text-3xl font-bold mt-1">₵0.00</h1>
      <p className="text-muted text-xs">Total balance</p>

      <div className="mt-8 bg-ghana-surface rounded-xl p-6 text-center">
        <p className="text-muted">Dashboard charts coming in Subsystem 3</p>
      </div>
    </div>
  );
}
