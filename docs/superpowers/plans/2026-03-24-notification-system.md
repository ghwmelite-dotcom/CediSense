# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete in-app + Web Push notification system for Susu group activity, with a bell icon notification center, polling-based delivery, and per-group mute preferences.

**Architecture:** Hybrid approach — a `NotificationService` class handles all notification logic (fan-out, push delivery, preferences). Existing Susu routes are wrapped with `withNotification()` for automatic notification dispatch via `waitUntil()`. Frontend polls `/notifications/unread-count` every 30s and renders a bell icon + notification panel in the AppShell header.

**Tech Stack:** Hono (API), Cloudflare D1/KV/Workers, React 18, Tailwind CSS, Web Push API (manual VAPID signing via Web Crypto), Zod validation

**Spec:** `docs/superpowers/specs/2026-03-24-notification-system-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/migrations/0029_notifications.sql` | DB schema: notifications, push_subscriptions, notification_preferences tables + indexes |
| `apps/api/src/lib/notifications.ts` | NotificationService class — emit, list, markRead, push delivery, preferences, cleanup |
| `apps/api/src/lib/web-push.ts` | VAPID JWT signing + Web Push protocol via Web Crypto API |
| `apps/api/src/routes/notifications.ts` | API routes: GET feed, PATCH read, GET unread-count, push subscribe, preferences |
| `packages/shared/src/notification-types.ts` | Notification TypeScript types and Zod schemas (keeps types.ts/schemas.ts focused) |
| `apps/web/src/hooks/useNotifications.ts` | Notification state: polling, panel toggle, mark-read, pagination |
| `apps/web/src/hooks/usePushSubscription.ts` | Web Push permission + subscription lifecycle |
| `apps/web/src/components/shared/NotificationBell.tsx` | Bell icon + badge in TopBar |
| `apps/web/src/components/shared/NotificationPanel.tsx` | Dropdown/overlay notification list |
| `apps/web/src/components/shared/NotificationItem.tsx` | Single notification row |

### Modified Files
| File | Change |
|------|--------|
| `apps/api/src/types.ts` | Add VAPID secrets to `Env` interface |
| `apps/api/src/index.ts` | Register notification routes + middleware, change export to module format with `scheduled` handler |
| `apps/api/wrangler.toml` | Add `[triggers] crons` |
| `packages/shared/src/types.ts` | Extend `ApiSuccess.meta` to support cursor pagination |
| `packages/shared/src/schemas.ts` | Re-export notification schemas |
| `apps/web/src/components/layout/TopBar.tsx` | Add NotificationBell before avatar |
| `apps/web/src/components/layout/SideNav.tsx` | Add NotificationBell in desktop sidebar header (if applicable) |
| `apps/web/public/sw.js` | Add `push` + `notificationclick` event listeners, add `/api/v1/notifications` to NEVER_CACHE |
| `apps/api/src/routes/susu/contributions.ts` | Wrap with `withNotification` |
| `apps/api/src/routes/susu/members.ts` | Wrap with `withNotification` |
| `apps/api/src/routes/susu/claims.ts` | Add direct `emit()` calls for vote resolution |
| `apps/api/src/routes/susu/chat.ts` | Add direct `emit()` call with throttle |
| `apps/api/src/routes/susu/index.ts` | Import and wire NotificationService, pass to sub-routers |

---

## Task 1: Database Migration

**Files:**
- Create: `apps/api/migrations/0029_notifications.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 0029: Notification system tables
-- notifications: inbox for each user, one row per notification per recipient
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  group_id INTEGER REFERENCES susu_groups(id),
  reference_id INTEGER,
  reference_type TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_feed ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_cleanup ON notifications(created_at);

-- push_subscriptions: Web Push endpoints per user (supports multiple devices)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- notification_preferences: one row per user, minimal at launch
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  push_enabled INTEGER NOT NULL DEFAULT 1,
  muted_groups TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --local --file=migrations/0029_notifications.sql`
Expected: Migration applied successfully

- [ ] **Step 3: Verify tables exist**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'notif%' OR name='push_subscriptions'"`
Expected: `notifications`, `push_subscriptions`, `notification_preferences` listed

- [ ] **Step 4: Commit**

```bash
git add apps/api/migrations/0029_notifications.sql
git commit -m "feat(api): add notification system database schema (migration 0029)"
```

---

## Task 2: Shared Types & Schemas

**Files:**
- Create: `packages/shared/src/notification-types.ts`
- Modify: `packages/shared/src/types.ts:52-54`
- Modify: `packages/shared/src/schemas.ts` (add re-export at end)

- [ ] **Step 1: Create notification types file**

