import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createSusuGroupSchema,
  joinSusuGroupSchema,
  recordContributionSchema,
  updateSusuGroupSchema,
  earlyPayoutRequestSchema,
  earlyPayoutVoteSchema,
} from '@cedisense/shared';
import type { SusuFrequency } from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { computeTrustScore, getTrustLabel } from '../lib/trust-score.js';

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
    `SELECT sm.id, sm.group_id, sm.user_id, sm.display_name, sm.payout_order, sm.joined_at,
            COALESCE(ts.score, 50) AS trust_score
     FROM susu_members sm
     LEFT JOIN trust_scores ts ON ts.user_id = sm.user_id
     WHERE sm.group_id = ?
     ORDER BY sm.payout_order ASC`
  ).bind(groupId).all<SusuMemberRow & { trust_score: number }>();

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
    trust_score: m.trust_score,
    trust_label: getTrustLabel(m.trust_score),
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

  // Update trust score for the contributing user
  const contributingMember = await c.env.DB.prepare(
    `SELECT user_id FROM susu_members WHERE id = ?`
  ).bind(member_id).first<{ user_id: string }>();

  if (contributingMember) {
    await c.env.DB.prepare(
      `INSERT INTO trust_scores (user_id, score, total_contributions, on_time_contributions, updated_at)
       VALUES (?, 51, 1, 1, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         total_contributions = total_contributions + 1,
         on_time_contributions = on_time_contributions + 1,
         updated_at = datetime('now')`
    ).bind(contributingMember.user_id).run();

    // Recompute score from current stats
    const stats = await c.env.DB.prepare(
      `SELECT total_contributions, on_time_contributions, late_contributions,
              missed_contributions, groups_completed
       FROM trust_scores WHERE user_id = ?`
    ).bind(contributingMember.user_id).first<{
      total_contributions: number;
      on_time_contributions: number;
      late_contributions: number;
      missed_contributions: number;
      groups_completed: number;
    }>();

    if (stats) {
      const newScore = computeTrustScore(stats);
      await c.env.DB.prepare(
        `UPDATE trust_scores SET score = ? WHERE user_id = ?`
      ).bind(newScore, contributingMember.user_id).run();
    }
  }

  const contribution = await c.env.DB.prepare(
    `SELECT id, group_id, member_id, round, amount_pesewas, contributed_at
     FROM susu_contributions WHERE id = ?`
  ).bind(contribId).first<SusuContributionRow>();

  // Fetch enriched receipt fields
  const groupRow = await c.env.DB.prepare(
    `SELECT name, max_members FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ name: string; max_members: number }>();

  const memberRow = await c.env.DB.prepare(
    `SELECT display_name FROM susu_members WHERE id = ?`
  ).bind(member_id).first<{ display_name: string }>();

  return c.json({
    data: {
      ...contribution!,
      receipt_number: `CS-${contribId.slice(0, 8).toUpperCase()}`,
      group_name: groupRow?.name ?? '',
      member_name: memberRow?.display_name ?? '',
      round: group.current_round,
      total_rounds: groupRow?.max_members ?? 0,
    },
  }, 201);
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

// ─── GET /groups/trust/:userId — get a user's trust score ─────────────────────

susu.get('/groups/trust/:userId', async (c) => {
  const targetUserId = c.req.param('userId');

  const row = await c.env.DB.prepare(
    `SELECT score, total_contributions, on_time_contributions, late_contributions,
            missed_contributions, groups_completed
     FROM trust_scores WHERE user_id = ?`
  ).bind(targetUserId).first<{
    score: number;
    total_contributions: number;
    on_time_contributions: number;
    late_contributions: number;
    missed_contributions: number;
    groups_completed: number;
  }>();

  if (!row) {
    // No trust record yet — return defaults
    return c.json({
      data: {
        score: 50,
        total_contributions: 0,
        on_time_contributions: 0,
        late_contributions: 0,
        missed_contributions: 0,
        groups_completed: 0,
        label: getTrustLabel(50),
      },
    });
  }

  return c.json({
    data: {
      ...row,
      label: getTrustLabel(row.score),
    },
  });
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

// ─── GET /groups/:groupId/contributions/:id/receipt — fetch receipt data ──────

susu.get('/groups/:groupId/contributions/:id/receipt', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('groupId');
  const contribId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const contribution = await c.env.DB.prepare(
    `SELECT id, group_id, member_id, round, amount_pesewas, contributed_at
     FROM susu_contributions WHERE id = ? AND group_id = ?`
  ).bind(contribId, groupId).first<SusuContributionRow>();

  if (!contribution) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Contribution not found' } }, 404);
  }

  const groupRow = await c.env.DB.prepare(
    `SELECT name, max_members FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ name: string; max_members: number }>();

  const memberRow = await c.env.DB.prepare(
    `SELECT display_name FROM susu_members WHERE id = ?`
  ).bind(contribution.member_id).first<{ display_name: string }>();

  return c.json({
    data: {
      receipt_number: `CS-${contribution.id.slice(0, 8).toUpperCase()}`,
      group_name: groupRow?.name ?? '',
      member_name: memberRow?.display_name ?? '',
      round: contribution.round,
      total_rounds: groupRow?.max_members ?? 0,
      amount_pesewas: contribution.amount_pesewas,
      contributed_at: contribution.contributed_at,
    },
  });
});

