# PWA Offline Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read + write offline capability via IndexedDB caching and sync queue.

**Architecture:** IndexedDB `apiCache` store for GET responses, `syncQueue` store for offline mutations. API client wrapper detects online/offline and routes accordingly. Service worker provides stale-while-revalidate for API GETs. Sync manager replays queue on reconnect.

**Tech Stack:** IndexedDB, Service Worker, React 18, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-pwa-offline-design.md`

---

## Task 1: IndexedDB wrapper

**Create: `apps/web/src/lib/offline-db.ts`**

Lightweight IndexedDB wrapper with typed operations:
- `openDB()` — opens `cedisense-offline` database, creates `apiCache` and `syncQueue` stores
- `getCachedResponse(path)` — get from apiCache, check TTL, return null if expired
- `setCachedResponse(path, data, ttl)` — upsert into apiCache
- `addToSyncQueue(item)` — add mutation to syncQueue
- `getAllSyncQueue()` — get all pending items ordered by id
- `removeSyncQueueItem(id)` — delete processed item
- `getSyncQueueCount()` — count pending items
- `clearExpiredCache()` — remove stale entries

Use raw IndexedDB API (no library). Wrap in Promises for async/await usage.

```bash
git add apps/web/src/lib/offline-db.ts
git commit -m "feat: add IndexedDB wrapper for offline caching and sync queue"
```

---

## Task 2: Sync manager

**Create: `apps/web/src/lib/sync-manager.ts`**

- `processSyncQueue()` — FIFO replay: read all queue items, for each call fetch with stored method/path/body. On success or 4xx: remove item. On 5xx/network error: stop. Return `{ processed, remaining, errors }`.
- `setupAutoSync()` — listen for `window.addEventListener('online', ...)`, call `processSyncQueue` on reconnect. Returns cleanup function.

Import `getAccessToken` from `./api` for auth headers on replayed requests.

```bash
git add apps/web/src/lib/sync-manager.ts
git commit -m "feat: add sync manager for offline mutation queue"
```

---

## Task 3: Modify API client for offline awareness

**Modify: `apps/web/src/lib/api.ts`**

Wrap the existing `request` function:
- Before fetch: check `navigator.onLine`
- GET + online: fetch normally, then cache response in IndexedDB (`setCachedResponse`)
- GET + offline: return from `getCachedResponse`, throw if no cache
- Mutation + online: fetch normally
- Mutation + offline: add to sync queue (`addToSyncQueue`), return undefined as T (optimistic)

Add cache TTL config:
```typescript
const CACHE_TTLS: Record<string, number> = {
  '/dashboard': 300000,
  '/transactions': 300000,
  '/accounts': 1800000,
  '/categories': 3600000,
  '/budgets': 300000,
  '/goals': 300000,
  '/recurring': 300000,
  '/insights': 300000,
};
```

Match by path prefix to determine TTL.

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add offline-aware API client with IndexedDB caching"
```

---

## Task 4: useOnlineStatus hook + UI components

**Create: `apps/web/src/hooks/useOnlineStatus.ts`**

Hook tracking online state + sync queue count:
```typescript
export function useOnlineStatus(): {
  isOnline: boolean;
  syncCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}
```
- `useState` for `isOnline` (init from `navigator.onLine`)
- `useEffect` with `online`/`offline` event listeners
- Poll `getSyncQueueCount()` every 5 seconds
- `triggerSync` calls `processSyncQueue` and updates counts

**Create: `apps/web/src/components/layout/OfflineBanner.tsx`**

- Shown when `!isOnline`
- bg-gold/10 border-gold/20, "You're offline — changes will sync when connected"
- Dismissible with X button (session state)

**Create: `apps/web/src/components/layout/SyncIndicator.tsx`**

- Shown when `syncCount > 0`
- "N pending" pill or "Syncing..." with spinner
- Compact, fits in TopBar area

```bash
git add apps/web/src/hooks/useOnlineStatus.ts apps/web/src/components/layout/OfflineBanner.tsx apps/web/src/components/layout/SyncIndicator.tsx
git commit -m "feat: add useOnlineStatus hook, OfflineBanner, SyncIndicator"
```

---

## Task 5: Integrate into AppShell + enhance service worker

**Modify: `apps/web/src/components/layout/AppShell.tsx`**

- Import and render `OfflineBanner` and `SyncIndicator` above the Outlet
- Use `useOnlineStatus` hook for state
- Auto-trigger sync on reconnect

**Modify: `apps/web/public/sw.js`**

Enhanced service worker:
- Assets (non-API): cache-first strategy (hashed filenames from Vite)
- API GET requests matching cacheable paths: stale-while-revalidate
  - Serve from cache immediately, fetch in background, update cache
  - If network fails: serve stale cache or return offline JSON error
- API mutations: pass through (handled by app-layer sync queue)
- Skip: `/api/v1/auth/*`, `/api/v1/ai/*`

```bash
git add apps/web/src/components/layout/AppShell.tsx apps/web/public/sw.js
git commit -m "feat: integrate offline UI into AppShell, enhance service worker"
```

---

## Task 6: Integration verification

- TypeScript check all packages
- Run all tests
- Push to GitHub

```bash
npx vitest run
git push origin master
```