```typescript
// packages/shared/src/notification-types.ts
import { z } from 'zod';

// ── Notification type enums ────────────────────────────
export const notificationTypeSchema = z.enum([
  'susu_contribution',
  'susu_payout',
  'susu_vote_opened',
  'susu_vote_resolved',
  'susu_member_joined',
  'susu_chat_message',
  'susu_claim_filed',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationReferenceTypeSchema = z.enum([
  'contribution', 'payout', 'early_payout_request',
  'funeral_claim', 'welfare_claim', 'message',
]);
export type NotificationReferenceType = z.infer<typeof notificationReferenceTypeSchema>;

// ── Notification entity ────────────────────────────────
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  group_id: string | null;
  reference_id: string | null;
  reference_type: NotificationReferenceType | null;
  is_read: 0 | 1;
  created_at: string;
}

// ── Preferences ────────────────────────────────────────
export interface NotificationPreferences {
  push_enabled: boolean;
  muted_groups: string[];
}

// ── Push subscription payload (from browser) ───────────
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// ── Internal event shape (used by NotificationService) ─
export interface NotificationEvent {
  type: NotificationType;
  groupId: string;
  actorId: string;
  data: Record<string, unknown>;
}

// ── Zod schemas for API validation ─────────────────────
export const notificationPreferencesSchema = z.object({
  push_enabled: z.boolean().optional(),
  muted_groups: z.array(z.string()).optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const notificationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread_only: z.enum(['0', '1']).optional(),
});
```

- [ ] **Step 2: Extend ApiSuccess meta in types.ts**

In `packages/shared/src/types.ts`, update the `ApiSuccess` interface to support cursor-based pagination alongside existing offset pagination:

```typescript
// Replace lines 52-55
export interface ApiSuccess<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    cursor?: string | null;
    has_more?: boolean;
  };
}
```

- [ ] **Step 3: Re-export from schemas.ts**

Add at the end of `packages/shared/src/schemas.ts`:

```typescript
// Notification schemas
export {
  notificationTypeSchema,
  notificationReferenceTypeSchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  notificationQuerySchema,
} from './notification-types.js';

export type {
  NotificationType,
  NotificationReferenceType,
  Notification,
  NotificationPreferences,
  PushSubscriptionPayload,
  NotificationEvent,
} from './notification-types.js';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/notification-types.ts packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat(shared): add notification types, schemas, and cursor pagination meta"
```

---

## Task 3: Web Push Utility

**Files:**
- Create: `apps/api/src/lib/web-push.ts`
- Modify: `apps/api/src/types.ts:4-11`

- [ ] **Step 1: Add VAPID secrets to Env interface**

In `apps/api/src/types.ts`, add three new fields to the `Env` interface after line 10:

```typescript
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT_EMAIL: string;
}
```

- [ ] **Step 2: Create the Web Push utility**

```typescript
// apps/api/src/lib/web-push.ts

/**
 * Lightweight Web Push sender using Web Crypto API.
 * Works on Cloudflare Workers (no Node.js crypto dependency).
 */

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: { url?: string; notificationId?: string };
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a Web Push notification. Returns true if successful, false if subscription
 * is stale (410 Gone) and should be removed.
 * Throws on unexpected errors.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidContact: string,
): Promise<boolean> {
  const url = new URL(subscription.endpoint);

  // Build VAPID JWT (needs both keys: private for signing, public for x/y extraction)
  const jwt = await createVapidJwt(url.origin, vapidContact, vapidPrivateKey, vapidPublicKey);

  // Encrypt payload using the subscription keys
  const encrypted = await encryptPayload(
    JSON.stringify(payload),
    subscription.p256dh,
    subscription.auth,
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: encrypted,
  });

  if (response.status === 201 || response.status === 200) return true;
  if (response.status === 410 || response.status === 404) return false; // stale subscription

  // Log but don't throw — push is best-effort
  console.error(`Web Push failed: ${response.status} ${await response.text().catch(() => '')}`);
  return true; // don't remove subscription on transient errors
}

/**
 * Create a VAPID JWT signed with ES256 (P-256).
 *
 * IMPORTANT: VAPID keys from `web-push generate-vapid-keys` are raw EC key bytes
 * encoded as base64url. The private key is 32 bytes (the `d` parameter), and the
 * public key is 65 bytes (uncompressed point: 0x04 || x || y). Web Crypto's
 * importKey requires JWK format for ECDSA, so we construct a JWK from both keys.
 */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64Url: string,
  publicKeyBase64Url: string,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 86400, // 24 hours
    sub: subject,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimsB64 = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${headerB64}.${claimsB64}`;

  // Extract x, y from uncompressed public key (65 bytes: 0x04 || x[32] || y[32])
  const pubKeyBytes = base64UrlDecode(publicKeyBase64Url);
  const x = base64UrlEncodeBuffer(pubKeyBytes.slice(1, 33));
  const y = base64UrlEncodeBuffer(pubKeyBytes.slice(33, 65));

  // Construct JWK with both public (x, y) and private (d) components
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKeyBase64Url,
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );

  // Convert DER signature to raw r||s format for JWT
  const sig = new Uint8Array(signature);
  const rawSig = derToRaw(sig);

  return `${unsigned}.${base64UrlEncodeBuffer(rawSig)}`;
}

/**
 * Encrypt push message payload using aes128gcm content encoding.
 * Implements RFC 8291 (Message Encryption for Web Push).
 */
async function encryptPayload(
  plaintext: string,
  p256dhBase64Url: string,
  authBase64Url: string,
): Promise<ArrayBuffer> {
  const clientPublicKey = base64UrlDecode(p256dhBase64Url);
  const authSecret = base64UrlDecode(authBase64Url);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // Import the client's public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256,
  );

  // Export local public key (for the Content-Encoding header)
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  // Derive the encryption key and nonce via HKDF
  const ikm = await hkdfSha256(
    new Uint8Array(authSecret),
    new Uint8Array(sharedSecret),
    concatBuffers(utf8('WebPush: info\0'), new Uint8Array(clientPublicKey), localPublicKeyBytes),
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await hkdfExtract(salt, ikm);
  const contentEncryptionKey = await hkdfExpand(prk, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, utf8('Content-Encoding: nonce\0'), 12);

  // Encrypt with AES-128-GCM
  const paddedPlaintext = concatBuffers(new Uint8Array(new TextEncoder().encode(plaintext)), new Uint8Array([2]));

  const key = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPlaintext,
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = localPublicKeyBytes.length;
  header.set(localPublicKeyBytes, 21);

  return concatBuffers(header, new Uint8Array(ciphertext)).buffer;
}