// ─── Row types for early payouts ─────────────────────────────────────────────

interface EarlyPayoutRequestRow {
  id: string;
  group_id: string;
  requester_member_id: string;
  reason: string | null;
  amount_pesewas: number;
  premium_percent: number;
  status: string;
  votes_for: number;
  votes_against: number;
  votes_needed: number;
  created_at: string;
  resolved_at: string | null;
}

interface EarlyPayoutVoteRow {
  id: string;
  request_id: string;
  member_id: string;
  vote: string;
  voted_at: string;
}

// ─── POST /groups/:id/early-payout — request an early payout ─────────────────

susu.post('/groups/:id/early-payout', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const body = await c.req.json();
  const parsed = earlyPayoutRequestSchema.safeParse(body);

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

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Check no pending request already exists for this member
  const existing = await c.env.DB.prepare(
    `SELECT id FROM early_payout_requests
     WHERE group_id = ? AND requester_member_id = ? AND status = 'pending'`
  ).bind(groupId, myMember.id).first();

  if (existing) {
    return c.json(
      { error: { code: 'CONFLICT', message: 'You already have a pending early payout request' } },
      409
    );
  }

  // Get group info and member count
  const group = await c.env.DB.prepare(
    `SELECT contribution_pesewas FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ contribution_pesewas: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();

  const memberCount = countRow?.cnt ?? 0;
  const amount = group.contribution_pesewas * memberCount;
  const votesNeeded = Math.ceil(memberCount / 2);

  const requestId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO early_payout_requests
       (id, group_id, requester_member_id, reason, amount_pesewas, votes_needed)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(requestId, groupId, myMember.id, parsed.data.reason ?? null, amount, votesNeeded).run();

  const row = await c.env.DB.prepare(
    `SELECT epr.*, sm.display_name AS requester_name
     FROM early_payout_requests epr
     INNER JOIN susu_members sm ON sm.id = epr.requester_member_id
     WHERE epr.id = ?`
  ).bind(requestId).first<EarlyPayoutRequestRow & { requester_name: string }>();

  return c.json({
    data: {
      ...row!,
      premium_pesewas: Math.round(row!.amount_pesewas * row!.premium_percent / 100),
      my_vote: null,
    },
  }, 201);
});

// ─── GET /groups/:id/early-payout — get active early payout request ──────────

susu.get('/groups/:id/early-payout', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Find active request (pending or approved)
  const request = await c.env.DB.prepare(
    `SELECT epr.*, sm.display_name AS requester_name
     FROM early_payout_requests epr
     INNER JOIN susu_members sm ON sm.id = epr.requester_member_id
     WHERE epr.group_id = ? AND epr.status IN ('pending', 'approved')
     ORDER BY epr.created_at DESC LIMIT 1`
  ).bind(groupId).first<EarlyPayoutRequestRow & { requester_name: string }>();

  if (!request) {
    return c.json({ data: null });
  }

  // Get votes
  const { results: votes } = await c.env.DB.prepare(
    `SELECT epv.id, epv.member_id, sm.display_name, epv.vote, epv.voted_at
     FROM early_payout_votes epv
     INNER JOIN susu_members sm ON sm.id = epv.member_id
     WHERE epv.request_id = ?
     ORDER BY epv.voted_at ASC`
  ).bind(request.id).all<EarlyPayoutVoteRow & { display_name: string }>();

  // Find my vote
  const myVote = votes.find((v) => v.member_id === myMember.id);

  return c.json({
    data: {
      ...request,
      premium_pesewas: Math.round(request.amount_pesewas * request.premium_percent / 100),
      my_vote: myVote?.vote ?? null,
      votes,
    },
  });
});

// ─── POST /groups/:id/early-payout/:requestId/vote — cast a vote ─────────────

susu.post('/groups/:id/early-payout/:requestId/vote', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const requestId = c.req.param('requestId');

  const body = await c.req.json();
  const parsed = earlyPayoutVoteSchema.safeParse(body);

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

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Get the request
  const request = await c.env.DB.prepare(
    `SELECT * FROM early_payout_requests WHERE id = ? AND group_id = ? AND status = 'pending'`
  ).bind(requestId, groupId).first<EarlyPayoutRequestRow>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No pending request found' } }, 404);
  }

  // Can't vote on own request
  if (request.requester_member_id === myMember.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You cannot vote on your own request' } }, 403);
  }

  // Cast vote
  const voteId = generateId();
  try {
    await c.env.DB.prepare(
      `INSERT INTO early_payout_votes (id, request_id, member_id, vote)
       VALUES (?, ?, ?, ?)`
    ).bind(voteId, requestId, myMember.id, parsed.data.vote).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'You have already voted on this request' } }, 409);
    }
    throw err;
  }

  // Update vote counts
  const voteColumn = parsed.data.vote === 'for' ? 'votes_for' : 'votes_against';
  await c.env.DB.prepare(
    `UPDATE early_payout_requests SET ${voteColumn} = ${voteColumn} + 1 WHERE id = ?`
  ).bind(requestId).run();

  // Re-fetch updated request
  const updated = await c.env.DB.prepare(
    `SELECT * FROM early_payout_requests WHERE id = ?`
  ).bind(requestId).first<EarlyPayoutRequestRow>();

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
  }

  // Get total members for auto-deny calculation
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const totalMembers = countRow?.cnt ?? 0;

  // Auto-approve if votes_for >= votes_needed
  if (updated.votes_for >= updated.votes_needed) {
    await c.env.DB.prepare(
      `UPDATE early_payout_requests SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`
    ).bind(requestId).run();
  }
  // Auto-deny if it's impossible to reach majority
  else if (updated.votes_against > totalMembers - updated.votes_needed) {
    await c.env.DB.prepare(
      `UPDATE early_payout_requests SET status = 'denied', resolved_at = datetime('now') WHERE id = ?`
    ).bind(requestId).run();
  }

  // Return final state
  const final = await c.env.DB.prepare(
    `SELECT epr.*, sm.display_name AS requester_name
     FROM early_payout_requests epr
     INNER JOIN susu_members sm ON sm.id = epr.requester_member_id
     WHERE epr.id = ?`
  ).bind(requestId).first<EarlyPayoutRequestRow & { requester_name: string }>();

  return c.json({
    data: {
      ...final!,
      premium_pesewas: Math.round(final!.amount_pesewas * final!.premium_percent / 100),
      my_vote: parsed.data.vote,
    },
  });
});

// ─── POST /groups/:id/early-payout/:requestId/pay — pay out approved request ─

susu.post('/groups/:id/early-payout/:requestId/pay', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const requestId = c.req.param('requestId');

  // Only creator can pay out
  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can process payouts' } }, 403);
  }

  // Get the approved request
  const request = await c.env.DB.prepare(
    `SELECT * FROM early_payout_requests WHERE id = ? AND group_id = ? AND status = 'approved'`
  ).bind(requestId, groupId).first<EarlyPayoutRequestRow>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No approved request found' } }, 404);
  }

  const premium = Math.round(request.amount_pesewas * request.premium_percent / 100);
  const totalPayout = request.amount_pesewas + premium;

  // Record as a susu_payout
  const payoutId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(payoutId, groupId, request.requester_member_id, group.current_round, totalPayout).run();

  // Mark request as paid
  await c.env.DB.prepare(
    `UPDATE early_payout_requests SET status = 'paid', resolved_at = datetime('now') WHERE id = ?`
  ).bind(requestId).run();

  const final = await c.env.DB.prepare(
    `SELECT epr.*, sm.display_name AS requester_name
     FROM early_payout_requests epr
     INNER JOIN susu_members sm ON sm.id = epr.requester_member_id
     WHERE epr.id = ?`
  ).bind(requestId).first<EarlyPayoutRequestRow & { requester_name: string }>();

  return c.json({
    data: {
      ...final!,
      premium_pesewas: premium,
      payout_amount_pesewas: totalPayout,
    },
  });
});

export { susu };
