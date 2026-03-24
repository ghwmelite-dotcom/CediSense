# CediSense Notification System Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Susu group notifications (in-app + Web Push), polling-based delivery

---

## Overview

CediSense currently has no centralized notification system. This design introduces a complete notification infrastructure scoped to Susu group activity at launch, with architecture that supports future expansion to financial alerts, goals, investments, and gamification.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Delivery channels | In-app + Web Push | Both — in-app for active users, push for re-engagement |
| Trigger scope | Susu group activity only | Most social and time-sensitive feature; ship focused, expand later |
| Preferences model | Minimal (master toggle + per-group mute) | Covers 80% of needs; schema supports future granularity |
| Notification center UI | Bell icon in AppShell header | Mobile-first; BottomNav already dense; bell is universally understood |
| Real-time delivery | Polling (30s) | Proven pattern in codebase; no new infrastructure; Susu events tolerate 30s delay |
| Persistence | 30 days, daily cron purge | Keeps D1 lean; users rarely scroll past a week |
| Architecture | Hybrid — NotificationService + withNotification wrapper | Centralized logic, minimal route changes, async push via waitUntil() |
| Email | Excluded | Not wanted at this stage |
| ID convention | All IDs typed as `string` | Matches existing codebase convention — D1 INTEGER PKs are coerced to string at the boundary |

---

## Database Schema

All tables use `INTEGER PRIMARY KEY` (auto-increment) matching the existing D1 migration pattern. IDs are coerced to `string` in TypeScript at the query boundary, consistent with all other entities.

### `notifications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER NOT NULL | FK → users.id |
| `type` | TEXT NOT NULL | See NotificationType enum |
| `title` | TEXT NOT NULL | Display title |
| `body` | TEXT NOT NULL | Detail text |
| `group_id` | INTEGER | Nullable FK → susu_groups.id |
| `reference_id` | INTEGER | Nullable — ID of related entity |
| `reference_type` | TEXT | Nullable — `contribution`, `payout`, `early_payout_request`, `funeral_claim`, `welfare_claim`, `message` |
| `is_read` | INTEGER DEFAULT 0 | 0/1 boolean |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

**Indexes:**
- `(user_id, is_read, created_at DESC)` — unread-first feed
- `(user_id, created_at DESC)` — chronological feed
- `(created_at)` — 30-day cleanup cron

### `push_subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER NOT NULL | FK → users.id |
| `endpoint` | TEXT NOT NULL UNIQUE | Web Push subscription endpoint |
| `p256dh` | TEXT NOT NULL | Public key |
| `auth` | TEXT NOT NULL | Auth secret |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

**Index:** `(user_id)`

### `notification_preferences`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER NOT NULL UNIQUE | FK → users.id |
| `push_enabled` | INTEGER DEFAULT 1 | Master push toggle |
| `muted_groups` | TEXT DEFAULT '[]' | JSON array of muted group IDs |
| `updated_at` | TEXT DEFAULT CURRENT_TIMESTAMP | |

**Note on `muted_groups` as JSON:** Storing as a JSON array in TEXT means preference checks happen in application code during fan-out (parse JSON, check if groupId is in array). This is acceptable at launch scale (groups max ~20 members). If group sizes grow significantly, migrate to a normalized `notification_mutes (user_id, group_id)` table to enable SQL-level filtering.

---

## Backend Architecture

### Environment Bindings

The following must be added to `apps/api/src/types.ts` `Env` interface and configured as Cloudflare Worker secrets:

```typescript
// Add to existing Env interface
VAPID_PUBLIC_KEY: string    // VAPID public key for Web Push
VAPID_PRIVATE_KEY: string   // VAPID private key for Web Push
VAPID_CONTACT_EMAIL: string // Contact email for VAPID (e.g. "mailto:support@cedisense.com")
```

**Web Push library:** Use manual VAPID signing via the Web Crypto API (available in Workers runtime). The `web-push` npm package relies on Node.js `crypto` and `http` which are unavailable in Workers. Implement a lightweight `sendWebPush()` utility using `crypto.subtle` for JWT signing and `fetch()` for push endpoint delivery.

### NotificationService (`apps/api/src/lib/notifications.ts`)