// ── Crypto helpers ──────────────────────────────────────

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBuffer(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER encoded ECDSA signature to raw r||s (64 bytes)
  const raw = new Uint8Array(64);
  let offset = 2; // skip sequence tag and length

  // r value
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // s value
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

async function hkdfSha256(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = await crypto.subtle.sign('HMAC', key, ikm);
  return new Uint8Array(prk);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = new Uint8Array(length);
  let prev = new Uint8Array(0);
  let offset = 0;
  let counter = 1;

  while (offset < length) {
    const input = concatBuffers(prev, info, new Uint8Array([counter]));
    const output = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
    result.set(output.slice(0, Math.min(output.length, length - offset)), offset);
    prev = output;
    offset += output.length;
    counter++;
  }

  return result;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/lib/web-push.ts
git commit -m "feat(api): add VAPID env bindings and Web Push utility for Workers"
```

---

## Task 4: NotificationService

**Files:**
- Create: `apps/api/src/lib/notifications.ts`

- [ ] **Step 1: Create the NotificationService**

```typescript
// apps/api/src/lib/notifications.ts
import type { Env } from '../types.js';
import type {
  Notification,
  NotificationEvent,
  NotificationPreferences,
  NotificationType,
} from '@cedisense/shared';
import { sendWebPush } from './web-push.js';

interface PaginatedNotifications {
  notifications: Notification[];
  cursor: string | null;
  has_more: boolean;
}

interface MemberRow {
  user_id: string;
  display_name: string;
}

interface PreferenceRow {
  user_id: string;
  push_enabled: number;
  muted_groups: string;
}

interface PushSubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface GroupRow {
  name: string;
}

// Notification types that bypass group mute (financially important)
const FINANCIAL_TYPES: Set<NotificationType> = new Set([
  'susu_contribution',
  'susu_payout',
  'susu_vote_opened',
  'susu_vote_resolved',
  'susu_claim_filed',
]);

export class NotificationService {
  constructor(private env: Env) {}

  /**
   * Fan-out a notification event to all group members (except the actor).
   * Creates in-app notification rows and sends Web Push to eligible members.
   */
  async emit(event: NotificationEvent): Promise<void> {
    const { type, groupId, actorId, data } = event;

    // 1. Get group name + members (exclude actor)
    const [group, members] = await Promise.all([
      this.env.DB.prepare('SELECT name FROM susu_groups WHERE id = ?')
        .bind(groupId).first<GroupRow>(),
      this.env.DB.prepare(
        'SELECT user_id, display_name FROM susu_members WHERE group_id = ? AND user_id != ?'
      ).bind(groupId, actorId).all<MemberRow>(),
    ]);

    if (!group || !members.results.length) return;

    const groupName = group.name;
    const { title, body } = buildNotificationBody(type, groupName, data);

    // 2. Fetch preferences for all recipients in one query
    const recipientIds = members.results.map(m => m.user_id);
    const placeholders = recipientIds.map(() => '?').join(',');
    const prefs = await this.env.DB.prepare(
      `SELECT user_id, push_enabled, muted_groups FROM notification_preferences WHERE user_id IN (${placeholders})`
    ).bind(...recipientIds).all<PreferenceRow>();

    const prefsMap = new Map(prefs.results.map(p => [p.user_id, p]));

    // 3. Determine which members get in-app and push notifications
    const isFinancial = FINANCIAL_TYPES.has(type);
    const inAppRecipients: string[] = [];
    const pushRecipients: string[] = [];

    for (const member of members.results) {
      const pref = prefsMap.get(member.user_id);
      const mutedGroups: string[] = pref ? JSON.parse(pref.muted_groups) : [];
      const isMuted = mutedGroups.includes(groupId);

      // Financial notifications bypass mute; chat respects it
      if (isMuted && !isFinancial) continue;

      inAppRecipients.push(member.user_id);

      // Push: check master toggle
      const pushEnabled = pref ? pref.push_enabled === 1 : true; // default on
      if (pushEnabled) {
        // Chat push throttle: max 1 push per user per group per 60s
        if (type === 'susu_chat_message') {
          const throttleKey = `push-throttle:${member.user_id}:${groupId}`;
          const throttled = await this.env.KV.get(throttleKey);
          if (throttled) continue; // skip push, in-app row still created
          await this.env.KV.put(throttleKey, '1', { expirationTtl: 60 });
        }
        pushRecipients.push(member.user_id);
      }
    }

    // 4. Batch-insert notification rows
    if (inAppRecipients.length > 0) {
      const stmts = inAppRecipients.map(userId =>
        this.env.DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, group_id, reference_id, reference_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          userId,
          type,
          title,
          body,
          groupId,
          (data.referenceId as string) ?? null,
          (data.referenceType as string) ?? null,
        )
      );
      await this.env.DB.batch(stmts);
    }

    // 5. Send Web Push to eligible members
    if (pushRecipients.length > 0) {
      const pushPlaceholders = pushRecipients.map(() => '?').join(',');
      const subs = await this.env.DB.prepare(
        `SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${pushPlaceholders})`
      ).bind(...pushRecipients).all<PushSubRow & { user_id: string }>();

      const deepLinkUrl = `/susu?group=${groupId}`;
      const staleIds: string[] = [];

      await Promise.allSettled(
        subs.results.map(async (sub) => {
          const success = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, data: { url: deepLinkUrl } },
            this.env.VAPID_PUBLIC_KEY,
            this.env.VAPID_PRIVATE_KEY,
            this.env.VAPID_CONTACT_EMAIL,
          );
          if (!success) staleIds.push(sub.id);
        })
      );

      // Clean stale subscriptions
      if (staleIds.length > 0) {
        const delPlaceholders = staleIds.map(() => '?').join(',');
        await this.env.DB.prepare(
          `DELETE FROM push_subscriptions WHERE id IN (${delPlaceholders})`
        ).bind(...staleIds).run();
      }
    }
  }

  /**
   * Get paginated notification feed for a user.
   */
  async list(userId: string, opts: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<PaginatedNotifications> {
    const limit = opts.limit ?? 20;
    const fetchLimit = limit + 1; // fetch one extra to detect has_more

    let query: string;
    const binds: unknown[] = [userId];

    if (opts.cursor) {
      const { ts, id } = JSON.parse(atob(opts.cursor));
      if (opts.unreadOnly) {
        query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0
                 AND (created_at < ? OR (created_at = ? AND id < ?))
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
        binds.push(ts, ts, id, fetchLimit);
      } else {
        query = `SELECT * FROM notifications WHERE user_id = ?
                 AND (created_at < ? OR (created_at = ? AND id < ?))
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
        binds.push(ts, ts, id, fetchLimit);
      }
    } else {
      if (opts.unreadOnly) {
        query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
      } else {
        query = `SELECT * FROM notifications WHERE user_id = ?
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
      }
      binds.push(fetchLimit);
    }

    const result = await this.env.DB.prepare(query).bind(...binds).all<Notification>();
    const rows = result.results;
    const has_more = rows.length > limit;
    const notifications = has_more ? rows.slice(0, limit) : rows;

    // String-coerce IDs for TypeScript consistency
    const mapped = notifications.map(n => ({
      ...n,
      id: String(n.id),
      user_id: String(n.user_id),
      group_id: n.group_id ? String(n.group_id) : null,
      reference_id: n.reference_id ? String(n.reference_id) : null,
    }));

    const lastItem = mapped[mapped.length - 1];
    const cursor = lastItem
      ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
      : null;

    return { notifications: mapped, cursor: has_more ? cursor : null, has_more };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).bind(notificationId, userId).run();
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).bind(userId).run();
  }

  /**
   * Get total unread count.
   */
  async unreadCount(userId: string): Promise<number> {
    const row = await this.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first<{ count: number }>();
    return row?.count ?? 0;
  }

  /**
   * Save a Web Push subscription.
   */
  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?`
    ).bind(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userId, sub.keys.p256dh, sub.keys.auth).run();
  }

  /**
   * Remove a Web Push subscription.
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.env.DB.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).bind(userId, endpoint).run();
  }

  /**
   * Get notification preferences (creates default row if missing).
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const row = await this.env.DB.prepare(
      'SELECT push_enabled, muted_groups FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first<PreferenceRow>();

    if (!row) {
      return { push_enabled: true, muted_groups: [] };
    }

    return {
      push_enabled: row.push_enabled === 1,
      muted_groups: JSON.parse(row.muted_groups),
    };
  }

  /**
   * Update notification preferences (upsert).
   */
  async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = {
      push_enabled: prefs.push_enabled ?? current.push_enabled,
      muted_groups: prefs.muted_groups ?? current.muted_groups,
    };

    await this.env.DB.prepare(
      `INSERT INTO notification_preferences (user_id, push_enabled, muted_groups, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET push_enabled = ?, muted_groups = ?, updated_at = datetime('now')`
    ).bind(
      userId,
      updated.push_enabled ? 1 : 0,
      JSON.stringify(updated.muted_groups),
      updated.push_enabled ? 1 : 0,
      JSON.stringify(updated.muted_groups),
    ).run();

    return updated;
  }

  /**
   * Purge notifications older than N days. Returns count deleted.
   */
  async purgeExpired(daysOld: number): Promise<number> {
    const result = await this.env.DB.prepare(
      `DELETE FROM notifications WHERE created_at < datetime('now', '-' || ? || ' days')`
    ).bind(daysOld).run();
    return result.meta.changes ?? 0;
  }
}

// ── Notification body builder ───────────────────────────

function buildNotificationBody(
  type: NotificationType,
  groupName: string,
  data: Record<string, unknown>,
): { title: string; body: string } {
  const actorName = (data.actorName as string) ?? 'A member';
  const amount = data.amount_pesewas
    ? `GHS ${((data.amount_pesewas as number) / 100).toFixed(2)}`
    : '';
  const round = data.round ? ` (Round ${data.round})` : '';

  switch (type) {
    case 'susu_contribution':
      return { title: 'New Contribution', body: `${actorName} contributed ${amount} to ${groupName}${round}` };
    case 'susu_payout':
      return { title: 'Payout Processed', body: `${(data.recipientName as string) ?? actorName} received ${amount} from ${groupName}${round}` };
    case 'susu_vote_opened':
      return { title: 'Vote Needed', body: `${actorName} requested an early payout from ${groupName} — vote now` };
    case 'susu_vote_resolved':
      return { title: 'Vote Resolved', body: `${(data.outcome as string) ?? 'Request'} ${(data.status as string) ?? 'resolved'} in ${groupName}` };
    case 'susu_member_joined':
      return { title: 'New Member', body: `${actorName} joined ${groupName}` };
    case 'susu_chat_message':
      return { title: 'New Message', body: `${actorName} in ${groupName}: ${(data.preview as string) ?? ''}`.slice(0, 120) };
    case 'susu_claim_filed':
      return { title: 'Claim Filed', body: `${(data.claimType as string) ?? 'A'} claim filed in ${groupName} — review needed` };
    default:
      return { title: 'Notification', body: `Activity in ${groupName}` };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/notifications.ts
git commit -m "feat(api): add NotificationService with fan-out, push delivery, and preferences"
```

---

## Task 5: Notification API Routes

**Files:**
- Create: `apps/api/src/routes/notifications.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create the notification routes**

```typescript
// apps/api/src/routes/notifications.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { NotificationService } from '../lib/notifications.js';
import {
  notificationQuerySchema,
  pushSubscriptionSchema,
  notificationPreferencesSchema,
} from '@cedisense/shared';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET / — paginated notification feed
notifications.get('/', async (c) => {
  const userId = c.get('userId');
  const raw = {
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    unread_only: c.req.query('unread_only'),
  };

  const parsed = notificationQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  const result = await service.list(userId, {
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    unreadOnly: parsed.data.unread_only === '1',
  });

  // Return cursor/has_more inside data (not in meta) because the frontend
  // api.get<T> helper unwraps ApiSuccess.data and discards meta.
  return c.json({
    data: { items: result.notifications, cursor: result.cursor, has_more: result.has_more },
  });
});

// GET /unread-count — for bell badge polling
notifications.get('/unread-count', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  const count = await service.unreadCount(userId);
  return c.json({ data: { count } });
});

