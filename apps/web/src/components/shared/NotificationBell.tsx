import { useNotifications } from '../../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isOpen,
    isLoading,
    toggle,
    close,
    markRead,
    markAllRead,
    loadMore,
    hasMore,
  } = useNotifications();

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        {/* Bell SVG */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-expense text-white text-[10px] font-bold flex items-center justify-center motion-safe:animate-pulseSoft">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Full-screen overlay — escapes all stacking contexts */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999]" onClick={close}>
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel — centered on mobile, top-right on desktop */}
          <div
            className="absolute md:top-16 md:right-4 inset-x-4 top-4 bottom-auto md:inset-x-auto md:w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <NotificationPanel
              notifications={notifications}
              isLoading={isLoading}
              hasMore={hasMore}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onLoadMore={loadMore}
              onClose={close}
            />
          </div>
        </div>
      )}
    </>
  );
}
