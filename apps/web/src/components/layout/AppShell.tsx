import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSusuUnread } from '@/hooks/useSusuUnread';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';
import { InstallBanner } from './InstallBanner';
import { UpdateBanner } from './UpdateBanner';
import { KenteStripe } from '@/components/shared/KenteStripe';

export function AppShell() {
  const { isOnline, syncCount, isSyncing, triggerSync } = useOnlineStatus();
  const susuUnreadCount = useSusuUnread();
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-ghana-dark">
      {/* Kente stripe — cultural DNA marker at the very top */}
      <KenteStripe className="sticky top-0 z-50" />

      <div className="flex flex-1">
        {/* Ambient glow gradients — orange top-left, teal bottom-right */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(255,107,53,0.05) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 75% 80%, rgba(0,200,150,0.03) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />

        <SideNav susuUnreadCount={susuUnreadCount} />

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

          <BottomNav susuUnreadCount={susuUnreadCount} />
        </div>

        {/* Sync indicator — floating pill in the corner */}
        {(syncCount > 0 || isSyncing) && (
          <SyncIndicator syncCount={syncCount} isSyncing={isSyncing} onSync={triggerSync} />
        )}

        <InstallBanner />
        <UpdateBanner />
      </div>
    </div>
  );
}