```typescript
class NotificationService {
  constructor(env: Env)  // Takes full Env for DB, KV, and VAPID secrets

  // Core: fan-out notifications to group members + fire push
  emit(event: NotificationEvent): Promise<void>

  // Query: paginated feed
  list(userId: string, opts: { cursor?, limit?, unreadOnly? }): Promise<PaginatedNotifications>

  // Actions
  markRead(userId: string, notificationId: string): Promise<void>
  markAllRead(userId: string): Promise<void>

  // Push subscription management
  subscribe(userId: string, subscription: PushSubscriptionPayload): Promise<void>
  unsubscribe(userId: string, endpoint: string): Promise<void>

  // Preferences
  getPreferences(userId: string): Promise<NotificationPreferences>
  updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>

  // Cleanup
  purgeExpired(daysOld: number): Promise<number>
}
```

### `emit()` Flow

1. Receive typed event (type, groupId, actorId, data)
2. Look up group members via `susu_members` (exclude actor — you don't notify yourself)
3. Fetch notification preferences for all members in one query
4. Filter: skip members with push disabled or group muted (chat only — financial notifications bypass mute)
5. Batch-insert notification rows using **`db.batch()`** — each insert is a separate prepared statement, but `db.batch()` executes them in a single D1 round-trip for performance
6. For push-eligible members, look up their `push_subscriptions` and send Web Push payloads
7. Auto-clean stale subscriptions on 410 Gone responses (subscription expired/revoked)

### Chat Notification Throttling

Chat messages (`susu_chat_message`) are the noisiest event type. To prevent notification spam in active groups:

- **Push throttle:** If the user already received a chat push for the same group within the last 60 seconds, suppress the push notification (still create the in-app notification row). Use KV with a TTL key like `push-throttle:{userId}:{groupId}` → 60s expiry.
- **In-app notifications** are always created (they're cheap DB rows and the notification center needs the full history).
- **Muted groups** suppress both push AND in-app notifications for chat messages only. Financial notifications (contributions, payouts, votes) always deliver regardless of mute status.

### `withNotification` Wrapper

```typescript
function withNotification(
  handler: HonoHandler,
  eventFactory: (c: Context, response: any) => NotificationEvent | null
): HonoHandler
```

- Calls original handler
- On 2xx response, calls eventFactory to build event
- Fires `NotificationService.emit()` via `c.executionCtx.waitUntil()` (async, non-blocking — response returns immediately)
- For complex cases (conditional notifications), call `emit()` directly in the handler

**Note:** This is the first usage of `waitUntil()` in the codebase. It allows the notification fan-out to execute after the response is sent, avoiding latency for the triggering user.

### Web Push

- VAPID keys stored as Cloudflare Worker secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`)
- Push payload: `{ title, body, icon, badge, data: { url, notificationId } }`
- `data.url` enables click-to-navigate deep linking (e.g. `/susu?group=5`)
- Manual VAPID JWT signing via Web Crypto API (`crypto.subtle.sign` with ES256/P-256)
- Failed deliveries (410 Gone) auto-clean stale subscriptions
- Failed deliveries (other errors) are silently logged — push is best-effort

### Cron Trigger

Daily at 3 AM UTC — purges notifications older than 30 days.

**Important:** The current `apps/api/src/index.ts` exports only the Hono app. To support cron triggers, the export must change to the module format:

```typescript
// Before:
export default app

// After:
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const service = new NotificationService(env)
    await service.purgeExpired(30)
  }
}
```

Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 3 * * *"]
```

---

## API Routes

Mounted at `/api/v1/notifications`, all protected by `authMiddleware` and `rateLimitMiddleware` (matching the existing middleware pattern for all protected routes).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Paginated feed. Query: `cursor`, `limit` (default 20), `unread_only` (0/1) |
| `PATCH` | `/:id/read` | Mark single notification as read |
| `PATCH` | `/read-all` | Mark all as read |
| `GET` | `/unread-count` | Returns `{ count: number }` for bell badge |
| `POST` | `/push/subscribe` | Save Web Push subscription |
| `POST` | `/push/unsubscribe` | Remove push subscription |
| `GET` | `/preferences` | Get notification preferences |
| `PUT` | `/preferences` | Update preferences |

