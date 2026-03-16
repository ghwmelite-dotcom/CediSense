import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Polls the total unread Susu message count across all groups every 30 seconds.
 */
export function useSusuUnread(): number {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchUnread = () => {
      api
        .get<{ total: number }>('/susu/unread-total')
        .then((data) => {
          if (mountedRef.current) {
            setCount(data.total);
          }
        })
        .catch(() => {
          // silent — don't break the app if this fails
        });
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}
