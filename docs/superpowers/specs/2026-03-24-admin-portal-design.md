# CediSense Admin Portal Design — Phase 1

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Auth & access control, user management, Susu group management, dashboard with metrics + activity feed

---

## Overview

CediSense has no admin interface. All platform management currently requires raw SQL via `wrangler d1 execute`. This design introduces a separate admin portal with role-based access control, user management (view, search, deactivate, PIN reset), Susu group moderation (deactivate, remove members, delete messages), and a dashboard with key metrics and a recent activity feed.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Admin identity | `role` column on existing `users` table | Reuses phone+PIN auth, no new auth system |
| Role levels | `user`, `admin`, `superadmin` | Superadmin can promote/demote admins, prevents lateral escalation |
| Frontend | Separate `apps/admin` Cloudflare Pages app | Clean isolation from consumer app, desktop-first design, independent deploys |
| Backend | Admin routes on existing Worker at `/api/v1/admin/*` | One deployment, shared D1/KV/R2 bindings, simple |
| User management | View + search + deactivate + PIN reset | Covers 90% of day-one support needs without risky data editing |
| Group management | View + moderate (deactivate, remove members, delete messages) | Handles bad actors without exposing financial record editing |
| Dashboard | Key metrics + recent activity feed | Big picture + situational awareness, no alert rules to define yet |
| Audit logging | `admin_audit_log` table | Every admin action tracked for accountability |
| Activity feed | UNION ALL query on existing tables | Zero maintenance, always accurate, no event duplication |

---

## Database Changes

All changes in a single migration file: `apps/api/migrations/0031_admin_portal.sql`

### Column additions to `users` table

```sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
```

- `role`: `'user'` | `'admin'` | `'superadmin'`
- `is_active`: `1` (active) | `0` (deactivated). Auth middleware rejects login if `is_active = 0`.

**Index:** `(role)` — for admin user listing filtered by role.

Promote the platform owner (use wrangler command after migration, not embedded in migration file):
```bash
npx wrangler d1 execute cedisense-db --remote --command="UPDATE users SET role = 'superadmin' WHERE id = '21c60362883feb005a1e6cc757f268e6'"
```

### Auth middleware change

The existing `authMiddleware` in `apps/api/src/middleware/auth.ts` must be updated to reject deactivated users. After verifying the JWT and extracting `userId`, add:

```typescript
const user = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?').bind(userId).first();
if (!user || user.is_active === 0) {
  return c.json({ error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated' } }, 403);
}
```

### `/users/me` route change

The existing `GET /users/me` in `apps/api/src/routes/users.ts` must include `role` in the SELECT query so the admin frontend can check the user's role after login. This also means the consumer app will receive the `role` field — this is acceptable since the role value is not sensitive.

### New table: `admin_audit_log`

Uses TEXT PK with `generateId()` for consistency with all other tables in the codebase.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `DEFAULT (lower(hex(randomblob(16))))` — matches codebase convention |
| `admin_id` | TEXT NOT NULL | FK → users.id — the admin who performed the action |
| `action` | TEXT NOT NULL | `user_deactivated`, `user_reactivated`, `pin_reset`, `role_changed`, `group_deactivated`, `group_reactivated`, `member_removed`, `message_deleted` |
| `target_type` | TEXT NOT NULL | `user`, `group`, `member`, `message` |
| `target_id` | TEXT NOT NULL | ID of the affected entity |
| `details` | TEXT | Nullable JSON with context (e.g. `{"reason": "spam", "old_role": "user", "new_role": "admin"}`) |
| `created_at` | TEXT NOT NULL DEFAULT (datetime('now')) | |

**Indexes:**
- `(admin_id, created_at DESC)` — audit trail per admin
- `(target_type, target_id)` — lookup actions on a specific entity
- `(created_at DESC)` — chronological feed

---

## Admin API Routes

Mounted at `/api/v1/admin/*`. All routes require `authMiddleware` + `adminMiddleware`.

### Admin Middleware

Runs after `authMiddleware`. Queries `users.role` for the authenticated user. Returns 403 if role is not `admin` or `superadmin`. Sets `c.set('adminRole', role)` for downstream handlers.

### Dashboard Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/dashboard` | Key metrics: total users, total groups, active groups, total contribution volume (pesewas), new signups this week |
| `GET` | `/admin/activity` | Recent activity feed, cursor-paginated. Aggregates from users, susu_groups, susu_contributions, susu_payouts, funeral_claims, welfare_claims, susu_members |

**Dashboard metrics response:**
```typescript
{
  data: {
    total_users: number;
    total_groups: number;
    active_groups: number;
    total_contribution_volume_pesewas: number;
    new_signups_this_week: number;
  }
}
```