// PATCH /:id/read — mark single as read
notifications.patch('/:id/read', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const service = new NotificationService(c.env);
  await service.markRead(userId, id);
  return c.json({ data: { success: true } });
});

// PATCH /read-all — mark all as read
notifications.patch('/read-all', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  await service.markAllRead(userId);
  return c.json({ data: { success: true } });
});

// POST /push/subscribe — save push subscription
notifications.post('/push/subscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  await service.subscribe(userId, parsed.data);
  return c.json({ data: { success: true } }, 201);
});

// POST /push/unsubscribe — remove push subscription
notifications.post('/push/unsubscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  if (!body.endpoint || typeof body.endpoint !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'endpoint is required' } }, 400);
  }

  const service = new NotificationService(c.env);
  await service.unsubscribe(userId, body.endpoint);
  return c.json({ data: { success: true } });
});

// GET /preferences — get notification preferences
notifications.get('/preferences', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  const prefs = await service.getPreferences(userId);
  return c.json({ data: prefs });
});

// PUT /preferences — update notification preferences
notifications.put('/preferences', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = notificationPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  const updated = await service.updatePreferences(userId, parsed.data);
  return c.json({ data: updated });
});

export { notifications };
```

- [ ] **Step 2: Register routes in index.ts**

In `apps/api/src/index.ts`:

Add import at line 22 (after the collector import):
```typescript
import { notifications } from './routes/notifications.js';
```

Add middleware registration after line 120 (after collector middleware):
```typescript
// Notifications
app.use('/api/v1/notifications', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/notifications/*', authMiddleware, rateLimitMiddleware);
```

Add route mount after line 138 (after collector route):
```typescript
app.route('/api/v1/notifications', notifications);
```

- [ ] **Step 3: Change export to module format with scheduled handler**

Replace line 162 (`export default app;`) with:

```typescript
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const { NotificationService } = await import('./lib/notifications.js');
    const service = new NotificationService(env);
    const deleted = await service.purgeExpired(30);
    console.log(`[cron] Purged ${deleted} expired notifications`);
  },
};
```

- [ ] **Step 4: Add cron trigger to wrangler.toml**

Add at the end of `apps/api/wrangler.toml`:

```toml
[triggers]
crons = ["0 3 * * *"]
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/notifications.ts apps/api/src/index.ts apps/api/wrangler.toml
git commit -m "feat(api): add notification API routes with CRUD, push subscription, and cron cleanup"
```

---

## Task 6: withNotification Wrapper + Susu Route Integration

**Files:**
- Create: `apps/api/src/lib/with-notification.ts`
- Modify: `apps/api/src/routes/susu/contributions.ts`
- Modify: `apps/api/src/routes/susu/members.ts`
- Modify: `apps/api/src/routes/susu/claims.ts`
- Modify: `apps/api/src/routes/susu/chat.ts`

- [ ] **Step 1: Create the withNotification wrapper**

```typescript
// apps/api/src/lib/with-notification.ts
import type { Context } from 'hono';
import type { Env, Variables } from '../types.js';
import type { NotificationEvent } from '@cedisense/shared';
import { NotificationService } from './notifications.js';

type HonoContext = Context<{ Bindings: Env; Variables: Variables }>;
type HonoHandler = (c: HonoContext) => Promise<Response> | Response;
type EventFactory = (c: HonoContext, responseData: unknown) => NotificationEvent | null;

/**
 * Wraps a Hono route handler to automatically emit a notification
 * after a successful response. The notification is fired asynchronously
 * via waitUntil() so the response returns immediately.
 */
export function withNotification(handler: HonoHandler, eventFactory: EventFactory): HonoHandler {
  return async (c: HonoContext) => {
    const response = await handler(c);

    // Only notify on success (2xx)
    if (response.status >= 200 && response.status < 300) {
      try {
        // Clone the response to read the body without consuming it
        const cloned = response.clone();
        const json = await cloned.json() as { data?: unknown };

        const event = eventFactory(c, json.data);
        if (event) {
          const service = new NotificationService(c.env);
          c.executionCtx.waitUntil(
            service.emit(event).catch(err => {
              console.error('[notification] emit failed:', err);
            })
          );
        }
      } catch {
        // Don't let notification errors break the response
      }
    }

    return response;
  };
}
```

- [ ] **Step 2: Integrate with Susu contribution route**

In `apps/api/src/routes/susu/contributions.ts`, find the POST handler for recording a contribution. Wrap it with `withNotification`:

At the top, add import:
```typescript
import { withNotification } from '../../lib/with-notification.js';
```

Find the POST handler registration (e.g., `contributions.post('/', async (c) => {`) and wrap it. The exact integration depends on the handler structure — the wrapper should be applied around the handler function, and the eventFactory should extract `group_id`, `userId` (actor), `amount_pesewas`, `round`, and the contributor's display name from the response data.

Example eventFactory:
```typescript
(c, data: any) => ({
  type: 'susu_contribution' as const,
  groupId: c.req.param('id') ?? String(data?.group_id),
  actorId: c.get('userId'),
  data: {
    actorName: data?.member_name ?? 'A member',
    amount_pesewas: data?.amount_pesewas,
    round: data?.round,
    referenceId: String(data?.id),
    referenceType: 'contribution',
  },
})
```

- [ ] **Step 3: Integrate with Susu members route (join)**

In `apps/api/src/routes/susu/members.ts`, add the import and wrap the POST join handler similarly. The eventFactory should produce a `susu_member_joined` event.

- [ ] **Step 4: Integrate with Susu claims routes (direct emit)**

In `apps/api/src/routes/susu/claims.ts`, add direct `NotificationService.emit()` calls in the vote handlers. For early payout requests and funeral/welfare claims:

- When a new request/claim is created: emit `susu_vote_opened` or `susu_claim_filed`
- When a vote resolves (final vote meets threshold): emit `susu_vote_resolved`

```typescript
import { NotificationService } from '../../lib/notifications.js';

// Inside the vote handler, after resolution check:
if (isResolved) {
  const service = new NotificationService(c.env);
  c.executionCtx.waitUntil(
    service.emit({
      type: 'susu_vote_resolved',
      groupId: String(groupId),
      actorId: c.get('userId'),
      data: {
        outcome: request.status === 'approved' ? 'Request approved' : 'Request denied',
        status: request.status,
        referenceId: String(request.id),
        referenceType: 'early_payout_request',
      },
    }).catch(err => console.error('[notification] emit failed:', err))
  );
}
```

- [ ] **Step 5: Integrate with Susu chat route (direct emit with throttle)**

In `apps/api/src/routes/susu/chat.ts`, after successfully inserting a message, emit a `susu_chat_message` event. The NotificationService already handles the KV-based push throttle internally.

```typescript
import { NotificationService } from '../../lib/notifications.js';

// After message insert:
const service = new NotificationService(c.env);
c.executionCtx.waitUntil(
  service.emit({
    type: 'susu_chat_message',
    groupId: c.req.param('id'),
    actorId: c.get('userId'),
    data: {
      actorName: member.display_name,
      preview: body.content?.slice(0, 100) ?? '',
      referenceId: String(messageId),
      referenceType: 'message',
    },
  }).catch(err => console.error('[notification] emit failed:', err))
);
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/with-notification.ts apps/api/src/routes/susu/
git commit -m "feat(api): integrate notifications into Susu routes with withNotification wrapper"
```

---

## Task 7: Service Worker Push Handlers

**Files:**
- Modify: `apps/web/public/sw.js`

- [ ] **Step 1: Add /api/v1/notifications to NEVER_CACHE**

In `apps/web/public/sw.js`, add to the NEVER_CACHE array (after line 29):

```javascript
const NEVER_CACHE = [
  '/api/v1/auth',
  '/api/v1/ai',
  '/api/v1/export',
  '/api/v1/notifications',
];
```

- [ ] **Step 2: Add push event listener**

After the `message` event listener (after line 58), add:

```javascript
// ── PUSH (Web Push notifications) ───────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CediSense', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    tag: payload.data?.notificationId || 'cedisense-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'CediSense', options)
  );
});

