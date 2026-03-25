// apps/api/src/routes/admin/groups.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import { logAuditAction } from '../../lib/audit.js';

const groups = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Row types ────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  name: string;
  variant: string;
  is_active: number;
  creator_id: string;
  created_at: string;
  member_count: number;
  [key: string]: unknown;
}

interface MemberRow {
  id: string;
  user_id: string;
  group_id: string;
  display_name: string;
  role: string;
  joined_at: string;
  phone: string;
  [key: string]: unknown;
}

interface MessageRow {
  id: string;
  group_id: string;
  member_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  display_name: string;
  [key: string]: unknown;
}

interface ClaimRow {
  id: string;
  group_id: string;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface CountRow {
  count: number;
}

// ─── GET /admin/groups — paginated list ───────────────────────────────────────

groups.get('/groups', async (c) => {
  const q = c.req.query('q');
  const variant = c.req.query('variant');
  const activeParam = c.req.query('active'); // '1' or '0'
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const fetchLimit = limit + 1;

  // Decode cursor
  let cursorTs = '';
  let cursorId = '';
  let hasCursor = false;
  if (cursor) {
    try {
      const parsed = JSON.parse(atob(cursor)) as { ts: string; id: string };
      cursorTs = parsed.ts;
      cursorId = parsed.id;
      hasCursor = true;
    } catch {
      // invalid cursor — treat as first page
    }
  }

  const conditions: string[] = ['1=1'];
  const binds: (string | number)[] = [];

  if (q) {
    conditions.push('g.name LIKE ?');
    binds.push(`%${q}%`);
  }
  if (variant) {
    conditions.push('g.variant = ?');
    binds.push(variant);
  }
  if (activeParam === '1' || activeParam === '0') {
    conditions.push('g.is_active = ?');
    binds.push(parseInt(activeParam, 10));
  }
  if (hasCursor) {
    conditions.push('(g.created_at < ? OR (g.created_at = ? AND g.id < ?))');
    binds.push(cursorTs, cursorTs, cursorId);
  }

  binds.push(fetchLimit);

  const sql = `
    SELECT g.*,
      (SELECT COUNT(*) FROM susu_members WHERE group_id = g.id) as member_count
    FROM susu_groups g
    WHERE ${conditions.join(' AND ')}
    ORDER BY g.created_at DESC, g.id DESC
    LIMIT ?
  `;

  const result = await c.env.DB.prepare(sql).bind(...binds).all<GroupRow>();
  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor =
    has_more && lastItem
      ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
      : null;

  return c.json({
    data: {
      items,
      cursor: nextCursor,
      has_more,
    },
  });
});

// ─── GET /admin/groups/:id — full detail ──────────────────────────────────────

groups.get('/groups/:id', async (c) => {
  const id = c.req.param('id');

  const [
    group,
    membersResult,
    contribCount,
    payoutCount,
    messagesResult,
    funeralClaimsResult,
    welfareClaimsResult,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM susu_groups WHERE id = ?')
      .bind(id)
      .first<GroupRow>(),

    c.env.DB.prepare(
      `SELECT sm.*, u.phone
       FROM susu_members sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.group_id = ?`
    )
      .bind(id)
      .all<MemberRow>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM susu_contributions WHERE group_id = ?'
    )
      .bind(id)
      .first<CountRow>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM susu_payouts WHERE group_id = ?'
    )
      .bind(id)
      .first<CountRow>(),

    c.env.DB.prepare(
      `SELECT m.*, sm.display_name
       FROM susu_messages m
       JOIN susu_members sm ON m.member_id = sm.id
       WHERE m.group_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 20`
    )
      .bind(id)
      .all<MessageRow>(),

    c.env.DB.prepare(
      `SELECT * FROM funeral_claims WHERE group_id = ? AND status = 'pending'`
    )
      .bind(id)
      .all<ClaimRow>(),

    c.env.DB.prepare(
      `SELECT * FROM welfare_claims WHERE group_id = ? AND status = 'pending'`
    )
      .bind(id)
      .all<ClaimRow>(),
  ]);

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const activeClaims: ClaimRow[] = [
    ...funeralClaimsResult.results,
    ...welfareClaimsResult.results,
  ];

  return c.json({
    data: {
      ...group,
      members: membersResult.results,
      contribution_count: contribCount?.count ?? 0,
      payout_count: payoutCount?.count ?? 0,
      recent_messages: messagesResult.results,
      active_claims: activeClaims,
    },
  });
});

// ─── PATCH /admin/groups/:id/deactivate ───────────────────────────────────────

groups.patch('/groups/:id/deactivate', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');

  const group = await c.env.DB.prepare(
    'SELECT id, name FROM susu_groups WHERE id = ?'
  )
    .bind(id)
    .first<{ id: string; name: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE susu_groups SET is_active = 0 WHERE id = ?'
  )
    .bind(id)
    .run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'group.deactivate',
    targetType: 'group',
    targetId: id,
    details: { group_name: group.name },
  });

  return c.json({ data: { success: true } });
});

// ─── PATCH /admin/groups/:id/reactivate ───────────────────────────────────────

groups.patch('/groups/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('userId');

  const group = await c.env.DB.prepare(
    'SELECT id, name FROM susu_groups WHERE id = ?'
  )
    .bind(id)
    .first<{ id: string; name: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE susu_groups SET is_active = 1 WHERE id = ?'
  )
    .bind(id)
    .run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'group.reactivate',
    targetType: 'group',
    targetId: id,
    details: { group_name: group.name },
  });

  return c.json({ data: { success: true } });
});

// ─── DELETE /admin/groups/:id/members/:memberId ───────────────────────────────

groups.delete('/groups/:id/members/:memberId', async (c) => {
  const groupId = c.req.param('id');
  const memberId = c.req.param('memberId');
  const adminId = c.get('userId');

  const member = await c.env.DB.prepare(
    'SELECT id, display_name FROM susu_members WHERE id = ? AND group_id = ?'
  )
    .bind(memberId, groupId)
    .first<{ id: string; display_name: string }>();

  if (!member) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Member not found in this group' } },
      404
    );
  }

  await c.env.DB.prepare('DELETE FROM susu_members WHERE id = ?')
    .bind(memberId)
    .run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'group.remove_member',
    targetType: 'member',
    targetId: memberId,
    details: { group_id: groupId, display_name: member.display_name },
  });

  return c.json({ data: { success: true } });
});

// ─── DELETE /admin/groups/:id/messages/:messageId — soft-delete ───────────────

groups.delete('/groups/:id/messages/:messageId', async (c) => {
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');
  const adminId = c.get('userId');

  const message = await c.env.DB.prepare(
    `SELECT id FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  )
    .bind(messageId, groupId)
    .first<{ id: string }>();

  if (!message) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Message not found or already deleted' } },
      404
    );
  }

  await c.env.DB.prepare(
    `UPDATE susu_messages SET deleted_at = datetime('now') WHERE id = ?`
  )
    .bind(messageId)
    .run();

  await logAuditAction(c.env.DB, {
    adminId,
    action: 'group.delete_message',
    targetType: 'message',
    targetId: messageId,
    details: { group_id: groupId },
  });

  return c.json({ data: { success: true } });
});

export default groups;
