import { Hono } from 'hono';
import type { AppType, SusuMemberRow } from './index.js';
import { generateId } from './index.js';
import {
  joinSusuGroupSchema,
  reorderSusuMembersSchema,
} from '@cedisense/shared';
import { withNotification } from '../../lib/with-notification.js';

const members = new Hono<AppType>();

// ─── POST /groups/join — join by invite code ──────────────────────────────────

members.post('/groups/join', withNotification(async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = joinSusuGroupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const { invite_code } = parsed.data;

  const group = await c.env.DB.prepare(
    `SELECT id, max_members, is_active FROM susu_groups WHERE invite_code = ?`
  ).bind(invite_code).first<{ id: string; max_members: number; is_active: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Invalid invite code' } }, 404);
  }

  if (!group.is_active) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'This group is no longer active' } }, 403);
  }

  // Check member count
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(group.id).first<{ cnt: number }>();

  if ((countRow?.cnt ?? 0) >= group.max_members) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Group is full' } }, 403);
  }

  // Check not already a member
  const existing = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(group.id, userId).first();

  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'You are already a member of this group' } }, 409);
  }

  // Get max payout_order
  const maxOrder = await c.env.DB.prepare(
    `SELECT MAX(payout_order) AS max_order FROM susu_members WHERE group_id = ?`
  ).bind(group.id).first<{ max_order: number | null }>();

  const payout_order = (maxOrder?.max_order ?? 0) + 1;

  const user = await c.env.DB.prepare(
    `SELECT name FROM users WHERE id = ?`
  ).bind(userId).first<{ name: string }>();

  const memberId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO susu_members (id, group_id, user_id, display_name, payout_order)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(memberId, group.id, userId, user?.name ?? 'Member', payout_order).run();

  const member = await c.env.DB.prepare(
    `SELECT id, group_id, user_id, display_name, payout_order, joined_at
     FROM susu_members WHERE id = ?`
  ).bind(memberId).first<SusuMemberRow>();

  if (!member) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: member }, 201);
}, (c, data) => {
  // data = the SusuMemberRow for the newly joined member
  const d = data as {
    group_id?: string;
    display_name?: string;
    id?: string;
  };
  const groupId = d.group_id ?? '';
  if (!groupId) return null;
  return {
    type: 'susu_member_joined',
    groupId,
    actorId: c.get('userId'),
    data: {
      actorName: d.display_name ?? 'A member',
      referenceId: d.id,
      referenceType: 'contribution', // nearest generic type; members have no dedicated referenceType
    },
  };
}));

// ─── POST /groups/:id/leave — leave group (non-creator only) ─────────────────

members.post('/groups/:id/leave', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id === userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Creator cannot leave — delete the group instead' } }, 403);
  }

  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'You are not a member of this group' } }, 404);
  }

  await c.env.DB.prepare(
    `DELETE FROM susu_members WHERE id = ?`
  ).bind(member.id).run();

  // Reorder remaining members sequentially by their current payout_order
  const { results: remaining } = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? ORDER BY payout_order ASC`
  ).bind(groupId).all<{ id: string }>();

  for (let i = 0; i < remaining.length; i++) {
    await c.env.DB.prepare(
      `UPDATE susu_members SET payout_order = ? WHERE id = ?`
    ).bind(i + 1, remaining[i].id).run();
  }

  return c.body(null, 204);
});

// ─── PUT /groups/:id/reorder — reorder payout positions (creator only) ────────

members.put('/groups/:id/reorder', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the group creator can reorder members' } }, 403);
  }

  const body = await c.req.json();
  const parsed = reorderSusuMembersSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: 'order must be a non-empty array of member IDs', details: { fieldErrors: parsed.error.flatten().fieldErrors } }
    }, 400);
  }

  // Verify all provided member IDs belong to this group
  const { results: groupMembers } = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? ORDER BY payout_order ASC`
  ).bind(groupId).all<{ id: string }>();

  const memberIdSet = new Set(groupMembers.map((m) => m.id));

  const { order } = parsed.data;

  if (order.length !== groupMembers.length) {
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: `order must contain exactly ${groupMembers.length} member IDs` }
    }, 400);
  }

  for (const id of order) {
    if (!memberIdSet.has(id)) {
      return c.json({
        error: { code: 'VALIDATION_ERROR', message: `Member ID ${id} not found in this group` }
      }, 400);
    }
  }

  // Check for duplicates
  if (new Set(order).size !== order.length) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Duplicate member IDs in order' } }, 400);
  }

  // Apply new order using batch for atomicity
  const stmts = order.map((memberId, i) =>
    c.env.DB.prepare(
      `UPDATE susu_members SET payout_order = ? WHERE id = ? AND group_id = ?`
    ).bind(i + 1, memberId, groupId)
  );

  await c.env.DB.batch(stmts);

  // Return updated members
  const { results: updated } = await c.env.DB.prepare(
    `SELECT id, group_id, user_id, display_name, payout_order, joined_at
     FROM susu_members WHERE group_id = ? ORDER BY payout_order ASC`
  ).bind(groupId).all<SusuMemberRow>();

  return c.json({ data: updated });
});

export default members;