// ── NOTIFICATION CLICK (deep-link navigation) ───────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing CediSense tab
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if (focused) focused.navigate(fullUrl);
            return focused;
          });
        }
      }
      // No existing tab — open new one
      return clients.openWindow(fullUrl);
    })
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/sw.js
git commit -m "feat(web): add push notification and click handlers to service worker"
```

---

## Task 8: Frontend — useNotifications Hook

**Files:**
- Create: `apps/web/src/hooks/useNotifications.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/hooks/useNotifications.ts
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
    // The api.get<T> helper unwraps ApiSuccess.data, discarding meta.
    // To get cursor/has_more, the notification list endpoint returns them
    // inside the data payload: { items: [...], cursor, has_more }.
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
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: 1 as const } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    api.patch('/notifications/read-all').catch(() => {});
    // Optimistic update
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
```

**Important:** The existing `api` helper (`apps/web/src/lib/api.ts`) only supports `get`, `post`, `put`, `delete` — no `patch` method. The notification routes use `PATCH /:id/read` and `PATCH /read-all`. Either:

(a) Add `patch` to the api helper:
```typescript
patch: <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
```

(b) Or change the notification routes from PATCH to POST.

**Recommendation:** Add `patch` to the api helper — it's a one-line addition and PATCH is semantically correct for partial updates.

- [ ] **Step 2: Add patch method to api.ts**

In `apps/web/src/lib/api.ts`, add to the `api` export object (after `post`):

```typescript
patch: <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
```

Then update the hook to use `api.patch` for mark-read calls.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useNotifications.ts apps/web/src/lib/api.ts
git commit -m "feat(web): add useNotifications hook with polling, pagination, and mark-read"
```

