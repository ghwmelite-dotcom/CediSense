import { useState, useEffect, useCallback } from 'react';
import { getSyncQueueCount } from '@/lib/offline-db';
import { processSyncQueue, type SyncResult } from '@/lib/sync-manager';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncCount, setSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll sync queue count
  useEffect(() => {
    const poll = () => {
      getSyncQueueCount().then(setSyncCount).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync on reconnect
  useEffect(() => {
    if (isOnline && syncCount > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOnline]);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await processSyncQueue();
      const count = await getSyncQueueCount();
      setSyncCount(count);
    } catch {
      // Silent
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return { isOnline, syncCount, isSyncing, triggerSync };
}
