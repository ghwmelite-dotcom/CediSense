import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@cedisense/shared';
import { api } from '@/lib/api';
import { NotificationItem } from '@/components/shared/NotificationItem';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'susu_contribution', label: 'Contributions' },
  { key: 'susu_payout', label: 'Payouts' },
  { key: 'susu_vote', label: 'Votes' },
  { key: 'susu_member', label: 'Members' },
  { key: 'susu_chat', label: 'Chat' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

interface NotificationsResponse {
  items: Notification[];
  cursor: string | null;
  has_more: boolean;
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(notifications: Notification[]): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();
  for (const n of notifications) {
    const label = formatDateGroup(n.created_at);
    const existing = groups.get(label);
    if (existing) {
      existing.push(n);
    } else {
      groups.set(label, [n]);
    }
  }
  return groups;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchNotifications = useCallback(async (cursorParam?: string | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ limit: '30' });
      if (cursorParam) params.set('cursor', cursorParam);
      if (filter === 'unread') params.set('unread_only', '1');
      const url = `/notifications?${params}`;

      const data = await api.get<NotificationsResponse>(url);
      setNotifications(prev => cursorParam ? [...prev, ...data.items] : data.items);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch {
      // silently fail — user can retry by scrolling
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [filter]);

  // Reset and fetch when filter changes
  useEffect(() => {
    setNotifications([]);
    setCursor(null);
    setHasMore(false);
    fetchNotifications(null);
  }, [fetchNotifications]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          fetchNotifications(cursor);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, cursor, fetchNotifications]);

  const handlePress = async (notification: Notification) => {
    if (notification.is_read === 0) {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, is_read: 1 as const } : n)),
      );
      try {
        await api.patch(`/notifications/${notification.id}/read`);
      } catch {
        // revert on failure
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, is_read: 0 as const } : n)),
        );
      }
    }
    navigate(notification.group_id ? `/susu?group=${notification.group_id}` : '/susu');
  };

  const handleMarkAllRead = async () => {
    const previousNotifications = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 as const })));
    try {
      await api.patch('/notifications/read-all');
    } catch {
      setNotifications(previousNotifications);
    }
  };

  // Apply client-side type filter
  const filtered =
    filter === 'all' || filter === 'unread'
      ? notifications
      : notifications.filter(n => n.type.startsWith(filter));

  const grouped = groupByDate(filtered);
  const hasUnread = notifications.some(n => n.is_read === 0);

  return (
    <div className="pb-24 px-4 md:px-6 motion-safe:animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
          <h1 className="text-text-primary text-xl font-bold font-display tracking-tight">
            Notifications
          </h1>
        </div>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-info hover:text-info/80 transition-colors font-medium min-h-[44px] flex items-center"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2.5 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-gold/20 text-gold'
                : 'bg-white/[0.04] text-muted hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="premium-card rounded-2xl overflow-hidden">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-white/10" />
                  <div className="h-2 w-48 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <svg className="w-8 h-8 mb-3 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-sm">
              {filter !== 'all' && filter !== 'unread' && notifications.length > 0
                ? 'No matching notifications for this filter'
                : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {Array.from(grouped.entries()).map(([label, items]) => (
              <div key={label}>
                <div className="px-4 py-2 bg-white/[0.02]">
                  <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    {label}
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {items.map(n => (
                    <NotificationItem key={n.id} notification={n} onPress={handlePress} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Loading more indicator */}
        {isLoading && notifications.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
