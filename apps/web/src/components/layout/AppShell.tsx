import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';
import { InstallBanner } from './InstallBanner';
import { UpdateBanner } from './UpdateBanner';

export function AppShell() {
  const { isOnline, syncCount, isSyncing, triggerSync } = useOnlineStatus();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-ghana-dark">
      {/* Subtle ambient gradient overlay for visual depth */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,168,67,0.03) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34,197,94,0.02) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <SideNav />

      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <TopBar />

        {!isOnline && <OfflineBanner syncCount={syncCount} />}

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

      {/* Sync indicator — now a floating pill in the corner */}
      {(syncCount > 0 || isSyncing) && (
        <SyncIndicator syncCount={syncCount} isSyncing={isSyncing} onSync={triggerSync} />
      )}

      <InstallBanner />
      <UpdateBanner />
    </div>
  );
}