**Activity feed response:**
```typescript
{
  data: {
    items: ActivityEvent[];
    cursor: string | null;
    has_more: boolean;
  }
}

interface ActivityEvent {
  id: string;
  type: 'signup' | 'group_created' | 'contribution' | 'payout' | 'claim_filed' | 'member_joined';
  actor_name: string;
  description: string;
  timestamp: string;
}
```

Activity feed uses a UNION ALL query across source tables, sorted by timestamp DESC, with cursor pagination. Each sub-query filters `created_at > datetime('now', '-30 days')` to bound scan size and avoid hitting D1 CPU limits. Each source table already has indexes on `created_at`. Activity event IDs are prefixed with event type to avoid cross-table collisions (e.g., `signup:abc123`, `contribution:def456`).

**Required indexes:** Several source tables lack `created_at` indexes. Migration 0031 must add:
```sql
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_groups_created ON susu_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_contributions_created ON susu_contributions(contributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_payouts_created ON susu_payouts(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_susu_members_joined ON susu_members(joined_at DESC);
```

**Performance fallback:** If the UNION ALL becomes a bottleneck at scale, migrate to a denormalized `admin_activity` table populated by application-level writes (similar to the notification fan-out pattern).

### User Management Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/users` | Paginated user list. Query: `?q=` (search phone/name), `?role=`, `?status=`, `?cursor=`, `?limit=` |
| `GET` | `/admin/users/:id` | Full user detail: profile, accounts, groups, transaction count, trust score |
| `PATCH` | `/admin/users/:id/deactivate` | Soft-deactivate user. Logs to audit |
| `PATCH` | `/admin/users/:id/reactivate` | Reactivate user. Logs to audit |
| `POST` | `/admin/users/:id/reset-pin` | Body: `{ pin: string }`. Hashes and updates PIN. Logs to audit (does NOT store new PIN in log) |
| `PATCH` | `/admin/users/:id/role` | Body: `{ role: 'user' | 'admin' | 'superadmin' }`. Superadmin only. Cannot demote self. Logs to audit |

**User deactivation:** Sets `is_active = 0` on the `users` table. The `authMiddleware` rejects login attempts from deactivated users with error code `ACCOUNT_DEACTIVATED`. A deactivated user's existing Susu group memberships remain intact but they cannot log in to contribute or access the app. Handling of in-flight contributions for deactivated users is out of scope for Phase 1.

### Susu Group Management Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/groups` | Paginated group list. Query: `?q=` (search name), `?variant=`, `?active=`, `?cursor=`, `?limit=` |
| `GET` | `/admin/groups/:id` | Full group detail: info, members, contributions, payouts, chat messages (paginated), claims |
| `PATCH` | `/admin/groups/:id/deactivate` | Set `is_active = 0`. Blocks new contributions and payouts. Pending claims remain open. Logs to audit |
| `PATCH` | `/admin/groups/:id/reactivate` | Set `is_active = 1`. Re-enables contributions and payouts. Logs to audit |
| `DELETE` | `/admin/groups/:id/members/:memberId` | Remove member from group. Logs to audit |
| `DELETE` | `/admin/groups/:id/messages/:messageId` | Soft-delete message (set `deleted_at`). Logs to audit |