---

## Task 9: Frontend — usePushSubscription Hook

**Files:**
- Create: `apps/web/src/hooks/usePushSubscription.ts`

- [ ] **Step 1: Create the push subscription hook**

```typescript
// apps/web/src/hooks/usePushSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface UsePushSubscriptionReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// VAPID public key — must match the server's VAPID_PUBLIC_KEY secret.
// This is safe to expose in client code (it's a public key).
// TODO: Replace with your actual VAPID public key.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  const isSupported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const sub = subscription.toJSON();
    await api.post('/notifications/push/subscribe', {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
      },
    });
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await api.post('/notifications/push/unsubscribe', {
      endpoint: subscription.endpoint,
    });

    await subscription.unsubscribe();
    setPermission('default');
  }, [isSupported]);

  return { isSupported, permission, subscribe, unsubscribe };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePushSubscription.ts
git commit -m "feat(web): add usePushSubscription hook for Web Push lifecycle"
```

---

## Task 10: Frontend — NotificationItem Component

**Files:**
- Create: `apps/web/src/components/shared/NotificationItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/shared/NotificationItem.tsx
import type { Notification, NotificationType } from '@cedisense/shared';

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

// SVG icon paths (inline Lucide-style icons — no emoji in production UI)
const TYPE_CONFIG: Record<NotificationType, { iconPath: string; color: string }> = {
  susu_contribution: { iconPath: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', color: 'text-income' },
  susu_payout: { iconPath: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', color: 'text-ghana-gold' },
  susu_vote_opened: { iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', color: 'text-info' },
  susu_vote_resolved: { iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3', color: 'text-income' },
  susu_member_joined: { iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6', color: 'text-white/70' },
  susu_chat_message: { iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', color: 'text-white/70' },
  susu_claim_filed: { iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8', color: 'text-warning' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type] ?? { iconPath: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', color: 'text-white/50' };
  const isUnread = notification.is_read === 0;

  return (
    <button
      type="button"
      onClick={() => onPress(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150
        ${isUnread ? 'bg-elevated/50' : 'bg-transparent'} hover:bg-elevated/80`}
    >
      {/* SVG Icon */}
      <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={config.iconPath} />
      </svg>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${isUnread ? 'text-white font-semibold' : 'text-white/80'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-white/50 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>
        <p className="text-[10px] text-white/30 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <span className="w-2 h-2 rounded-full bg-info flex-shrink-0 mt-2" aria-label="Unread" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/shared/NotificationItem.tsx
git commit -m "feat(web): add NotificationItem component with type icons and time-ago"
```

---

## Task 11: Frontend — NotificationPanel Component

**Files:**
- Create: `apps/web/src/components/shared/NotificationPanel.tsx`

- [ ] **Step 1: Create the panel component**

```tsx
// apps/web/src/components/shared/NotificationPanel.tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@cedisense/shared';
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
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-info hover:text-info/80 transition-colors"
          >
            Mark all read
          </button>
        )}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/shared/NotificationPanel.tsx
