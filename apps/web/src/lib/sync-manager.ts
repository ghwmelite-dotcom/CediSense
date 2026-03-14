import { getAllSyncQueue, removeSyncQueueItem } from './offline-db';
import { getAccessToken } from './api';

const API_BASE = '/api/v1';

export interface SyncResult {
  processed: number;
  remaining: number;
  errors: string[];
}

/**
 * Process the sync queue in FIFO order.
 * Replays each pending mutation as an API call.
 * On success or 4xx: remove from queue.
 * On 5xx/network error: stop processing.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const items = await getAllSyncQueue();
  let processed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}${item.path}`, {
        method: item.method,
        headers,
        credentials: 'include',
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        // Success or client error (won't succeed on retry) — remove from queue
        await removeSyncQueueItem(item.id!);
        processed++;

        if (!response.ok) {
          errors.push(`${item.method} ${item.path}: ${response.status}`);
        }
      } else {
        // Server error — stop processing, retry later
        errors.push(`${item.method} ${item.path}: ${response.status} (will retry)`);
        break;
      }
    } catch (err) {
      // Network error — stop processing
      errors.push(`${item.method} ${item.path}: network error`);
      break;
    }
  }

  const remaining = items.length - processed;
  return { processed, remaining, errors };
}

/**
 * Set up auto-sync on reconnect.
 * Returns a cleanup function to remove the listener.
 */
export function setupAutoSync(onSyncComplete?: (result: SyncResult) => void): () => void {
  const handler = async () => {
    const result = await processSyncQueue();
    onSyncComplete?.(result);
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
