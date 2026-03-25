// apps/api/src/routes/admin/users.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { logAuditAction } from '../../lib/audit.js';
import { hashPin } from '../../lib/hash.js';
import { adminPinResetSchema, adminRoleChangeSchema } from '@cedisense/shared';
import { computeTrustScore } from '../../lib/trust-score.js';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── GET /users — paginated list with search/filter ──────────────────────────

users.get('/users', async (c) => {
  const q = c.req.query('q');
  const roleFilter = c.req.query('role');
  const statusFilter = c.req.query('status');
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const fetchLimit = limit + 1;

  // Build WHERE clause
  let where = 'WHERE 1=1';
  const binds: (string | number)[] = [];

  if (q) {
    where += ' AND (phone LIKE ? OR name LIKE ?)';
    const pattern = `%${q}%`;
    binds.push(pattern, pattern);
  }

  if (roleFilter) {
    where += ' AND role = ?';
    binds.push(roleFilter);
  }

  if (statusFilter === 'active') {
    where += ' AND is_active = 1';
  } else if (statusFilter === 'inactive') {
    where += ' AND is_active = 0';
  }

  // Cursor pagination — keyset on (created_at DESC, id DESC)
  if (cursor) {
    try {
      const { ts, id } = JSON.parse(atob(cursor));
      where += ' AND (created_at < ? OR (created_at = ? AND id < ?))';
      binds.push(ts, ts, id);
    } catch { /* invalid cursor — treat as first page */ }
  }

  binds.push(fetchLimit);

  const result = await c.env.DB.prepare(`
    SELECT id, phone, name, role, is_active, onboarding_completed, created_at, updated_at
    FROM users
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).bind(...binds).all<{
    id: string;
    phone: string;
    name: string;
    role: string;
    is_active: number;
    onboarding_completed: number;
    created_at: string;
    updated_at: string;
  }>();

  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor =
    has_more && lastItem
      ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
      : null;

  return c.json({ data: { items, cursor: nextCursor, has_more } });
});

// ─── GET /users/:id — full detail ────────────────────────────────────────────

users.get('/users/:id', async (c) => {
  const userId = c.req.param('id');

  const [user, accountCount, groupCount, txCount, trustStats] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, phone, name, role, is_active, monthly_income_ghs, preferred_language,
              onboarding_completed, created_at, updated_at
       FROM users WHERE id = ?`
    ).bind(userId).first<{
      id: string;
      phone: string;
      name: string;
      role: string;
      is_active: number;
      monthly_income_ghs: number | null;
      preferred_language: string | null;
      onboarding_completed: number;
      created_at: string;
      updated_at: string;
    }>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM accounts WHERE user_id = ?'
    ).bind(userId).first<{ count: number }>(),

    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM susu_members WHERE user_id = ?`
    ).bind(userId).first<{ count: number }>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)'
    ).bind(userId).first<{ count: number }>(),

    c.env.DB.prepare(
      `SELECT
         COUNT(*) as total_contributions,
         SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) as on_time_contributions,
         SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late_contributions,
         0 as missed_contributions,
         (SELECT COUNT(*) FROM susu_groups WHERE creator_id = ? AND is_active = 0
          AND (SELECT COUNT(*) FROM susu_payouts WHERE group_id = susu_groups.id) > 0) as groups_completed
       FROM susu_contributions
       WHERE member_id IN (SELECT id FROM susu_members WHERE user_id = ?)`
    ).bind(userId, userId).first<{
      total_contributions: number;
      on_time_contributions: number;
      late_contributions: number;
      missed_contributions: number;
      groups_completed: number;
    }>(),
  ]);

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const trustScore = trustStats
    ? computeTrustScore({
        total_contributions: trustStats.total_contributions ?? 0,
        on_time_contributions: trustStats.on_time_contributions ?? 0,
        late_contributions: trustStats.late_contributions ?? 0,
        missed_contributions: trustStats.missed_contributions ?? 0,
        groups_completed: trustStats.groups_completed ?? 0,
      })
    : 50;

  return c.json({
    data: {
      ...user,
      account_count: accountCount?.count ?? 0,
      group_count: groupCount?.count ?? 0,
      transaction_count: txCount?.count ?? 0,
      trust_score: trustScore,
    },
  });
});

// ─── PATCH /users/:id/deactivate ─────────────────────────────────────────────

users.patch('/users/:id/deactivate', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT id, is_active FROM users WHERE id = ?'
  ).bind(targetId).first<{ id: string; is_active: number }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
  ).bind(targetId).run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'user.deactivate',
    targetType: 'user',
    targetId,
  });

  return c.json({ data: { success: true } });
});

// ─── PATCH /users/:id/reactivate ─────────────────────────────────────────────

users.patch('/users/:id/reactivate', async (c) => {
  const targetId = c.req.param('id');
  const adminId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT id, is_active FROM users WHERE id = ?'
  ).bind(targetId).first<{ id: string; is_active: number }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(targetId).run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'user.reactivate',
    targetType: 'user',
    targetId,
  });

  return c.json({ data: { success: true } });
});

// ─── POST /users/:id/reset-pin — rate limited ────────────────────────────────

users.post('/users/:id/reset-pin', async (c) => {
  // Rate limiting: 10 destructive actions per admin per minute
  const adminId = c.get('userId');
  const actionKey = `rate:admin-action:${adminId}`;
  const count = parseInt((await c.env.KV.get(actionKey)) ?? '0', 10);
  if (count >= 10) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many admin actions. Wait a minute.' } },
      429
    );
  }
  await c.env.KV.put(actionKey, String(count + 1), count === 0 ? { expirationTtl: 60 } : undefined);

  const targetId = c.req.param('id');

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(targetId).first<{ id: string }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = adminPinResetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } },
      422
    );
  }

  const { hash, salt } = await hashPin(parsed.data.pin);
  const credential = JSON.stringify({ hash, salt });

  await c.env.DB.prepare(
    "UPDATE auth_methods SET credential = ?, updated_at = datetime('now') WHERE user_id = ? AND type = 'pin'"
  ).bind(credential, targetId).run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'user.reset_pin',
    targetType: 'user',
    targetId,
  });

  return c.json({ data: { success: true } });
});

// ─── PATCH /users/:id/role — superadmin only, rate limited ───────────────────

users.patch('/users/:id/role', async (c) => {
  // Rate limiting: 10 destructive actions per admin per minute
  const adminId = c.get('userId');
  const actionKey = `rate:admin-action:${adminId}`;
  const count = parseInt((await c.env.KV.get(actionKey)) ?? '0', 10);
  if (count >= 10) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many admin actions. Wait a minute.' } },
      429
    );
  }
  await c.env.KV.put(actionKey, String(count + 1), count === 0 ? { expirationTtl: 60 } : undefined);

  // Superadmin only
  if (c.get('adminRole') !== 'superadmin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Only superadmins can change user roles' } },
      403
    );
  }

  const targetId = c.req.param('id');

  // Cannot demote self
  if (targetId === adminId) {
    return c.json(
      { error: { code: 'CANNOT_DEMOTE_SELF', message: 'You cannot change your own role' } },
      400
    );
  }

  const user = await c.env.DB.prepare(
    'SELECT id, role FROM users WHERE id = ?'
  ).bind(targetId).first<{ id: string; role: string }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = adminRoleChangeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } },
      422
    );
  }

  const previousRole = user.role;
  const newRole = parsed.data.role;

  await c.env.DB.prepare(
    "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(newRole, targetId).run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'user.role_change',
    targetType: 'user',
    targetId,
    details: { previous_role: previousRole, new_role: newRole },
  });

  return c.json({ data: { success: true } });
});

export default users;
