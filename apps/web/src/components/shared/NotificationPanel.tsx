import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@cedisense/shared';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { NotificationItem } from './NotificationItem';

interface NotificationPanelProps {
  notifications: Notification[];
  isLoading: boolean;
  hasMore: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
  onClose: () => void;
}

function getDeepLink(notification: Notification): string {
  if (notification.group_id) return `/susu?group=${notification.group_id}`;
  return '/susu';
}

function PushToggle() {
  const { isSupported, permission, subscribe, unsubscribe } = usePushSubscription();
  if (!isSupported) return null;

  if (permission === 'denied') {
    return <span className="text-[10px] text-white/30">Push blocked</span>;
  }

  const enabled = permission === 'granted';

  return (
    <button
      type="button"
      onClick={enabled ? unsubscribe : subscribe}
      className="text-white/50 hover:text-white/70 transition-colors"
      aria-label={enabled ? 'Disable push notifications' : 'Enable push notifications'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {enabled ? (
          <>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </>
        ) : (
          <>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
            <path d="M18 8a6 6 0 0 0-9.33-5" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        )}
      </svg>
    </button>
  );
}

export function NotificationPanel({
  notifications,
  isLoading,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
  onClose,
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handlePress = (notification: Notification) => {
    if (notification.is_read === 0) onMarkRead(notification.id);
    navigate(getDeepLink(notification));
    onClose();
  };

  const hasUnread = notifications.some(n => n.is_read === 0);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute top-full right-0 mt-2 w-[min(380px,calc(100vw-2rem))] max-h-[480px] rounded-2xl border border-white/5 overflow-hidden motion-safe:animate-fadeIn z-50"
      style={{
        background: 'rgba(20, 20, 42, 0.98)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">Notifications</h2>
        <div className="flex items-center gap-3">
          {hasUnread && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-info hover:text-info/80 transition-colors"
            >
              Mark all read
            </button>
          )}
          <PushToggle />
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[420px] divide-y divide-white/5">
        {isLoading && notifications.length === 0 ? (
          // Skeleton
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
                <div className="w-6 h-6 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-white/10" />
                  <div className="h-2 w-48 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <span className="text-3xl mb-2">🔔</span>
            <p className="text-sm">You're all caught up</p>
          </div>
        ) : (
          <>
            {notifications.map(n => (
              <NotificationItem key={n.id} notification={n} onPress={handlePress} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full py-3 text-xs text-info hover:text-info/80 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
