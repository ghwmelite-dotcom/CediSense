import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';

export function AppShell() {
  const { isOnline, syncCount, isSyncing, triggerSync } = useOnlineStatus();

  return (
    <div className="flex min-h-screen bg-ghana-dark">
      <SideNav />
      <div className="flex-1 flex flex-col">
        <TopBar />
        {!isOnline && <OfflineBanner syncCount={syncCount} />}
        {(syncCount > 0 || isSyncing) && (
          <SyncIndicator syncCount={syncCount} isSyncing={isSyncing} onSync={triggerSync} />
        )}
        <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