**Pagination:** Cursor-based using `created_at` + `id` composite cursor, base64-encoded (e.g. `btoa(JSON.stringify({ts, id}))`). Consistent with existing chat pagination pattern.

**Response envelope:** Standard `ApiSuccess<T>` pattern. The existing `ApiSuccess.meta` type (`{ total?, page?, limit? }`) must be extended to support cursor-based pagination fields (`{ cursor?, has_more? }`) alongside the existing offset-based fields. Cursor-compatible meta:

```typescript
// GET /notifications
{ data: Notification[], meta: { cursor: string | null, has_more: boolean } }

// GET /notifications/unread-count
{ data: { count: number } }

// GET /notifications/preferences
{ data: { push_enabled: boolean, muted_groups: string[] } }
```

---

## Frontend Architecture

### Components

**`NotificationBell`** (`components/shared/NotificationBell.tsx`)
- Bell icon in AppShell header, top-right
- Polls `/notifications/unread-count` every 30s
- Red badge with count (max "99+")
- Click toggles NotificationPanel
- `animate-pulseSoft` on badge when count > 0

**`NotificationPanel`** (`components/shared/NotificationPanel.tsx`)
- Desktop: dropdown below bell, max-height 480px, scrollable
- Mobile: full-screen slide-up overlay
- Header: "Notifications" + "Mark all read" + gear icon (preferences)
- Infinite scroll with cursor pagination (20 per page)
- Empty state: "You're all caught up"
- Skeleton loading state

**`NotificationItem`** (`components/shared/NotificationItem.tsx`)
- Left: color-coded icon per type (gold=payout, green=contribution, purple=vote, etc.)
- Center: bold title + truncated body (2 lines) + relative timestamp
- Right: unread blue dot
- Tap: mark read + navigate to relevant page
- Unread items have `bg-elevated` background

### Hooks

**`useNotifications()`** (`hooks/useNotifications.ts`)
- Panel state, paginated fetch, mark-read mutations
- Exposes: `{ notifications, unreadCount, isOpen, toggle, markRead, markAllRead, loadMore, hasMore }`

**`usePushSubscription()`** (`hooks/usePushSubscription.ts`)
- Browser Push API capability check
- Permission request flow (`Notification.requestPermission()`)
- Subscribe/unsubscribe with VAPID public key via `PushManager.subscribe()`
- Sync subscription to backend
- Exposes: `{ isSupported, permission, subscribe, unsubscribe }`

### Service Worker Additions (`public/sw.js`)

These are additions to the **existing** service worker file, not a new file. `/api/v1/notifications` must NOT be added to `CACHEABLE_API_PREFIXES` in `sw.js` — notification data must always be fresh, especially the polled `/unread-count` endpoint.

**`push` event listener:**
- Parse push payload JSON
- Show native notification with title, body, icon (CediSense logo from `/icons/`), badge

**`notificationclick` event listener:**
- Read `data.url` from notification
- Focus existing CediSense tab or open new one
- Navigate to the deep-link URL

### Notification Preferences UI

- Gear icon in notification panel header → small inline settings
- Master toggle: "Push notifications" on/off
- Per-group mute: "Mute this group" toggle in each Susu group header/settings
- No standalone preferences page at launch

---

## Susu Route Integration

| Route | Event Type | Recipients | Title | Body Example |
|-------|-----------|------------|-------|-------------|
| `POST /groups/:id/contributions` | `susu_contribution` | All except contributor | "New Contribution" | "Ama contributed GHS 50 to Ama's Circle (Round 3)" |
| `POST /groups/:id/payouts` | `susu_payout` | All members | "Payout Processed" | "Kwame received GHS 500 from Ama's Circle (Round 3)" |
| `POST /groups/:id/members/:userId` | `susu_member_joined` | Existing members | "New Member" | "Kofi joined Ama's Circle" |
| `POST /early-payouts` | `susu_vote_opened` | All except requester | "Vote Needed" | "Ama requested an early payout — vote now" |
| `POST /early-payouts/:id/vote` | `susu_vote_resolved` | All members | "Vote Resolved" | "Early payout approved for Ama's Circle" |
| `POST /claims` | `susu_claim_filed` | All except claimant | "Claim Filed" | "Funeral claim filed in Ama's Circle" |
| `POST /claims/:id/vote` | `susu_vote_resolved` | All members | "Claim Resolved" | "Funeral claim approved in Ama's Circle" |
| `POST /groups/:id/chat` | `susu_chat_message` | All except sender | "New Message" | "Ama: Hey, don't forget to contribute!" |

