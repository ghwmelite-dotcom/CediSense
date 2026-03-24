# Admin Portal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate admin portal with role-based access, user management (view/search/deactivate/PIN reset), Susu group moderation (deactivate/remove members/delete messages), and a dashboard with metrics + activity feed.

**Architecture:** Admin routes added to the existing Hono Worker at `/api/v1/admin/*`, guarded by `adminMiddleware`. Separate `apps/admin` React frontend deployed to `admin.cedisense.pages.dev`. Reuses existing phone+PIN auth. Audit log for all admin actions.

**Tech Stack:** Hono (API), Cloudflare D1/KV/Workers, React 18, Vite, Tailwind CSS, React Router 6, Zod, `@cedisense/shared`

**Spec:** `docs/superpowers/specs/2026-03-24-admin-portal-design.md`

---

## File Structure

### New Files — Backend
| File | Responsibility |
|------|---------------|
| `apps/api/migrations/0031_admin_portal.sql` | Add `role`, `is_active` columns to users + `admin_audit_log` table + activity feed indexes |
| `apps/api/src/middleware/admin.ts` | Admin role check middleware |
| `apps/api/src/routes/admin/index.ts` | Admin route aggregator — mounts dashboard, users, groups, audit sub-routers |
| `apps/api/src/routes/admin/dashboard.ts` | GET /admin/dashboard (metrics) + GET /admin/activity (feed) |
| `apps/api/src/routes/admin/users.ts` | Admin user management CRUD |
| `apps/api/src/routes/admin/groups.ts` | Admin Susu group moderation |
| `apps/api/src/routes/admin/audit.ts` | GET /admin/audit-log |
| `apps/api/src/lib/audit.ts` | `logAuditAction()` helper for writing to admin_audit_log |

### New Files — Frontend (`apps/admin/`)
| File | Responsibility |
|------|---------------|
| `apps/admin/package.json` | Dependencies (React 18, React Router, Tailwind, Vite) |
| `apps/admin/vite.config.ts` | Vite config with @ alias and dev proxy |
| `apps/admin/tailwind.config.ts` | Same design tokens as consumer app |
| `apps/admin/tsconfig.json` | TypeScript config with @ alias |
| `apps/admin/index.html` | HTML entry point |
| `apps/admin/public/_redirects` | API proxy for Cloudflare Pages |
| `apps/admin/src/main.tsx` | React entry |
| `apps/admin/src/App.tsx` | Router with admin-protected routes |
| `apps/admin/src/lib/api.ts` | API client (simplified from consumer — no offline support needed) |
| `apps/admin/src/contexts/AuthContext.tsx` | Admin auth context — login + role check |
| `apps/admin/src/components/layout/AdminShell.tsx` | Sidebar nav + top bar |
| `apps/admin/src/components/layout/AdminProtectedRoute.tsx` | Role-checking route guard |
| `apps/admin/src/components/shared/DataTable.tsx` | Reusable paginated table with search/filter |
| `apps/admin/src/components/shared/MetricCard.tsx` | Stat display card |
| `apps/admin/src/components/shared/ConfirmModal.tsx` | Destructive action confirmation |
| `apps/admin/src/pages/LoginPage.tsx` | Admin login |
| `apps/admin/src/pages/DashboardPage.tsx` | Metrics + activity feed |
| `apps/admin/src/pages/UsersPage.tsx` | User list with search/filter |
| `apps/admin/src/pages/UserDetailPage.tsx` | User profile + actions |
| `apps/admin/src/pages/GroupsPage.tsx` | Group list with search/filter |
| `apps/admin/src/pages/GroupDetailPage.tsx` | Group detail + moderation |
| `apps/admin/src/pages/AuditLogPage.tsx` | Audit log table |

### Modified Files
| File | Change |
|------|--------|
| `apps/api/src/types.ts` | Add `adminRole?` to Variables |
| `apps/api/src/middleware/auth.ts` | Add `is_active` check after JWT verification |
| `apps/api/src/middleware/cors.ts` | Add PATCH method + admin origins |
| `apps/api/src/routes/users.ts` | Add `role`, `is_active` to GET /me SELECT |
| `apps/api/src/index.ts` | Register admin routes + middleware |
| `packages/shared/src/types.ts` | Add `UserRole` type, `role` + `is_active` to User interface |
| `packages/shared/src/schemas.ts` | Add admin Zod schemas |

