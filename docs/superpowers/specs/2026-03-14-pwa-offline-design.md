# PWA Offline Support — Design Spec

## Overview

Add read + write offline capability using IndexedDB for data caching and a sync queue for offline mutations. Users can browse dashboard data, transaction history, budgets, and goals offline. They can add transactions and contribute to goals offline — changes queue and sync on reconnect.

## Scope

**In scope:**
- IndexedDB cache for API responses (transactions, accounts, categories, budgets, goals, dashboard)
- Sync queue for offline mutations (add transaction, contribute to goal)
- API client wrapper with online/offline detection
- Service worker enhancement (stale-while-revalidate for API GETs)
- Offline UI indicators (banner, sync count, status)
- `useOnlineStatus` hook

**Out of scope:**
- Offline SMS parsing (requires device SMS access)
- Offline AI chat (requires Workers AI)
- Conflict resolution beyond last-write-wins
- Background sync API (limited browser support)

## Tech Stack

- **Storage:** IndexedDB via lightweight wrapper (no library — raw `idb` patterns)
- **Sync:** FIFO queue replayed on reconnect
- **Detection:** `navigator.onLine` + `online`/`offline` events
- **Service Worker:** Enhanced stale-while-revalidate

---

## IndexedDB Schema

Database name: `cedisense-offline`

**Object stores:**

| Store | Key | Purpose |
|-------|-----|---------|
| `apiCache` | `path` (string) | Cached GET responses keyed by API path |
| `syncQueue` | `id` (auto-increment) | Pending mutations to replay on reconnect |

`apiCache` entries:
```typescript
interface CachedResponse {
  path: string;       // e.g., "/dashboard?month=2026-03"
  data: unknown;      // the parsed JSON response data
  timestamp: number;  // Date.now() when cached
  ttl: number;        // max age in ms (e.g., 300000 for 5 min)
}
```

`syncQueue` entries:
```typescript
interface SyncQueueItem {
  id?: number;         // auto-increment
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;        // API path
  body?: unknown;      // request body
  timestamp: number;   // when queued
}
```

Simple two-store design — no mirroring of D1 tables into IndexedDB. The `apiCache` stores raw API responses and the `syncQueue` stores pending mutations.

---

## API Client Wrapper

Modify `apps/web/src/lib/api.ts` to add offline awareness:

**For GET requests:**
1. If online: fetch from API, cache response in IndexedDB, return data
2. If offline: return cached response from IndexedDB (if exists and not expired)
3. If offline + no cache: throw error "You're offline and this data isn't cached"

**For mutations (POST/PUT/DELETE):**
1. If online: send normally
2. If offline: add to `syncQueue` in IndexedDB, return optimistic success
3. Special handling: `POST /transactions` offline returns a temp ID

**Cache TTLs:**
- Dashboard: 5 minutes (300,000ms)
- Transactions list: 5 minutes
- Accounts: 30 minutes
- Categories: 60 minutes
- Budgets: 5 minutes
- Goals: 5 minutes
- Other: 5 minutes default

---

## Sync Manager

File: `apps/web/src/lib/sync-manager.ts`

**`processSyncQueue()`:**
1. Read all items from `syncQueue` ordered by ID (FIFO)
2. For each item: replay as API call via `fetch`
3. If success: remove from queue
4. If 4xx error: remove from queue (client error, won't succeed on retry)
5. If 5xx/network error: stop processing (server issue, retry later)
6. Return `{ processed: number, remaining: number, errors: string[] }`

**Auto-trigger:**
- Listen for `online` event on `window`
- When coming back online: call `processSyncQueue()`
- Show sync progress in UI

**`getSyncQueueCount()`:** Returns number of pending items (for badge/indicator).

---

## Service Worker Enhancement

Modify `apps/web/public/sw.js`:

**Current:** Network-first for assets, skip `/api/` entirely.

**Enhanced:**
- Assets: cache-first (CSS, JS, images) — these have hashed filenames from Vite
- API GET requests: stale-while-revalidate
  1. Serve from cache immediately (if available)
  2. Fetch from network in background
  3. Update cache with fresh response
  4. If network fails and cache exists: serve stale
  5. If network fails and no cache: return offline error response
- API mutations (POST/PUT/DELETE): pass through to network (sync queue handles offline in the app layer)

**Cacheable API paths:**
- `/api/v1/dashboard*`
- `/api/v1/transactions*`
- `/api/v1/accounts*`
- `/api/v1/categories*`
- `/api/v1/budgets*`
- `/api/v1/goals*`
- `/api/v1/recurring*`
- `/api/v1/insights*`

**NOT cached:** `/api/v1/auth/*`, `/api/v1/ai/*`, `/api/v1/export/*`

---

## Frontend UI

### OfflineBanner

- Fixed bar at the top of the app (below TopBar)
- Shown when `navigator.onLine === false`
- "You're offline — changes will sync when connected" — bg-gold/10 text-gold
- Dismissible per session, auto-shows on state change

### SyncIndicator

- Small pill in the TopBar or near the offline banner
- Shows when sync queue has items: "2 pending" — text-xs text-muted
- When syncing: spinning icon + "Syncing..."
- On complete: brief "All synced" success, then hides

### useOnlineStatus Hook

```typescript
export function useOnlineStatus(): {
  isOnline: boolean;
  syncCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}
```

- Tracks `navigator.onLine` + event listeners
- Polls `syncQueue` count periodically (every 5s)
- Exposes sync trigger for manual retry

### Integration Points

- `AppShell.tsx`: render `OfflineBanner` and `SyncIndicator`
- `api.ts`: check online status before requests
- All pages: no changes needed — offline is transparent via the API wrapper

---

## Types (additions to packages/shared)

None — offline types are frontend-only, defined in the offline modules.

---

## File Structure

### New Files
- `apps/web/src/lib/offline-db.ts` — IndexedDB wrapper (open, get, set, delete, getAll)
- `apps/web/src/lib/sync-manager.ts` — Queue processing + auto-sync
- `apps/web/src/hooks/useOnlineStatus.ts` — Online/offline + sync state
- `apps/web/src/components/layout/OfflineBanner.tsx` — Offline indicator
- `apps/web/src/components/layout/SyncIndicator.tsx` — Pending sync count

### Modified Files
- `apps/web/src/lib/api.ts` — Add offline-aware request wrapper
- `apps/web/public/sw.js` — Enhanced caching strategy
- `apps/web/src/components/layout/AppShell.tsx` — Render offline UI components
