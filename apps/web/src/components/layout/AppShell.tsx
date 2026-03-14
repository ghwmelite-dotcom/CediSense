import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';

export function AppShell() {
  const { isOnline, syncCount, isSyncing, triggerSync } = useOnlineStatus();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-ghana-dark">
      {/* Subtle ambient gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,107,63,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(212,168,67,0.04) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <SideNav />

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <TopBar />

        {!isOnline && <OfflineBanner syncCount={syncCount} />}
        {(syncCount > 0 || isSyncing) && (
          <SyncIndicator syncCount={syncCount} isSyncing={isSyncing} onSync={triggerSync} />
        )}

        <main
          key={location.pathname}
          className="flex-1 pb-20 md:pb-0 overflow-y-auto animate-fade-in"
        >
          <div className="max-w-screen-xl mx-auto">
            <Outlet />
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