---

## Task 1: Database Migration

**Files:**
- Create: `apps/api/migrations/0031_admin_portal.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 0031: Admin portal — role, is_active, audit log, activity feed indexes

-- Add role and is_active to users
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_users_role ON users(role);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  admin_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);

-- Activity feed indexes (tables lack created_at indexes)
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_groups_created ON susu_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_contributions_created ON susu_contributions(contributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_payouts_created ON susu_payouts(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_members_joined ON susu_members(joined_at DESC);
```

- [ ] **Step 2: Apply to production**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --remote --file=migrations/0031_admin_portal.sql`

- [ ] **Step 3: Promote Ozzy to superadmin**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --remote --command="UPDATE users SET role = 'superadmin' WHERE id = '21c60362883feb005a1e6cc757f268e6'"`

- [ ] **Step 4: Commit**

```bash
git add apps/api/migrations/0031_admin_portal.sql
git commit -m "feat(api): admin portal migration — role, is_active, audit log, activity indexes"
```

---

## Task 2: Shared Types & Schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add UserRole and update User interface in types.ts**

In `packages/shared/src/types.ts`, add before the User interface:
```typescript
export type UserRole = 'user' | 'admin' | 'superadmin';
```

Add `role: UserRole;` and `is_active: 0 | 1;` to the User interface (after `onboarding_completed`).

- [ ] **Step 2: Add admin schemas to schemas.ts**

Add at the end of `packages/shared/src/schemas.ts` (before the notification re-exports):

```typescript
// Admin schemas
export const adminPinResetSchema = z.object({
  pin: pinSchema,
});

export const adminRoleChangeSchema = z.object({
  role: z.enum(['user', 'admin', 'superadmin']),
});
```

Note: `pinSchema` is already defined in the same file (line 12) — reuse it to get the weak-PIN blocklist.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat(shared): add UserRole type, is_active field, and admin Zod schemas"
```

---

## Task 3: Auth Middleware + CORS + Users Route Updates

**Files:**
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/src/middleware/cors.ts`
- Modify: `apps/api/src/routes/users.ts`
- Create: `apps/api/src/middleware/admin.ts`

- [ ] **Step 1: Extend Variables in types.ts**

Add `adminRole` to the Variables interface:
```typescript
export interface Variables {
  userId: string;
  adminRole?: 'admin' | 'superadmin';
}
```

- [ ] **Step 2: Add is_active check to auth middleware**

In `apps/api/src/middleware/auth.ts`, after `c.set('userId', payload.sub)` (line 32) and before `await next()`, add:

```typescript
  // Check if user is deactivated
  const user = await c.env.DB.prepare(
    'SELECT is_active FROM users WHERE id = ?'
  ).bind(payload.sub).first<{ is_active: number }>();

  if (!user || user.is_active === 0) {
    return c.json(
      { error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated' } },
      403
    );
  }
```

- [ ] **Step 3: Create admin middleware**

Create `apps/api/src/middleware/admin.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

/**
 * Admin authorization middleware.
 * Must run AFTER authMiddleware. Checks user role is admin or superadmin.
 */
export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).bind(userId).first<{ role: string }>();

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      403
    );
  }

  c.set('adminRole', user.role as 'admin' | 'superadmin');
  await next();
});
```

- [ ] **Step 4: Add PATCH to CORS and admin origins**

In `apps/api/src/middleware/cors.ts`:

Add to the `allowed` array:
```typescript
'https://admin.cedisense.pages.dev',
```

Add admin preview deploy pattern after the existing Pages preview regex:
```typescript
if (origin?.match(/^https:\/\/[a-f0-9]{8}\.admin\.cedisense\.pages\.dev$/)) {
  return origin;
}
```

Add `'PATCH'` to `allowMethods`:
```typescript
allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
```

- [ ] **Step 5: Add role and is_active to /users/me SELECT**

In `apps/api/src/routes/users.ts`, update the SELECT on line 14:
```sql
SELECT id, phone, name, monthly_income_ghs, preferred_language, onboarding_completed, role, is_active, created_at, updated_at
FROM users WHERE id = ?
```

Also update the PUT /me handler's SELECT if it has one.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/middleware/ apps/api/src/routes/users.ts
git commit -m "feat(api): admin middleware, is_active auth check, CORS PATCH, role in /users/me"
```

---

## Task 4: Audit Log Helper

**Files:**
- Create: `apps/api/src/lib/audit.ts`

- [ ] **Step 1: Create the audit helper**

```typescript
// apps/api/src/lib/audit.ts
import { generateId } from './db.js';