### Notification behavior rules

- **Chat messages** respect muted groups (suppresses both in-app and push). Financial notifications (contributions, payouts, votes) bypass mute — they're financially important.
- **Chat push throttle:** Max one push per user per group per 60 seconds via the existing `KV` binding (no new KV namespace needed). In-app notification rows always created.
- **Vote resolution** notifications fire only on the deciding vote, not every vote cast.
- **Payout notifications** go to ALL members including the recipient (confirmation + visibility).
- **Body text** built by `buildNotificationBody(type, data)` helper — centralizes copy, easy to localize later via `preferred_language`.

### Integration method

- **`withNotification` wrapper:** contributions, payouts, member join, early payout request, claim filed
- **Direct `emit()` call:** vote handlers (conditional on resolution), chat messages (different mute/throttle logic)

---

## Shared Types

### `packages/shared/src/types.ts`

All IDs are typed as `string` matching the existing codebase convention.

```typescript
type NotificationType =
  | 'susu_contribution'
  | 'susu_payout'
  | 'susu_vote_opened'
  | 'susu_vote_resolved'
  | 'susu_member_joined'
  | 'susu_chat_message'
  | 'susu_claim_filed'

type NotificationReferenceType =
  | 'contribution' | 'payout' | 'early_payout_request'
  | 'funeral_claim' | 'welfare_claim' | 'message'

interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  group_id: string | null
  reference_id: string | null
  reference_type: NotificationReferenceType | null
  is_read: 0 | 1  // D1 stores as INTEGER 0/1; frontend should treat 0 as false, 1 as true
  created_at: string
}

interface NotificationPreferences {
  push_enabled: boolean
  muted_groups: string[]
}

interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface NotificationEvent {
  type: NotificationType
  groupId: string
  actorId: string
  data: Record<string, unknown>
}
```

**Note:** `susu_penalty` and `susu_reminder` are excluded from the launch type union since no routes or crons emit them yet. Add them when those features are implemented.

### `packages/shared/src/schemas.ts`

Zod schemas for:
- `notificationPreferencesSchema` — `{ push_enabled: z.boolean(), muted_groups: z.array(z.string()) }`
- `pushSubscriptionSchema` — validates `{ endpoint: z.string().url(), keys: { p256dh: z.string(), auth: z.string() } }`
- `notificationQuerySchema` — validates query params `{ cursor: z.string().optional(), limit: z.number().int().min(1).max(50).default(20), unread_only: z.enum(['0','1']).optional() }`
- `notificationTypeSchema` — Zod enum for API boundary validation

---

## Testing Strategy

- **Unit tests** for `NotificationService`: mock D1 via `miniflare` or in-memory stub. Test fan-out logic, preference filtering, mute bypass for financial events, chat throttle, cursor pagination.
- **Unit tests** for `buildNotificationBody`: pure function, test all event types produce correct copy.
- **Integration tests** for API routes: test auth, pagination, mark-read, preferences CRUD, push subscription lifecycle.
- **Frontend tests** for hooks: mock fetch, test polling interval, panel state management, mark-read optimistic updates.

---

## Future Expansion Path

When ready to add more notification triggers:

1. **Financial alerts** — add types like `budget_exceeded`, `bill_due`, `large_transaction` to NotificationType
2. **Goals** — add `goal_reached`, `goal_deadline`
3. **Investments** — add `investment_maturing`
4. **Gamification** — add `badge_earned`, `trust_milestone`
5. **Preferences granularity** — add per-type toggle columns to `notification_preferences`
6. **Normalized mutes** — migrate `muted_groups` JSON to a `notification_mutes` join table if group sizes exceed ~50

No schema migrations needed for new types — just add to the TypeScript union and create new event factories.