git commit -m "feat(web): add NotificationPanel with infinite scroll, empty state, and skeleton"
```

---

## Task 12: Frontend — NotificationBell + TopBar Integration

**Files:**
- Create: `apps/web/src/components/shared/NotificationBell.tsx`
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Create the NotificationBell component**

```tsx
// apps/web/src/components/shared/NotificationBell.tsx
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
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200 hover:bg-white/5"
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-expense text-white text-[10px] font-bold flex items-center justify-center motion-safe:animate-pulseSoft">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          hasMore={hasMore}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onLoadMore={loadMore}
          onClose={close}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationBell to TopBar**

In `apps/web/src/components/layout/TopBar.tsx`, add the bell between the logo and the avatar:

Add import at the top:
```typescript
import { NotificationBell } from '../shared/NotificationBell';
```

Replace the section between the logo `</div>` and `{/* Avatar */}` (between lines 36 and 38) with:

```tsx
      {/* Right side: bell + avatar */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        {/* Avatar */}
        <button
          // ... existing avatar button code
```

And close the wrapper `</div>` after the avatar button.

- [ ] **Step 3: Add NotificationBell to SideNav (desktop)**

In `apps/web/src/components/layout/SideNav.tsx`, add the bell icon to the desktop sidebar header area (near the logo/branding section). Import and render `<NotificationBell />` so desktop users also see the notification bell. Follow the same pattern as TopBar — place it before the user avatar/profile section.

