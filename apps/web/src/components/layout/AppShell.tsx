import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSusuUnread } from '@/hooks/useSusuUnread';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { OfflineBanner } from './OfflineBanner';
import { SyncIndicator } from './SyncIndicator';
import { InstallBanner } from './InstallBanner';
import { UpdateBanner } from './UpdateBanner';
import { PushOptIn } from '../shared/PushOptIn';
import { KenteStripe } from '@/components/shared/KenteStripe';

export function AppShell() {
  const { isOnline, syncCount, isSyncing, triggerSync } = useOnlineStatus();
  const susuUnreadCount = useSusuUnread();
  const location = useLocation();
  const { syncSubscription } = usePushSubscription();

  // Silent push-subscription sync on every app boot (idempotent server-side)
  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Kente stripe — cultural DNA marker at the very top */}
      <KenteStripe className="sticky top-0 z-50" />

      <div className="flex flex-1">
        {/* Ambient glow gradients — orange top-left, teal bottom-right */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background:
              'var(--gradient-glow-orange), var(--gradient-glow-teal)',
          }}
          aria-hidden="true"
        />

        <SideNav susuUnreadCount={susuUnreadCount} />

        <div className="flex-1 flex flex-col relative z-10 min-w-0">
          <TopBar />

          <PushOptIn />

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
