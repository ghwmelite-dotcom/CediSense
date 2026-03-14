import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createSusuGroupSchema,
  joinSusuGroupSchema,
  recordContributionSchema,
  updateSusuGroupSchema,
} from '@cedisense/shared';
import type { SusuFrequency } from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const susu = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// ─── Row types ───────────────────────────────────────────────────────────────

interface SusuGroupRow {
  id: string;
  name: string;
  creator_id: string;
  invite_code: string;
  contribution_pesewas: number;
  frequency: SusuFrequency;
  max_members: number;
  current_round: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface SusuMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  payout_order: number;
  joined_at: string;
}

interface SusuContributionRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  contributed_at: string;
}

interface SusuPayoutRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  paid_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapGroup(row: SusuGroupRow) {
  return {
    ...row,
    is_active: row.is_active === 1,
  };
}

// ─── POST /groups — create a new susu group ───────────────────────────────────

susu.post('/groups', async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = createSusuGroupSchema.safeParse(body);

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

  const { name, contribution_pesewas, frequency, max_members } = parsed.data;

  // Fetch creator display_name
  const user = await c.env.DB.prepare(
    `SELECT name FROM users WHERE id = ?`
  ).bind(userId).first<{ name: string }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const groupId = generateId();
  const memberId = generateId();
  const invite_code = 'SUSU-' + generateId().slice(0, 8).toUpperCase();

  await c.env.DB.prepare(
    `INSERT INTO susu_groups
       (id, name, creator_id, invite_code, contribution_pesewas, frequency, max_members)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(groupId, name, userId, invite_code, contribution_pesewas, frequency, max_members).run();

  // Auto-add creator as first member
  await c.env.DB.prepare(
    `INSERT INTO susu_members (id, group_id, user_id, display_name, payout_order)
     VALUES (?, ?, ?, ?, 1)`
  ).bind(memberId, groupId, userId, user.name).run();

  const group = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  return c.json({ data: mapGroup(group!) }, 201);
});

// ─── GET /groups — list groups the user is a member of ───────────────────────

susu.get('/groups', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.creator_id, g.invite_code, g.contribution_pesewas,
            g.frequency, g.max_members, g.current_round, g.is_active,
            g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM susu_members m2 WHERE m2.group_id = g.id) AS member_count
     FROM susu_groups g
     INNER JOIN susu_members sm ON sm.group_id = g.id AND sm.user_id = ?
     ORDER BY g.created_at DESC`
  ).bind(userId).all<SusuGroupRow & { member_count: number }>();

  const data = results.map((row) => ({
    ...mapGroup(row),
    member_count: row.member_count,
  }));

  return c.json({ data });
});

// ─── GET /groups/:id — full group detail ─────────────────────────────────────

susu.get('/groups/:id', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const group = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results: members } = await c.env.DB.prepare(
    `SELECT id, group_id, user_id, display_name, payout_order, joined_at
     FROM susu_members WHERE group_id = ?
     ORDER BY payout_order ASC`
  ).bind(groupId).all<SusuMemberRow>();

  const { results: contributions } = await c.env.DB.prepare(
    `SELECT member_id FROM susu_contributions
     WHERE group_id = ? AND round = ?`
  ).bind(groupId, group.current_round).all<{ member_id: string }>();

  const contributedSet = new Set(contributions.map((c) => c.member_id));
  const member_count = members.length;

  // Determine payout recipient: payout_order = ((current_round - 1) % member_count) + 1
  const payoutOrder = member_count > 0
    ? ((group.current_round - 1) % member_count) + 1
    : 1;

  const payout_recipient = members.find((m) => m.payout_order === payoutOrder) ?? null;

  const membersWithContrib = members.map((m) => ({
    ...m,
    has_contributed_this_round: contributedSet.has(m.id),
  }));

  return c.json({
    data: {
      ...mapGroup(group),
      member_count,
      members: membersWithContrib,
      payout_recipient,
      my_member_id: myMember.id,
      is_creator: group.creator_id === userId,
    },
  });
});

// ─── PUT /groups/:id — update group (creator only) ───────────────────────────