- [ ] **Step 4: Verify it renders**

Run: `cd apps/web && npm run dev`
Expected: The bell icon appears in TopBar on mobile and SideNav on desktop. Clicking it opens the notification panel.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/NotificationBell.tsx apps/web/src/components/layout/TopBar.tsx apps/web/src/components/layout/SideNav.tsx
git commit -m "feat(web): add NotificationBell to TopBar and SideNav with unread badge and dropdown panel"
```

---

## Task 13: Push Permission Prompt + Preferences UI

**Files:**
- Modify: `apps/web/src/components/shared/NotificationPanel.tsx` (add gear icon + inline prefs)

- [ ] **Step 1: Add push toggle to NotificationPanel header**

In `NotificationPanel.tsx`, import `usePushSubscription` and add a toggle in the header:

```typescript
import { usePushSubscription } from '../../hooks/usePushSubscription';
```

Add to the header section (next to "Mark all read"):

```tsx
{/* Gear icon — toggles push */}
<div className="flex items-center gap-3">
  {hasUnread && (
    <button type="button" onClick={onMarkAllRead} className="text-xs text-info hover:text-info/80 transition-colors">
      Mark all read
    </button>
  )}
  <PushToggle />
</div>
```

Where `PushToggle` is a small inline component:

```tsx
function PushToggle() {
  const { isSupported, permission, subscribe, unsubscribe } = usePushSubscription();
  if (!isSupported) return null;

  if (permission === 'denied') {
    return <span className="text-[10px] text-white/30">Push blocked by browser</span>;
  }

  const enabled = permission === 'granted';

  return (
    <button
      type="button"
      onClick={enabled ? unsubscribe : subscribe}
      className="text-xs text-white/50 hover:text-white/70 transition-colors"
      aria-label={enabled ? 'Disable push notifications' : 'Enable push notifications'}
    >
      {enabled ? '🔔' : '🔕'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/shared/NotificationPanel.tsx
git commit -m "feat(web): add push notification toggle to notification panel header"
```

---

## Task 14: Final Wiring & Cleanup

**Files:**
- Verify all imports resolve
- Verify the shared package exports notification types

- [ ] **Step 1: Verify shared package exports**

Check that `packages/shared/src/index.ts` (or the package's main entry) re-exports from `notification-types.ts`. If not, add:

```typescript
export * from './notification-types.js';
```

- [ ] **Step 2: Full build check**

Run: `npm run build` (or `pnpm build` / `turbo build` depending on monorepo setup)
Expected: All packages build successfully with no TypeScript errors

- [ ] **Step 3: Test locally**

Run: `npm run dev` (starts both API and web)
Expected:
- Bell icon visible in TopBar
- Clicking bell opens empty panel ("You're all caught up")
- `/api/v1/notifications/unread-count` returns `{ data: { count: 0 } }`
- `/api/v1/notifications` returns `{ data: [], meta: { cursor: null, has_more: false } }`
- `/api/v1/notifications/preferences` returns `{ data: { push_enabled: true, muted_groups: [] } }`

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat: complete notification system — bell UI, push support, Susu integration"
```

---

## Task 15: Generate VAPID Keys & Configure Secrets

This is a deployment step, not a code change.

- [ ] **Step 1: Generate VAPID key pair**

Run: `npx web-push generate-vapid-keys`
Expected: Outputs a public key and private key in base64url format

- [ ] **Step 2: Set Cloudflare Worker secrets**

Run:
```bash
cd apps/api
npx wrangler secret put VAPID_PUBLIC_KEY    # paste the public key
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key
npx wrangler secret put VAPID_CONTACT_EMAIL # enter mailto:support@cedisense.com
```

- [ ] **Step 3: Set VITE_VAPID_PUBLIC_KEY in frontend**

Add to `apps/web/.env` (or `.env.production`):
```
VITE_VAPID_PUBLIC_KEY=<paste-public-key-here>
```

- [ ] **Step 4: Apply migration to production D1**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --file=migrations/0029_notifications.sql`
Expected: Migration applied to production D1

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | Database tables + indexes |
| 2 | Shared TypeScript types + Zod schemas |
| 3 | Web Push utility (VAPID signing, encryption) |
| 4 | NotificationService (fan-out, preferences, push, cleanup) |
| 5 | API routes (feed, mark-read, unread-count, push, preferences) + cron |
| 6 | withNotification wrapper + Susu route integration |
| 7 | Service worker push + click handlers |
| 8 | useNotifications hook (polling, pagination, state) |
| 9 | usePushSubscription hook (permission, subscribe/unsubscribe) |
| 10 | NotificationItem component |
| 11 | NotificationPanel component |
| 12 | NotificationBell + TopBar integration |
| 13 | Push permission toggle in panel |
| 14 | Final wiring, build verification, local test |
| 15 | VAPID keys + production deployment |
