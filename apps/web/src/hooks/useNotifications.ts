import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { Notification } from '@cedisense/shared';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  toggle: () => void;
  close: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const mountedRef = useRef(true);

  // Poll unread count every 30s
  useEffect(() => {
    mountedRef.current = true;

    const fetchCount = () => {
      api
        .get<{ count: number }>('/notifications/unread-count')
        .then((data) => {
          if (mountedRef.current) setUnreadCount(data.count);
        })
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    api
      .get<{ items: Notification[]; cursor: string | null; has_more: boolean }>(
        '/notifications?limit=20'
      )
      .then((res) => {
        if (mountedRef.current) {
          setNotifications(res.items);
          setCursor(res.cursor);
          setHasMore(res.has_more);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [isOpen]);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  const markRead = useCallback((id: string) => {
    api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: 1 as const } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    api.patch('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 as const })));
    setUnreadCount(0);
  }, []);

  const loadMore = useCallback(() => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    api
      .get<{ items: Notification[]; cursor: string | null; has_more: boolean }>(
        `/notifications?limit=20&cursor=${encodeURIComponent(cursor)}`
      )
      .then((res) => {
        if (mountedRef.current) {
          setNotifications(prev => [...prev, ...res.items]);
          setCursor(res.cursor);
          setHasMore(res.has_more);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [cursor, isLoading]);

  return {
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
  };
}