susu.put('/groups/:id', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can update this group' } }, 403);
  }

  const body = await c.req.json();
  const parsed = updateSusuGroupSchema.safeParse(body);

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

  const { name, contribution_pesewas, frequency, max_members, is_active } = parsed.data;

  const setClauses: string[] = [`updated_at = datetime('now')`];
  const bindings: unknown[] = [];

  if (name !== undefined) { setClauses.push('name = ?'); bindings.push(name); }
  if (contribution_pesewas !== undefined) { setClauses.push('contribution_pesewas = ?'); bindings.push(contribution_pesewas); }
  if (frequency !== undefined) { setClauses.push('frequency = ?'); bindings.push(frequency); }
  if (max_members !== undefined) { setClauses.push('max_members = ?'); bindings.push(max_members); }
  if (is_active !== undefined) { setClauses.push('is_active = ?'); bindings.push(is_active ? 1 : 0); }

  bindings.push(groupId);

  await c.env.DB.prepare(
    `UPDATE susu_groups SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...bindings).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  return c.json({ data: mapGroup(updated!) });
});

// ─── DELETE /groups/:id — delete group (creator only) ────────────────────────

susu.delete('/groups/:id', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can delete this group' } }, 403);
  }

  await c.env.DB.prepare(
    `DELETE FROM susu_groups WHERE id = ?`
  ).bind(groupId).run();

  return c.body(null, 204);
});

// ─── POST /groups/join — join by invite code ──────────────────────────────────

susu.post('/groups/join', async (c) => {
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

  return c.json({ data: member! }, 201);
});

// ─── POST /groups/:id/leave — leave group (non-creator only) ─────────────────

susu.post('/groups/:id/leave', async (c) => {
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

// ─── POST /groups/:id/contributions — record a contribution (creator only) ───

susu.post('/groups/:id/contributions', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can record contributions' } }, 403);
  }

  const body = await c.req.json();
  const parsed = recordContributionSchema.safeParse(body);

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

  const { member_id, amount_pesewas } = parsed.data;

  // Verify member belongs to this group
  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE id = ? AND group_id = ?`
  ).bind(member_id, groupId).first();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found in this group' } }, 404);
  }

  const contribId = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO susu_contributions (id, group_id, member_id, round, amount_pesewas)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(contribId, groupId, member_id, group.current_round, amount_pesewas).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'Member has already contributed this round' } }, 409);
    }
    throw err;
  }

  const contribution = await c.env.DB.prepare(
    `SELECT id, group_id, member_id, round, amount_pesewas, contributed_at
     FROM susu_contributions WHERE id = ?`
  ).bind(contribId).first<SusuContributionRow>();

  return c.json({ data: contribution! }, 201);
});

// ─── POST /groups/:id/payouts — record payout for current round (creator only)

susu.post('/groups/:id/payouts', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round, contribution_pesewas FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number; contribution_pesewas: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can record payouts' } }, 403);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();

  const member_count = countRow?.cnt ?? 0;

  if (member_count === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Group has no members' } }, 400);
  }

  const payoutOrder = ((group.current_round - 1) % member_count) + 1;

  const payout_member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND payout_order = ?`
  ).bind(groupId, payoutOrder).first<{ id: string }>();

  if (!payout_member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Payout member not found' } }, 404);
  }

  const amount_pesewas = group.contribution_pesewas * member_count;
  const payoutId = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(payoutId, groupId, payout_member.id, group.current_round, amount_pesewas).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'Payout already recorded for this round' } }, 409);
    }
    throw err;
  }

  const payout = await c.env.DB.prepare(
    `SELECT id, group_id, member_id, round, amount_pesewas, paid_at
     FROM susu_payouts WHERE id = ?`
  ).bind(payoutId).first<SusuPayoutRow>();

  return c.json({ data: payout! }, 201);
});

// ─── POST /groups/:id/advance-round — advance to next round (creator only) ───

susu.post('/groups/:id/advance-round', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can advance the round' } }, 403);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();

  const member_count = countRow?.cnt ?? 0;

  // Check all members contributed
  const contribCount = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_contributions WHERE group_id = ? AND round = ?`
  ).bind(groupId, group.current_round).first<{ cnt: number }>();

  if ((contribCount?.cnt ?? 0) < member_count) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Not all members have contributed this round' } },
      400
    );
  }

  // Check payout recorded
  const payoutRow = await c.env.DB.prepare(
    `SELECT id FROM susu_payouts WHERE group_id = ? AND round = ?`
  ).bind(groupId, group.current_round).first();

  if (!payoutRow) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Payout has not been recorded for this round' } },
      400
    );
  }

  await c.env.DB.prepare(
    `UPDATE susu_groups
     SET current_round = current_round + 1, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(groupId).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  return c.json({ data: mapGroup(updated!) });
});

// ─── GET /groups/:id/history — all contributions + payouts ───────────────────

susu.get('/groups/:id/history', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results: contributions } = await c.env.DB.prepare(
    `SELECT sc.id, sc.group_id, sc.member_id, sc.round, sc.amount_pesewas, sc.contributed_at,
            sm.display_name AS member_display_name
     FROM susu_contributions sc
     INNER JOIN susu_members sm ON sm.id = sc.member_id
     WHERE sc.group_id = ?
     ORDER BY sc.round DESC, sc.contributed_at DESC`
  ).bind(groupId).all<SusuContributionRow & { member_display_name: string }>();

  const { results: payouts } = await c.env.DB.prepare(
    `SELECT sp.id, sp.group_id, sp.member_id, sp.round, sp.amount_pesewas, sp.paid_at,
            sm.display_name AS member_display_name
     FROM susu_payouts sp
     INNER JOIN susu_members sm ON sm.id = sp.member_id
     WHERE sp.group_id = ?
     ORDER BY sp.round DESC, sp.paid_at DESC`
  ).bind(groupId).all<SusuPayoutRow & { member_display_name: string }>();

  return c.json({ data: { contributions, payouts } });
});

export { susu };