interface AuditEntry {
  adminId: string;
  action: string;
  targetType: 'user' | 'group' | 'member' | 'message';
  targetId: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin action to the audit trail.
 */
export async function logAuditAction(db: D1Database, entry: AuditEntry): Promise<void> {
  await db.prepare(
    `INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    generateId(),
    entry.adminId,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.details ? JSON.stringify(entry.details) : null,
  ).run();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/audit.ts
git commit -m "feat(api): add audit log helper for admin actions"
```

---

## Task 5: Admin Dashboard Routes

**Files:**
- Create: `apps/api/src/routes/admin/dashboard.ts`

- [ ] **Step 1: Create the dashboard routes**

```typescript
// apps/api/src/routes/admin/dashboard.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /admin/dashboard — key metrics
dashboard.get('/dashboard', async (c) => {
  const [totalUsers, totalGroups, activeGroups, volume, newSignups] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM susu_groups').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM susu_groups WHERE is_active = 1').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COALESCE(SUM(amount_pesewas), 0) as total FROM susu_contributions').first<{ total: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE created_at > datetime('now', '-7 days')").first<{ count: number }>(),
  ]);

  return c.json({
    data: {
      total_users: totalUsers?.count ?? 0,
      total_groups: totalGroups?.count ?? 0,
      active_groups: activeGroups?.count ?? 0,
      total_contribution_volume_pesewas: volume?.total ?? 0,
      new_signups_this_week: newSignups?.count ?? 0,
    },
  });
});

// GET /admin/activity — recent activity feed
dashboard.get('/activity', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);
  const fetchLimit = limit + 1;

  let hasCursor = false;
  let cursorTs = '';
  if (cursor) {
    try {
      const parsed = JSON.parse(atob(cursor));
      cursorTs = parsed.ts;
      hasCursor = true;
    } catch { /* invalid cursor */ }
  }

  const cf = hasCursor ? 'AND' : '-- no cursor AND'; // cursor filter prefix

  // UNION ALL across 7 source tables, 30-day window, sorted by timestamp
  // Each sub-query uses its own timestamp column with optional cursor filter
  const query = `
    SELECT 'signup:' || id AS id, 'signup' AS type, name AS actor_name,
           name || ' joined CediSense' AS description, created_at AS ts
    FROM users WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'group_created:' || id AS id, 'group_created' AS type,
           (SELECT name FROM users WHERE id = sg.creator_id) AS actor_name,
           'Created group "' || name || '"' AS description, created_at AS ts
    FROM susu_groups sg WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'contribution:' || sc.id AS id, 'contribution' AS type,
           sm.display_name AS actor_name,
           sm.display_name || ' contributed to ' || (SELECT name FROM susu_groups WHERE id = sc.group_id) AS description,
           sc.contributed_at AS ts
    FROM susu_contributions sc
    JOIN susu_members sm ON sc.member_id = sm.id
    WHERE sc.contributed_at > datetime('now', '-30 days') ${hasCursor ? 'AND sc.contributed_at < ?' : ''}

    UNION ALL

    SELECT 'payout:' || sp.id AS id, 'payout' AS type,
           sm.display_name AS actor_name,
           sm.display_name || ' received payout from ' || (SELECT name FROM susu_groups WHERE id = sp.group_id) AS description,
           sp.paid_at AS ts
    FROM susu_payouts sp
    JOIN susu_members sm ON sp.member_id = sm.id
    WHERE sp.paid_at > datetime('now', '-30 days') ${hasCursor ? 'AND sp.paid_at < ?' : ''}

    UNION ALL

    SELECT 'member_joined:' || id AS id, 'member_joined' AS type,
           display_name AS actor_name,
           display_name || ' joined ' || (SELECT name FROM susu_groups WHERE id = sm2.group_id) AS description,
           joined_at AS ts
    FROM susu_members sm2 WHERE joined_at > datetime('now', '-30 days') ${hasCursor ? 'AND joined_at < ?' : ''}

    UNION ALL

    SELECT 'claim_filed:' || id AS id, 'claim_filed' AS type,
           (SELECT display_name FROM susu_members WHERE id = fc.claimant_member_id) AS actor_name,
           'Funeral claim filed in ' || (SELECT name FROM susu_groups WHERE id = fc.group_id) AS description,
           created_at AS ts
    FROM funeral_claims fc WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'claim_filed:w' || id AS id, 'claim_filed' AS type,
           (SELECT display_name FROM susu_members WHERE id = wc.claimant_member_id) AS actor_name,
           wc.claim_type || ' claim filed in ' || (SELECT name FROM susu_groups WHERE id = wc.group_id) AS description,
           created_at AS ts
    FROM welfare_claims wc WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    ORDER BY ts DESC LIMIT ?
  `;

  // Build bind params — each sub-query with cursor needs the cursor timestamp
  const subQueryCount = 7; // 7 sub-queries in the UNION ALL
  const binds: (string | number)[] = [];
  if (hasCursor) {
    for (let i = 0; i < subQueryCount; i++) {
      binds.push(cursorTs);
    }
  }
  binds.push(fetchLimit);

  const result = await c.env.DB.prepare(query).bind(...binds).all<{
    id: string; type: string; actor_name: string; description: string; ts: string;
  }>();

  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor = has_more && lastItem
    ? btoa(JSON.stringify({ ts: lastItem.ts }))
    : null;

  return c.json({
    data: {
      items: items.map(r => ({
        id: r.id,
        type: r.type,
        actor_name: r.actor_name ?? 'Unknown',
        description: r.description,
        timestamp: r.ts,
      })),
      cursor: nextCursor,
      has_more,
    },
  });
});

export default dashboard;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin/dashboard.ts
git commit -m "feat(api): admin dashboard routes — metrics and activity feed"
```

---

## Task 6: Admin User Management Routes

**Files:**
- Create: `apps/api/src/routes/admin/users.ts`

- [ ] **Step 1: Create the user management routes**

Read the spec at `docs/superpowers/specs/2026-03-24-admin-portal-design.md`, User Management Routes section.

Implement these routes in `apps/api/src/routes/admin/users.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/users` | Paginated list with `?q=` search (LIKE on phone/name), `?role=` filter, `?status=` filter (active/inactive), cursor pagination |
| `GET` | `/users/:id` | Full detail: user profile + account count + group count + transaction count + trust score |
| `PATCH` | `/users/:id/deactivate` | Set `is_active = 0`, log to audit |
| `PATCH` | `/users/:id/reactivate` | Set `is_active = 1`, log to audit |
| `POST` | `/users/:id/reset-pin` | Validate with `adminPinResetSchema`, hash with `hashPin()`, update `auth_methods`, log to audit |
| `PATCH` | `/users/:id/role` | Validate with `adminRoleChangeSchema`, superadmin only (`c.get('adminRole') === 'superadmin'`), cannot demote self, log to audit |

Use the `logAuditAction()` helper from `../../lib/audit.js` for all mutating actions.

Use `hashPin()` from `../../lib/hash.js` for PIN reset.

Import schemas from `@cedisense/shared`: `adminPinResetSchema`, `adminRoleChangeSchema`.

Response shapes follow `{ data: ... }` envelope. User list returns `{ data: { items, cursor, has_more } }`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin/users.ts
git commit -m "feat(api): admin user management — list, detail, deactivate, PIN reset, role change"
```

---

## Task 7: Admin Group Management Routes

**Files:**
- Create: `apps/api/src/routes/admin/groups.ts`

- [ ] **Step 1: Create the group management routes**

Read the spec, Susu Group Management Routes section.

Implement in `apps/api/src/routes/admin/groups.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/groups` | Paginated list with `?q=` search (LIKE on name), `?variant=` filter, `?active=` filter, cursor pagination |
| `GET` | `/groups/:id` | Full detail: group info + members list + contribution count + payout count + recent messages (last 20) + active claims |
| `PATCH` | `/groups/:id/deactivate` | Set `is_active = 0`, log to audit |
| `PATCH` | `/groups/:id/reactivate` | Set `is_active = 1`, log to audit |
| `DELETE` | `/groups/:id/members/:memberId` | Delete from `susu_members`, log to audit |
| `DELETE` | `/groups/:id/messages/:messageId` | Soft-delete: set `deleted_at = datetime('now')` on `susu_messages`, log to audit |

All mutations log to audit via `logAuditAction()`.

Group list response: `{ data: { items, cursor, has_more } }`.

Group detail response includes nested data:
```typescript
{
  data: {
    ...groupFields,
    members: MemberRow[],
    contribution_count: number,
    payout_count: number,
    recent_messages: MessageRow[],
    active_claims: ClaimRow[],
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin/groups.ts
git commit -m "feat(api): admin group management — list, detail, deactivate, remove member, delete message"
```

---

## Task 8: Admin Audit Log Route + Route Aggregator + Index Registration

**Files:**
- Create: `apps/api/src/routes/admin/audit.ts`
- Create: `apps/api/src/routes/admin/index.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create audit log route**

```typescript
// apps/api/src/routes/admin/audit.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';

const audit = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /admin/audit-log
audit.get('/audit-log', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);
  const adminIdFilter = c.req.query('admin_id');
  const actionFilter = c.req.query('action');
  const targetTypeFilter = c.req.query('target_type');
  const fetchLimit = limit + 1;

  let where = 'WHERE 1=1';
  const binds: (string | number)[] = [];

  if (adminIdFilter) { where += ' AND a.admin_id = ?'; binds.push(adminIdFilter); }
  if (actionFilter) { where += ' AND a.action = ?'; binds.push(actionFilter); }
  if (targetTypeFilter) { where += ' AND a.target_type = ?'; binds.push(targetTypeFilter); }

  if (cursor) {
    try {
      const { ts, id } = JSON.parse(atob(cursor));
      where += ' AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?))';
      binds.push(ts, ts, id);
    } catch { /* invalid cursor */ }
  }

  binds.push(fetchLimit);

  const result = await c.env.DB.prepare(`
    SELECT a.*, u.name as admin_name
    FROM admin_audit_log a
    JOIN users u ON a.admin_id = u.id
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?
  `).bind(...binds).all();

  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1] as any;
  const nextCursor = has_more && lastItem
    ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
    : null;

  return c.json({ data: { items, cursor: nextCursor, has_more } });
});

export default audit;
```

- [ ] **Step 2: Create admin route aggregator**

```typescript
// apps/api/src/routes/admin/index.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import dashboard from './dashboard.js';
import users from './users.js';
import groups from './groups.js';
import audit from './audit.js';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

admin.route('/', dashboard);
admin.route('/', users);
admin.route('/', groups);
admin.route('/', audit);

export { admin };
```

- [ ] **Step 3: Register admin routes in index.ts**

In `apps/api/src/index.ts`:

Add import:
```typescript
import { admin } from './routes/admin/index.js';
import { adminMiddleware } from './middleware/admin.js';
```

Add middleware registration (after the notifications middleware block):
```typescript
// Admin portal
app.use('/api/v1/admin', authMiddleware, rateLimitMiddleware, adminMiddleware);
app.use('/api/v1/admin/*', authMiddleware, rateLimitMiddleware, adminMiddleware);
```

Additionally, add per-action rate limiting for destructive admin actions. In the admin user routes file (`apps/api/src/routes/admin/users.ts`), add a KV-based rate check at the top of the `reset-pin` and `role` handlers:

```typescript
// Stricter rate limit: 10 per minute for destructive actions
const adminId = c.get('userId');
const actionKey = `rate:admin-action:${adminId}`;
const count = parseInt(await c.env.KV.get(actionKey) ?? '0', 10);
if (count >= 10) {
  return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many admin actions. Wait a minute.' } }, 429);
}
await c.env.KV.put(actionKey, String(count + 1), count === 0 ? { expirationTtl: 60 } : undefined);
```

This mirrors the existing rate limit pattern in `apps/api/src/middleware/rate-limit.ts`.

Add route mount (after notifications route):
```typescript
app.route('/api/v1/admin', admin);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 5: Deploy API**

Run: `cd apps/api && npx wrangler deploy`

- [ ] **Step 6: Test admin dashboard endpoint**

```bash
# Login, get token, call admin endpoint
curl -s -X POST https://cedisense-api.ghwmelite.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0540125882","pin":"1118"}' | node -e "
process.stdin.on('data', d => {
  const token = JSON.parse(d).data.accessToken;
  fetch('https://cedisense-api.ghwmelite.workers.dev/api/v1/admin/dashboard', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2)));
})"
```

Expected: `{ data: { total_users: 1, total_groups: 0, ... } }`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/admin/ apps/api/src/index.ts
git commit -m "feat(api): admin route aggregator, audit log route, register in index.ts"
```

---

## Task 9: Admin Frontend — Project Scaffold

**Files:**
- Create: entire `apps/admin/` directory structure

- [ ] **Step 1: Initialize the admin app**

Create `apps/admin/package.json` with the same React/Vite/Tailwind dependencies as `apps/web/package.json`, minus `recharts` and `qrcode.react` (not needed for admin).

Create `apps/admin/vite.config.ts` — same as `apps/web/vite.config.ts` but dev proxy port 5174:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

Create `apps/admin/tailwind.config.ts` — copy from `apps/web/tailwind.config.ts` exactly (same design tokens).

Create `apps/admin/tsconfig.json` — copy from `apps/web/tsconfig.json`.

Create `apps/admin/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CediSense Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/admin/public/_redirects`:
```
/api/v1/* https://cedisense-api.ghwmelite.workers.dev/api/v1/:splat 200
/* /index.html 200
```

Create `apps/admin/postcss.config.js` (required for Vite + Tailwind CSS processing):
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Copy `apps/web/public/favicon.svg` to `apps/admin/public/favicon.svg`.

- [ ] **Step 2: Install dependencies**

Run: `cd apps/admin && npm install`

- [ ] **Step 3: Commit**

```bash
git add apps/admin/
git commit -m "feat(admin): scaffold admin app — Vite, Tailwind, TypeScript config"
```

---

## Task 10: Admin Frontend — API Client + Auth Context

**Files:**
- Create: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/contexts/AuthContext.tsx`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/index.css`

- [ ] **Step 1: Create simplified API client**

Create `apps/admin/src/lib/api.ts` — simplified version of `apps/web/src/lib/api.ts` without offline support, IndexedDB caching, or sync queue. Just fetch with auth headers.

```typescript
import type { ApiSuccess, ApiError } from '@cedisense/shared';

const API_BASE = '/api/v1';
let accessToken: string | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;

  const json = await response.json();
  if (!response.ok) {
    const error = json as ApiError;
    throw new ApiRequestError(error.error.message, error.error.code, response.status, error.error.details);
  }

  return (json as ApiSuccess<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Create admin auth context**

Create `apps/admin/src/contexts/AuthContext.tsx` — same pattern as consumer app but with role check. After login + fetchUser, check `user.role` — if not admin/superadmin, throw error "Access denied".

Key differences from consumer AuthContext:
- After `setUser(userData)`, check `userData.role !== 'user'` — if it's a regular user, call `logout()` and throw
- No `register` method — admins don't register through the admin portal

- [ ] **Step 3: Create entry files**

Create `apps/admin/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

Create `apps/admin/src/index.css` — import Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Plus copy the essential design token CSS custom properties from `apps/web/src/index.css` (colors, fonts, etc.).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(admin): API client, auth context with role check, entry files"
```

---

## Task 11: Admin Frontend — Layout Components

**Files:**
- Create: `apps/admin/src/components/layout/AdminShell.tsx`
- Create: `apps/admin/src/components/layout/AdminProtectedRoute.tsx`
- Create: `apps/admin/src/App.tsx`

- [ ] **Step 1: Create AdminProtectedRoute**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghana-dark">
        <div className="text-gold text-xl animate-pulse">₵</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create AdminShell**

Desktop-first sidebar layout:
- Left sidebar (w-64): CediSense Admin logo, nav links (Dashboard, Users, Groups, Audit Log), user info at bottom
- Main content area: top bar with page title, content below
- Dark theme: `bg-ghana-dark` sidebar, `bg-surface` content area
- SVG icons for nav items (not emoji)
- Active nav link highlighted with `bg-white/[0.06]` + `text-gold`

The shell wraps child routes via `<Outlet />`.

- [ ] **Step 3: Create App.tsx with router**

```tsx
import { Routes, Route } from 'react-router-dom';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminProtectedRoute } from '@/components/layout/AdminProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/pages/UsersPage';
import UserDetailPage from '@/pages/UserDetailPage';
import GroupsPage from '@/pages/GroupsPage';
import GroupDetailPage from '@/pages/GroupDetailPage';
import AuditLogPage from '@/pages/AuditLogPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminProtectedRoute><AdminShell /></AdminProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/:id" element={<GroupDetailPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/
git commit -m "feat(admin): AdminShell layout, protected route, router setup"
```

---

## Task 12: Admin Frontend — Shared Components

**Files:**
- Create: `apps/admin/src/components/shared/DataTable.tsx`
- Create: `apps/admin/src/components/shared/MetricCard.tsx`
- Create: `apps/admin/src/components/shared/ConfirmModal.tsx`

- [ ] **Step 1: Create DataTable**

A reusable paginated table component:
- Props: `columns` (header labels + accessor keys), `data` (rows), `isLoading`, `hasMore`, `onLoadMore`, `onRowClick?`, `emptyMessage`
- Skeleton loading state (3 rows of shimmer)
- Hover effect on rows
- "Load more" button at bottom
- Dark theme styling: `bg-surface` table, `bg-elevated/50` hover, `border-white/5` dividers

- [ ] **Step 2: Create MetricCard**

Props: `label` (string), `value` (string | number), `icon?` (ReactNode)
- Rounded card with `bg-elevated` background
- Large value text (`text-2xl font-bold text-white`)
- Smaller label (`text-sm text-white/50`)
- Optional icon in top-right

- [ ] **Step 3: Create ConfirmModal**

Props: `open`, `onClose`, `onConfirm`, `title`, `description`, `confirmLabel`, `variant` ('danger' | 'warning')
- Backdrop blur overlay
- Card with title, description, Cancel + Confirm buttons
- Danger variant: red confirm button. Warning variant: gold confirm button
- Escape to close, backdrop click to close

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/shared/
git commit -m "feat(admin): DataTable, MetricCard, ConfirmModal shared components"
```

---

## Task 13: Admin Frontend — Login Page

**Files:**
- Create: `apps/admin/src/pages/LoginPage.tsx`

- [ ] **Step 1: Create the admin login page**

Similar to consumer login but simpler:
- Centered card on dark background
- CediSense Admin branding (logo + "Admin Portal" text)
- Phone input + PIN input (same pattern as consumer LoginForm)
- Submit calls `login()` from auth context
- On success, navigate to `/`
- On auth context rejection (non-admin role), show "Access denied — admin privileges required"
- No "Create account" link — admins are promoted from existing users

Use `requestAnimationFrame(() => navigate('/'))` after login success (same fix as consumer app).

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/pages/LoginPage.tsx
git commit -m "feat(admin): admin login page with role check"
```

---

## Task 14: Admin Frontend — Dashboard Page

**Files:**
- Create: `apps/admin/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create the dashboard page**

- Fetch `GET /admin/dashboard` on mount → display 5 MetricCards in a grid
- Fetch `GET /admin/activity` on mount → display activity feed as a table
- Activity table columns: Timestamp (relative), Type (badge), Actor, Description
- Type badges: color-coded chips (green=signup, blue=group_created, gold=contribution, purple=payout, gray=member_joined)
- "Load more" button for activity feed pagination
- Format contribution volume from pesewas to GHS (divide by 100, add ₵ prefix)

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/pages/DashboardPage.tsx
git commit -m "feat(admin): dashboard page with metrics and activity feed"
```

---

## Task 15: Admin Frontend — Users Pages

**Files:**
- Create: `apps/admin/src/pages/UsersPage.tsx`
- Create: `apps/admin/src/pages/UserDetailPage.tsx`

- [ ] **Step 1: Create UsersPage**

- Search input (debounced 300ms) that sets `?q=` param
- Role filter dropdown (All, User, Admin, Superadmin)
- Status filter dropdown (All, Active, Inactive)
- DataTable with columns: Name, Phone, Role (badge), Groups, Created, Status
- Click row → navigate to `/users/:id`

- [ ] **Step 2: Create UserDetailPage**

- Fetch `GET /admin/users/:id` on mount
- Profile card: name, phone, email, country, role (badge), status, created date
- Quick actions section:
  - **Reset PIN** button → opens modal with PIN input (4 digits) + confirm button → `POST /admin/users/:id/reset-pin`
  - **Deactivate/Reactivate** toggle → ConfirmModal → `PATCH /admin/users/:id/deactivate` or `/reactivate`
  - **Change Role** dropdown (superadmin only) → ConfirmModal → `PATCH /admin/users/:id/role`
- Tabs: Groups (table of user's Susu groups), Accounts (table of user's accounts)

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/pages/UsersPage.tsx apps/admin/src/pages/UserDetailPage.tsx
git commit -m "feat(admin): users list page and user detail page with actions"
```

---

## Task 16: Admin Frontend — Groups Pages

**Files:**
- Create: `apps/admin/src/pages/GroupsPage.tsx`
- Create: `apps/admin/src/pages/GroupDetailPage.tsx`

- [ ] **Step 1: Create GroupsPage**

- Search input (debounced) for group name
- Variant filter dropdown (All, Rotating, Accumulating, Goal-based, etc.)
- Active filter dropdown (All, Active, Inactive)
- DataTable: Name, Variant (badge), Members, Contribution (GHS), Frequency, Rounds, Status
- Click row → navigate to `/groups/:id`

- [ ] **Step 2: Create GroupDetailPage**

- Fetch `GET /admin/groups/:id` on mount
- Group info card: name, variant, creator, invite code, contribution, frequency, current round, status
- Quick actions: Deactivate/Reactivate toggle with ConfirmModal
- Tabs:
  - **Members** — table with Name, Payout Order, Joined Date. Remove button per row → ConfirmModal → `DELETE /admin/groups/:id/members/:memberId`
  - **Contributions** — table with Member, Amount (GHS), Round, Date
  - **Chat** — message list with sender, content, date. Delete button per message → ConfirmModal → `DELETE /admin/groups/:id/messages/:messageId`
  - **Claims** — table with Type, Claimant, Amount, Status, Date

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/pages/GroupsPage.tsx apps/admin/src/pages/GroupDetailPage.tsx
git commit -m "feat(admin): groups list page and group detail page with moderation"
```

---

## Task 17: Admin Frontend — Audit Log Page

**Files:**
- Create: `apps/admin/src/pages/AuditLogPage.tsx`

- [ ] **Step 1: Create AuditLogPage**

- Fetch `GET /admin/audit-log` on mount
- Filter dropdowns: Admin (dropdown of admin users), Action type, Target type
- DataTable: Timestamp, Admin, Action (badge), Target Type, Target ID, Details (truncated JSON)
- Cursor pagination with "Load more"

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/pages/AuditLogPage.tsx
git commit -m "feat(admin): audit log page with filters"
```

---

## Task 18: Build, Deploy, and Verify

**Files:**
- No new files

- [ ] **Step 1: Full TypeScript check**

Run: `cd apps/api && npx tsc --noEmit` and `cd apps/admin && npx tsc --noEmit`

- [ ] **Step 2: Build admin app**

Run: `cd apps/admin && npm run build`

- [ ] **Step 3: Deploy API**

Run: `cd apps/api && npx wrangler deploy`

- [ ] **Step 4: Deploy admin frontend**

Run: `cd apps/admin && npx wrangler pages deploy dist --project-name cedisense-admin`

Note: This creates a NEW Pages project called `cedisense-admin`. First deploy will prompt for project creation.

- [ ] **Step 5: Verify end-to-end**

1. Open `admin.cedisense.pages.dev` (or the preview URL)
2. Login with phone `0540125882`, PIN `1118`
3. Dashboard shows metrics (1 user, 0 groups)
4. Users page shows Osborn Hodges as superadmin
5. Click user → detail page loads
6. Groups page shows empty list
7. Audit log page shows empty list

- [ ] **Step 6: Final commit and push**

```bash
git add -A
git commit -m "feat: CediSense admin portal Phase 1 — complete"
git push origin master
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | Database migration — role, is_active, audit log table, activity feed indexes |
| 2 | Shared types — UserRole, is_active, admin Zod schemas |
| 3 | Auth middleware + CORS + admin middleware + /users/me role field |
| 4 | Audit log helper function |
| 5 | Admin dashboard routes (metrics + activity feed) |
| 6 | Admin user management routes (list, detail, deactivate, PIN reset, role change) |
| 7 | Admin group management routes (list, detail, deactivate, remove member, delete message) |
| 8 | Audit log route + admin route aggregator + index.ts registration + API deploy |
| 9 | Admin frontend scaffold (Vite, Tailwind, TypeScript, _redirects) |
| 10 | API client + auth context with role check |
| 11 | AdminShell layout + protected route + router |
| 12 | Shared components (DataTable, MetricCard, ConfirmModal) |
| 13 | Login page |
| 14 | Dashboard page (metrics + activity feed) |
| 15 | Users list + user detail pages with actions |
| 16 | Groups list + group detail pages with moderation |
| 17 | Audit log page |
| 18 | Build, deploy, verify end-to-end |