### Audit Log Route

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/audit-log` | Paginated audit log. Filter by `?admin_id=`, `?action=`, `?target_type=` |

---

## Admin Frontend App

### Structure

New `apps/admin` directory in monorepo:
```
apps/admin/
  public/
    _redirects          # Proxy /api/v1/* to Workers API
  src/
    components/
      layout/
        AdminShell.tsx  # Sidebar nav + top bar
      shared/
        DataTable.tsx   # Reusable paginated table with search/filter
        MetricCard.tsx  # Stat display card
        ActivityFeed.tsx # Timestamped event list
        ConfirmModal.tsx # Destructive action confirmation
    contexts/
      AuthContext.tsx   # Same pattern as consumer app, checks admin role
    hooks/
      useAdminApi.ts   # API helpers for admin endpoints
    lib/
      api.ts           # Same pattern as consumer app api.ts
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      UsersPage.tsx
      UserDetailPage.tsx
      GroupsPage.tsx
      GroupDetailPage.tsx
      AuditLogPage.tsx
    App.tsx
    main.tsx
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
```

### Tech Stack
React 18, Vite, Tailwind CSS, React Router 6. Imports `@cedisense/shared` for types/schemas.

### Pages

**Login** (`/login`)
- Phone + PIN form (same as consumer app)
- After login, checks `user.role` — rejects non-admin users with "Access denied"

**Dashboard** (`/`)
- Top row: 5 metric cards (total users, total groups, active groups, contribution volume GHS, new signups this week)
- Below: recent activity feed table — timestamp, event type, actor, description
- Activity feed loads on page visit with cursor pagination

**Users** (`/users`)
- Search bar + role/status filter dropdowns
- Data table: name, phone, role, groups count, created date, status
- Click row → user detail

**User Detail** (`/users/:id`)
- Profile card with all user info
- Quick actions: Reset PIN (modal), Deactivate/Reactivate, Change Role (superadmin only)
- Tabs: Groups, Recent Transactions, Accounts

**Groups** (`/groups`)
- Search bar + variant/active filters
- Data table: name, variant, members, contribution, frequency, rounds, status
- Click row → group detail

**Group Detail** (`/groups/:id`)
- Group info card with quick actions (Deactivate/Reactivate)
- Tabs: Members (with remove button), Contributions, Chat (with delete button), Claims

**Audit Log** (`/audit-log`)
- Filterable table of all admin actions — timestamp, admin name, action, target, details

### Styling
- Dark theme matching CediSense design tokens (`bg-ghana-dark`, `bg-surface`, `bg-elevated`, `text-gold`, etc.)
- Desktop-first layout with sidebar navigation
- Reuse same Tailwind config/tokens from consumer app
- Data tables with hover states, alternating row shading, pagination controls

### Navigation (Sidebar)
- Dashboard (home icon)
- Users (people icon)
- Susu Groups (groups icon)
- Audit Log (clipboard icon)

---

## Auth Flow & Security

### Login Flow
1. Admin visits `admin.cedisense.pages.dev` → login page
2. Phone + PIN → `POST /api/v1/auth/login` (existing endpoint)
3. Access token received → `GET /api/v1/users/me`
4. Check `user.role` client-side — if not admin/superadmin, show "Access denied", clear token
5. Admin role also enforced server-side by `adminMiddleware` on every `/admin/*` route

### CORS Updates
Add to allowed origins in `apps/api/src/middleware/cors.ts`:
```
'https://admin.cedisense.pages.dev'
```
Add preview deploy pattern:
```
/^https:\/\/[a-f0-9]{8}\.admin\.cedisense\.pages\.dev$/
```

**Add `PATCH` to allowed methods.** The existing `allowMethods` array is `['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']`. Add `'PATCH'` — required for deactivate/reactivate/role-change endpoints. This also fixes the consumer app's notification mark-read routes which already use PATCH.

### Rate Limiting on Admin Endpoints
Apply `rateLimitMiddleware` to all admin routes (same as consumer routes). Additionally, destructive admin actions (`reset-pin`, `role` change) should have stricter per-action rate limits — max 10 per minute per admin — to mitigate compromised admin sessions.

### PIN Reset Security
- Only admin/superadmin can reset PINs
- Admin provides the new PIN, communicates it to user out-of-band
- Every reset logged to `admin_audit_log` — does NOT store the new PIN value
- The new PIN is hashed using the same `hashPin()` function before storage
- **Known limitation:** Admin briefly knows the plaintext PIN. Phase 2 should add a `pin_must_change` flag that forces the user to set a new PIN on next login

### Role Promotion Security
- Only `superadmin` can change roles
- Cannot demote yourself (prevents lockout)
- All role changes logged to audit trail with old and new role values

---

## Shared Type Changes

### `packages/shared/src/types.ts`

Add `UserRole` type and extend `User` interface:
```typescript
export type UserRole = 'user' | 'admin' | 'superadmin';
```

Add `role: UserRole` and `is_active: 0 | 1` to the existing `User` interface.

### `apps/api/src/types.ts`

Extend `Variables` interface to support admin role:
```typescript
export interface Variables {
  userId: string;
  adminRole?: 'admin' | 'superadmin';
}
```

### `packages/shared/src/schemas.ts`

Add Zod validation schemas for admin endpoints:
- `adminPinResetSchema` — `{ pin: pinSchema }` (reuses existing `pinSchema` which includes format validation AND weak-PIN blocklist)
- `adminRoleChangeSchema` — `{ role: z.enum(['user', 'admin', 'superadmin']) }`

### `packages/shared/src/notification-types.ts`

No changes — admin actions don't generate user-facing notifications in Phase 1.

---

## Future Phases

**Audit log retention:** The `admin_audit_log` table will grow indefinitely. For Phase 1 this is acceptable (low volume). Phase 2 should add a retention policy — purge entries older than 1 year, or archive to R2 as compressed JSON before deletion.

**Phase 2: Financial Analytics Dashboard + Security Hardening**
- Transaction volume charts (daily/weekly/monthly)
- Contribution trends per group variant
- User growth chart
- Top groups by activity
- Revenue/volume projections
- `pin_must_change` flag for forced PIN reset on next login
- Audit log retention/archival policy

**Phase 3: Content Moderation + System Health**
- Flagged content queue (reported messages, disputed claims)
- Alert rules (stale groups, unusual contribution patterns)
- API error rate monitoring
- KV/D1 usage metrics
