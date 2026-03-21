import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createSusuGroupSchema,
  joinSusuGroupSchema,
  recordContributionSchema,
  updateSusuGroupSchema,
  earlyPayoutRequestSchema,
  earlyPayoutVoteSchema,
  susuMessageSchema,
  messageReactionSchema,
  editMessageSchema,
  funeralClaimSchema,
  funeralClaimVoteSchema,
  guaranteeClaimSchema,
  welfareClaimSchema,
  welfareClaimApproveSchema,
  reorderSusuMembersSchema,
} from '@cedisense/shared';
import type { SusuFrequency, SusuVariant, CreditCertificate, AgriculturalPhase } from '@cedisense/shared';
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
  variant: SusuVariant;
  goal_amount_pesewas: number | null;
  goal_description: string | null;
  penalty_percent: number;
  penalty_pool_pesewas: number;
  target_term: string | null;
  school_name: string | null;
  base_currency: string | null;
  event_name: string | null;
  event_date: string | null;
  guarantee_percent: number;
  guarantee_pool_pesewas: number;
  supplier_name: string | null;
  supplier_contact: string | null;
  item_description: string | null;
  estimated_savings_percent: number | null;
  crop_type: string | null;
  planting_month: number | null;
  harvest_month: number | null;
  organization_name: string | null;
  organization_type: string | null;
  created_at: string;
  updated_at: string;
}

interface SusuPenaltyRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  penalty_pesewas: number;
  reason: string;
  created_at: string;
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
  original_currency: string | null;
  original_amount: number | null;
  exchange_rate: number | null;
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

// Badge name lookup
const BADGE_NAMES: Record<string, string> = {
  first_contribution: 'First Step',
  first_payout: 'First Payout',
  perfect_round: 'Perfect Round',
  streak_5: '5 Streak',
  streak_10: '10 Streak',
  streak_20: '20 Streak',
  group_founder: 'Founder',
  group_completed: 'Completer',
};

// Award a badge if the user doesn't already have it for this group
async function awardBadge(
  db: D1Database,
  userId: string,
  badgeType: string,
  groupId: string | null = null
): Promise<void> {
  const existing = groupId
    ? await db
        .prepare(`SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ? AND group_id = ?`)
        .bind(userId, badgeType, groupId)
        .first()
    : await db
        .prepare(`SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ?`)
        .bind(userId, badgeType)
        .first();

  if (existing) return;

  const badgeId = generateId();
  const badgeName = BADGE_NAMES[badgeType] ?? badgeType;

  await db
    .prepare(
      `INSERT INTO susu_badges (id, user_id, badge_type, badge_name, group_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(badgeId, userId, badgeType, badgeName, groupId)
    .run();
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

  const {
    name, contribution_pesewas, frequency, max_members, variant,
    goal_amount_pesewas, goal_description,
    target_term, school_name, base_currency, event_name, event_date,
    guarantee_percent,
    supplier_name, supplier_contact, item_description, estimated_savings_percent,
    crop_type, planting_month, harvest_month,
    organization_name, organization_type,
    starting_round,
  } = parsed.data;

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

  const effectiveGoalAmount = goal_amount_pesewas ?? null;

  await c.env.DB.prepare(
    `INSERT INTO susu_groups
       (id, name, creator_id, invite_code, contribution_pesewas, frequency, max_members,
        current_round,
        variant, goal_amount_pesewas, goal_description,
        target_term, school_name, base_currency, event_name, event_date,
        guarantee_percent,
        supplier_name, supplier_contact, item_description, estimated_savings_percent,
        crop_type, planting_month, harvest_month,
        organization_name, organization_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    groupId, name, userId, invite_code, contribution_pesewas, frequency, max_members,
    starting_round ?? 1,
    variant, effectiveGoalAmount, goal_description ?? null,
    target_term ?? null, school_name ?? null, base_currency ?? 'GHS',
    event_name ?? null, event_date ?? null,
    guarantee_percent ?? 0,
    supplier_name ?? null, supplier_contact ?? null, item_description ?? null, estimated_savings_percent ?? null,
    crop_type ?? null, planting_month ?? null, harvest_month ?? null,
    organization_name ?? null, organization_type ?? null
  ).run();

  // Auto-add creator as first member
  await c.env.DB.prepare(
    `INSERT INTO susu_members (id, group_id, user_id, display_name, payout_order)
     VALUES (?, ?, ?, ?, 1)`
  ).bind(memberId, groupId, userId, user.name).run();

  // Award group_founder badge
  await awardBadge(c.env.DB, userId, 'group_founder', groupId);

  const group = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, variant, goal_amount_pesewas, goal_description,
            penalty_percent, penalty_pool_pesewas, target_term, school_name, base_currency, event_name, event_date, guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact, item_description, estimated_savings_percent, crop_type, planting_month, harvest_month, organization_name, organization_type, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  if (!group) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: mapGroup(group) }, 201);
});

// ─── GET /groups — list groups the user is a member of ───────────────────────

susu.get('/groups', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.creator_id, g.invite_code, g.contribution_pesewas,
            g.frequency, g.max_members, g.current_round, g.is_active,
            g.variant, g.goal_amount_pesewas, g.goal_description,
            g.penalty_percent, g.penalty_pool_pesewas,
            g.target_term, g.school_name, g.base_currency, g.event_name, g.event_date,
            g.guarantee_percent, g.guarantee_pool_pesewas, g.supplier_name, g.supplier_contact, g.item_description, g.estimated_savings_percent,
            g.crop_type, g.planting_month, g.harvest_month, g.organization_name, g.organization_type,
            g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM susu_members m2 WHERE m2.group_id = g.id) AS member_count,
            sm.id AS _my_member_id
     FROM susu_groups g
     INNER JOIN susu_members sm ON sm.group_id = g.id AND sm.user_id = ?
     ORDER BY g.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(userId, limit, offset).all<SusuGroupRow & { member_count: number; _my_member_id: string }>();

  // Batch-fetch unread counts: single query using LEFT JOIN + subquery instead of N+1
  const groupIds = results.map((r) => r.id);
  const memberIds = results.map((r) => r._my_member_id);
  const unreadCounts = new Map<string, number>();

  if (groupIds.length > 0) {
    // 1. Fetch all read receipts for this user's memberships in one query
    const receiptPlaceholders = memberIds.map(() => '?').join(', ');
    const { results: receipts } = await c.env.DB.prepare(
      `SELECT group_id, last_read_message_id FROM chat_read_receipts
       WHERE member_id IN (${receiptPlaceholders})`
    ).bind(...memberIds).all<{ group_id: string; last_read_message_id: string | null }>();

    const receiptMap = new Map<string, string | null>();
    for (const r of receipts) {
      receiptMap.set(r.group_id, r.last_read_message_id);
    }

    // 2. For groups with a read receipt, resolve rowids in one batch
    const readMessageIds = receipts
      .filter((r) => r.last_read_message_id)
      .map((r) => r.last_read_message_id as string);

    const rowidMap = new Map<string, number>();
    if (readMessageIds.length > 0) {
      const rowidPlaceholders = readMessageIds.map(() => '?').join(', ');
      const { results: rowidRows } = await c.env.DB.prepare(
        `SELECT id, rowid FROM susu_messages WHERE id IN (${rowidPlaceholders})`
      ).bind(...readMessageIds).all<{ id: string; rowid: number }>();
      for (const r of rowidRows) {
        rowidMap.set(r.id, r.rowid);
      }
    }

    // 3. Fetch total message counts per group (for groups with no receipt)
    const totalCountPlaceholders = groupIds.map(() => '?').join(', ');
    const { results: totalCounts } = await c.env.DB.prepare(
      `SELECT group_id, COUNT(*) AS cnt FROM susu_messages
       WHERE group_id IN (${totalCountPlaceholders}) AND deleted_at IS NULL
       GROUP BY group_id`
    ).bind(...groupIds).all<{ group_id: string; cnt: number }>();

    const totalCountMap = new Map<string, number>();
    for (const r of totalCounts) {
      totalCountMap.set(r.group_id, r.cnt);
    }

    // 4. For groups with a read receipt + valid rowid, count messages after that rowid
    // Build batch queries for groups that have valid cursor rowids
    const groupsWithCursor: Array<{ groupId: string; rowid: number }> = [];
    for (const gId of groupIds) {
      const lastReadId = receiptMap.get(gId);
      if (lastReadId) {
        const rowid = rowidMap.get(lastReadId);
        if (rowid !== undefined) {
          groupsWithCursor.push({ groupId: gId, rowid });
        }
      }
    }

    // Run unread count queries in parallel for groups with cursors
    if (groupsWithCursor.length > 0) {
      const unreadQueries = groupsWithCursor.map((g) =>
        c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND rowid > ? AND deleted_at IS NULL`
        ).bind(g.groupId, g.rowid)
      );
      const unreadResults = await c.env.DB.batch(unreadQueries);
      for (let i = 0; i < groupsWithCursor.length; i++) {
        const row = (unreadResults[i].results as Array<{ cnt: number }>)?.[0];
        unreadCounts.set(groupsWithCursor[i].groupId, row?.cnt ?? 0);
      }
    }

    // 5. Fill in counts for groups without a cursor (no receipt = all messages are unread)
    for (const gId of groupIds) {
      if (!unreadCounts.has(gId)) {
        unreadCounts.set(gId, totalCountMap.get(gId) ?? 0);
      }
    }
  }

  const data = results.map((row) => ({
    ...mapGroup(row),
    member_count: row.member_count,
    unread_count: unreadCounts.get(row.id) ?? 0,
  }));

  return c.json({ data, meta: { limit, offset } });
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
            max_members, current_round, is_active, variant, goal_amount_pesewas, goal_description,
            penalty_percent, penalty_pool_pesewas, target_term, school_name, base_currency, event_name, event_date, guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact, item_description, estimated_savings_percent, crop_type, planting_month, harvest_month, organization_name, organization_type, created_at, updated_at
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

  // Determine payout recipient (only relevant for rotating variant)
  const payoutOrder = member_count > 0
    ? ((group.current_round - 1) % member_count) + 1
    : 1;

  const payout_recipient = group.variant === 'rotating'
    ? (members.find((m) => m.payout_order === payoutOrder) ?? null)
    : null;

  const membersWithContrib = members.map((m) => ({
    ...m,
    has_contributed_this_round: contributedSet.has(m.id),
    trust_score: m.trust_score,
    trust_label: getTrustLabel(m.trust_score),
  }));

  // Compute goal progress for goal_based / accumulating variants
  const totalContribRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
  ).bind(groupId).first<{ total: number }>();
  const total_contributed_pesewas = totalContribRow?.total ?? 0;

  const goal_progress = group.variant === 'goal_based' && group.goal_amount_pesewas
    ? {
        total_contributed_pesewas,
        goal_amount_pesewas: group.goal_amount_pesewas,
        goal_description: group.goal_description,
        percentage: Math.min(100, Math.round((total_contributed_pesewas / group.goal_amount_pesewas) * 100)),
        is_complete: total_contributed_pesewas >= group.goal_amount_pesewas,
      }
    : null;

  const accumulating_info = group.variant === 'accumulating'
    ? {
        total_pool_pesewas: total_contributed_pesewas,
        your_share_pesewas: member_count > 0 ? Math.floor(total_contributed_pesewas / member_count) : 0,
      }
    : null;

  // Compute funeral fund info & active claim
  let funeral_fund_info = null;
  let funeral_claim = null;

  if (group.variant === 'funeral_fund') {
    const totalPaidOutRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM funeral_claims WHERE group_id = ? AND status = 'paid'`
    ).bind(groupId).first<{ total: number }>();
    const total_paid_out = totalPaidOutRow?.total ?? 0;

    funeral_fund_info = {
      total_pool_pesewas: total_contributed_pesewas,
      total_paid_out_pesewas: total_paid_out,
      available_pool_pesewas: total_contributed_pesewas - total_paid_out,
    };

    // Get active claim (pending or approved)
    const claimRow = await c.env.DB.prepare(
      `SELECT fc.*, sm.display_name AS claimant_name
       FROM funeral_claims fc
       INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
       WHERE fc.group_id = ? AND fc.status IN ('pending', 'approved')
       ORDER BY fc.created_at DESC LIMIT 1`
    ).bind(groupId).first<FuneralClaimRow & { claimant_name: string }>();

    if (claimRow) {
      // Find my vote
      const myVoteRow = await c.env.DB.prepare(
        `SELECT vote FROM funeral_claim_votes WHERE claim_id = ? AND member_id = ?`
      ).bind(claimRow.id, myMember.id).first<{ vote: string }>();

      funeral_claim = {
        ...claimRow,
        my_vote: (myVoteRow?.vote as 'approve' | 'deny') ?? null,
      };
    }
  }

  // Compute school fees info
  let school_fees_info = null;
  if (group.variant === 'school_fees' && group.target_term) {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Ghana school terms payout dates:
    // Term 1 (Sep–Dec) → payout in August
    // Term 2 (Jan–Apr) → payout in December
    // Term 3 (May–Jul) → payout in March
    const payoutMonths: Record<string, number> = {
      'Term 1': 7,  // August (0-indexed)
      'Term 2': 11, // December
      'Term 3': 2,  // March
    };
    const payoutMonth = payoutMonths[group.target_term] ?? 7;

    let payoutDate = new Date(currentYear, payoutMonth, 1);
    if (payoutDate <= now) {
      payoutDate = new Date(currentYear + 1, payoutMonth, 1);
    }

    const daysUntilPayout = Math.max(0, Math.ceil((payoutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const targetAmount = group.goal_amount_pesewas ?? 0;
    const remaining = Math.max(0, targetAmount - total_contributed_pesewas);
    const weeksUntil = Math.max(1, Math.ceil(daysUntilPayout / 7));
    const monthsUntil = Math.max(1, Math.ceil(daysUntilPayout / 30));

    school_fees_info = {
      target_term: group.target_term,
      school_name: group.school_name,
      next_payout_date: payoutDate.toISOString().slice(0, 10),
      days_until_payout: daysUntilPayout,
      required_weekly_pesewas: Math.ceil(remaining / weeksUntil),
      required_monthly_pesewas: Math.ceil(remaining / monthsUntil),
    };
  }

  // Compute diaspora info
  let diaspora_info = null;
  if (group.variant === 'diaspora') {
    const { results: diasporaContribs } = await c.env.DB.prepare(
      `SELECT sc.amount_pesewas, sc.original_currency, sc.original_amount, sc.exchange_rate, sc.contributed_at,
              sm.display_name AS member_name
       FROM susu_contributions sc
       INNER JOIN susu_members sm ON sm.id = sc.member_id
       WHERE sc.group_id = ? AND sc.original_currency IS NOT NULL
       ORDER BY sc.contributed_at DESC
       LIMIT 50`
    ).bind(groupId).all<{
      amount_pesewas: number;
      original_currency: string;
      original_amount: number;
      exchange_rate: number;
      contributed_at: string;
      member_name: string;
    }>();

    diaspora_info = {
      base_currency: group.base_currency ?? 'GHS',
      contributions_with_currency: diasporaContribs.map((c) => ({
        member_name: c.member_name,
        amount_pesewas: c.amount_pesewas,
        original_currency: c.original_currency,
        original_amount: c.original_amount,
        exchange_rate: c.exchange_rate,
        contributed_at: c.contributed_at,
      })),
    };
  }

  // Compute event fund info
  let event_fund_info = null;
  if (group.variant === 'event_fund') {
    const targetAmount = group.goal_amount_pesewas ?? 0;
    const percentage = targetAmount > 0
      ? Math.min(100, Math.round((total_contributed_pesewas / targetAmount) * 100))
      : 0;

    let daysUntilEvent: number | null = null;
    if (group.event_date) {
      const eventDate = new Date(group.event_date + 'T00:00:00');
      const now = new Date();
      daysUntilEvent = Math.max(0, Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Get contributor list with amounts (guest book style)
    const { results: contributors } = await c.env.DB.prepare(
      `SELECT sm.display_name AS member_name, SUM(sc.amount_pesewas) AS amount_pesewas,
              MAX(sc.contributed_at) AS contributed_at
       FROM susu_contributions sc
       INNER JOIN susu_members sm ON sm.id = sc.member_id
       WHERE sc.group_id = ?
       GROUP BY sc.member_id
       ORDER BY amount_pesewas DESC`
    ).bind(groupId).all<{
      member_name: string;
      amount_pesewas: number;
      contributed_at: string;
    }>();

    event_fund_info = {
      event_name: group.event_name ?? group.name,
      event_date: group.event_date,
      target_amount_pesewas: targetAmount,
      total_contributed_pesewas,
      percentage,
      days_until_event: daysUntilEvent,
      contributors,
    };
  }

  // Compute guarantee claims
  let guarantee_claims: Array<{
    id: string; group_id: string; defaulting_member_id: string;
    defaulting_member_name: string; round: number;
    covered_amount_pesewas: number; created_at: string;
  }> = [];
  if (group.guarantee_percent > 0) {
    const { results: claimsRows } = await c.env.DB.prepare(
      `SELECT gc.id, gc.group_id, gc.defaulting_member_id, sm.display_name AS defaulting_member_name,
              gc.round, gc.covered_amount_pesewas, gc.created_at
       FROM guarantee_claims gc
       INNER JOIN susu_members sm ON sm.id = gc.defaulting_member_id
       WHERE gc.group_id = ?
       ORDER BY gc.created_at DESC`
    ).bind(groupId).all<{
      id: string; group_id: string; defaulting_member_id: string;
      defaulting_member_name: string; round: number;
      covered_amount_pesewas: number; created_at: string;
    }>();
    guarantee_claims = claimsRows;
  }

  // Compute bulk purchase info
  let bulk_purchase_info = null;
  if (group.variant === 'bulk_purchase') {
    const perMemberShare = member_count > 0 ? Math.floor(total_contributed_pesewas / member_count) : 0;
    bulk_purchase_info = {
      total_pool_pesewas: total_contributed_pesewas,
      per_member_share_pesewas: perMemberShare,
      supplier_name: group.supplier_name,
      supplier_contact: group.supplier_contact,
      item_description: group.item_description,
      estimated_savings_percent: group.estimated_savings_percent,
    };
  }

  // Compute agricultural info
  let agricultural_info = null;
  if (group.variant === 'agricultural' && group.crop_type && group.planting_month && group.harvest_month) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const plantMonth = group.planting_month;
    const harvMonth = group.harvest_month;

    // Determine current phase
    let current_phase: AgriculturalPhase;
    if (harvMonth > plantMonth) {
      // Normal season (e.g., plant Mar, harvest Jul)
      if (currentMonth >= plantMonth && currentMonth < plantMonth + Math.ceil((harvMonth - plantMonth) / 3)) {
        current_phase = 'planting';
      } else if (currentMonth >= harvMonth) {
        current_phase = 'harvest';
      } else {
        current_phase = 'growing';
      }
    } else {
      // Wrapping season (e.g., plant Oct, harvest Mar)
      if (currentMonth >= plantMonth || currentMonth < plantMonth - 2) {
        if (currentMonth >= plantMonth && currentMonth <= plantMonth + 1) {
          current_phase = 'planting';
        } else if (currentMonth >= harvMonth - 1 && currentMonth <= harvMonth + 1) {
          current_phase = 'harvest';
        } else {
          current_phase = 'growing';
        }
      } else {
        current_phase = 'growing';
      }
    }

    // Calculate days to next phase
    let nextPhaseMonth: number;
    if (current_phase === 'planting') {
      // Next phase is growing — midpoint between planting and harvest
      nextPhaseMonth = plantMonth + Math.ceil((harvMonth > plantMonth ? harvMonth - plantMonth : harvMonth + 12 - plantMonth) / 3);
      if (nextPhaseMonth > 12) nextPhaseMonth -= 12;
    } else if (current_phase === 'growing') {
      nextPhaseMonth = harvMonth;
    } else {
      // harvest -> next planting
      nextPhaseMonth = plantMonth;
    }

    const currentYear = now.getFullYear();
    let nextPhaseDate = new Date(currentYear, nextPhaseMonth - 1, 1);
    if (nextPhaseDate <= now) {
      nextPhaseDate = new Date(currentYear + 1, nextPhaseMonth - 1, 1);
    }
    const days_to_next_phase = Math.max(0, Math.ceil((nextPhaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Contribution schedule: collect during harvest, payout during planting
    const recommended_contribution_schedule = current_phase === 'harvest'
      ? 'Peak collection period — members have harvest income'
      : current_phase === 'planting'
        ? 'Payout period — members need capital for farm inputs'
        : 'Regular savings period — building up the pool';

    agricultural_info = {
      crop_type: group.crop_type,
      planting_month: plantMonth,
      harvest_month: harvMonth,
      current_phase,
      days_to_next_phase,
      recommended_contribution_schedule,
    };
  }

  // Compute welfare info
  let welfare_info = null;
  if (group.variant === 'welfare' && group.organization_name && group.organization_type) {
    const totalPaidOutRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_approved_pesewas), 0) AS total FROM welfare_claims WHERE group_id = ? AND status = 'paid'`
    ).bind(groupId).first<{ total: number }>();
    const total_paid_out = totalPaidOutRow?.total ?? 0;

    const { results: pendingClaims } = await c.env.DB.prepare(
      `SELECT wc.*, sm.display_name AS claimant_name
       FROM welfare_claims wc
       INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
       WHERE wc.group_id = ? AND wc.status IN ('pending', 'approved', 'partially_approved')
       ORDER BY wc.created_at DESC`
    ).bind(groupId).all<WelfareClaimRow & { claimant_name: string }>();

    const { results: resolvedClaims } = await c.env.DB.prepare(
      `SELECT wc.*, sm.display_name AS claimant_name
       FROM welfare_claims wc
       INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
       WHERE wc.group_id = ? AND wc.status IN ('paid', 'denied')
       ORDER BY wc.resolved_at DESC
       LIMIT 20`
    ).bind(groupId).all<WelfareClaimRow & { claimant_name: string }>();

    welfare_info = {
      organization_name: group.organization_name,
      organization_type: group.organization_type,
      total_pool_pesewas: total_contributed_pesewas,
      total_paid_out_pesewas: total_paid_out,
      available_pool_pesewas: total_contributed_pesewas - total_paid_out,
      pending_claims: pendingClaims.map((c) => ({
        ...c,
        claimant_name: c.claimant_name,
      })),
      resolved_claims: resolvedClaims.map((c) => ({
        ...c,
        claimant_name: c.claimant_name,
      })),
    };
  }

  // Compute unread message count
  const receipt = await c.env.DB.prepare(
    `SELECT last_read_message_id FROM chat_read_receipts WHERE member_id = ? AND group_id = ?`
  ).bind(myMember.id, groupId).first<{ last_read_message_id: string | null }>();

  let unread_count = 0;
  if (receipt?.last_read_message_id) {
    const cursorRow = await c.env.DB.prepare(
      `SELECT rowid FROM susu_messages WHERE id = ?`
    ).bind(receipt.last_read_message_id).first<{ rowid: number }>();
    if (cursorRow) {
      const countRow = await c.env.DB.prepare(
        `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND rowid > ? AND deleted_at IS NULL`
      ).bind(groupId, cursorRow.rowid).first<{ cnt: number }>();
      unread_count = countRow?.cnt ?? 0;
    }
  } else {
    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND deleted_at IS NULL`
    ).bind(groupId).first<{ cnt: number }>();
    unread_count = countRow?.cnt ?? 0;
  }

  return c.json({
    data: {
      ...mapGroup(group),
      member_count,
      members: membersWithContrib,
      payout_recipient,
      my_member_id: myMember.id,
      is_creator: group.creator_id === userId,
      goal_progress,
      accumulating_info,
      funeral_fund_info,
      funeral_claim,
      school_fees_info,
      diaspora_info,
      event_fund_info,
      guarantee_claims,
      bulk_purchase_info,
      agricultural_info,
      welfare_info,
      unread_count,
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
            max_members, current_round, is_active, variant, goal_amount_pesewas, goal_description,
            penalty_percent, penalty_pool_pesewas, target_term, school_name, base_currency, event_name, event_date, guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact, item_description, estimated_savings_percent, crop_type, planting_month, harvest_month, organization_name, organization_type, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  if (!updated) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: mapGroup(updated) });
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

  if (!member) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: member }, 201);
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

// ─── PUT /groups/:id/reorder — reorder payout positions (creator only) ────────

susu.put('/groups/:id/reorder', async (c) => {
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
  const { results: members } = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? ORDER BY payout_order ASC`
  ).bind(groupId).all<{ id: string }>();

  const memberIds = new Set(members.map((m) => m.id));

  const { order } = parsed.data;

  if (order.length !== members.length) {
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: `order must contain exactly ${members.length} member IDs` }
    }, 400);
  }

  for (const id of order) {
    if (!memberIds.has(id)) {
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

// ─── POST /groups/:id/contributions — record a contribution (creator only) ───

susu.post('/groups/:id/contributions', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round, penalty_percent, guarantee_percent FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; current_round: number; penalty_percent: number; guarantee_percent: number }>();

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

  const { member_id, amount_pesewas, is_late, original_currency, original_amount, exchange_rate } = parsed.data;

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
      `INSERT INTO susu_contributions (id, group_id, member_id, round, amount_pesewas, original_currency, original_amount, exchange_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(contribId, groupId, member_id, group.current_round, amount_pesewas, original_currency ?? null, original_amount ?? null, exchange_rate ?? null).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'Member has already contributed this round' } }, 409);
    }
    throw err;
  }

  // Compute side-effect values before batching writes
  let guarantee_deduction_pesewas = 0;
  if (group.guarantee_percent > 0) {
    guarantee_deduction_pesewas = Math.round(amount_pesewas * group.guarantee_percent / 100);
  }

  let penalty_pesewas = 0;
  const penaltyId = generateId();
  if (is_late) {
    penalty_pesewas = Math.round(amount_pesewas * group.penalty_percent / 100);
  }

  // Batch all post-contribution writes in a single transaction
  const batchStatements: D1PreparedStatement[] = [];

  // Guarantee pool update
  if (guarantee_deduction_pesewas > 0) {
    batchStatements.push(
      c.env.DB.prepare(
        `UPDATE susu_groups
         SET guarantee_pool_pesewas = guarantee_pool_pesewas + ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(guarantee_deduction_pesewas, groupId)
    );
  }

  // Penalty insert + pool update
  if (is_late && penalty_pesewas > 0) {
    batchStatements.push(
      c.env.DB.prepare(
        `INSERT INTO susu_penalties (id, group_id, member_id, round, penalty_pesewas, reason)
         VALUES (?, ?, ?, ?, ?, 'late_contribution')`
      ).bind(penaltyId, groupId, member_id, group.current_round, penalty_pesewas)
    );
    batchStatements.push(
      c.env.DB.prepare(
        `UPDATE susu_groups
         SET penalty_pool_pesewas = penalty_pool_pesewas + ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(penalty_pesewas, groupId)
    );
  }

  // Trust score upsert
  const contributingMember = await c.env.DB.prepare(
    `SELECT user_id FROM susu_members WHERE id = ?`
  ).bind(member_id).first<{ user_id: string }>();

  if (contributingMember) {
    const membUserId = contributingMember.user_id;

    if (is_late) {
      batchStatements.push(
        c.env.DB.prepare(
          `INSERT INTO trust_scores (user_id, score, total_contributions, on_time_contributions, late_contributions, current_streak, longest_streak, updated_at)
           VALUES (?, 49, 1, 0, 1, 0, 0, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             total_contributions = total_contributions + 1,
             late_contributions = late_contributions + 1,
             current_streak = 0,
             updated_at = datetime('now')`
        ).bind(membUserId)
      );
    } else {
      batchStatements.push(
        c.env.DB.prepare(
          `INSERT INTO trust_scores (user_id, score, total_contributions, on_time_contributions, current_streak, longest_streak, updated_at)
           VALUES (?, 51, 1, 1, 1, 1, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
             total_contributions = total_contributions + 1,
             on_time_contributions = on_time_contributions + 1,
             current_streak = current_streak + 1,
             longest_streak = MAX(longest_streak, current_streak + 1),
             updated_at = datetime('now')`
        ).bind(membUserId)
      );
    }

    // Execute batch transaction for all writes so far
    if (batchStatements.length > 0) {
      await c.env.DB.batch(batchStatements);
    }

    // Recompute score from current stats and fetch streak for badge checks
    const stats = await c.env.DB.prepare(
      `SELECT total_contributions, on_time_contributions, late_contributions,
              missed_contributions, groups_completed, current_streak
       FROM trust_scores WHERE user_id = ?`
    ).bind(membUserId).first<{
      total_contributions: number;
      on_time_contributions: number;
      late_contributions: number;
      missed_contributions: number;
      groups_completed: number;
      current_streak: number;
    }>();

    if (stats) {
      const newScore = computeTrustScore(stats);
      const badgeStatements: D1PreparedStatement[] = [
        c.env.DB.prepare(
          `UPDATE trust_scores SET score = ? WHERE user_id = ?`
        ).bind(newScore, membUserId),
      ];

      // Award first_contribution badge
      if (stats.total_contributions === 1) {
        const badgeId = generateId();
        const badgeName = BADGE_NAMES['first_contribution'] ?? 'first_contribution';
        const existing = await c.env.DB.prepare(
          `SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ? AND group_id = ?`
        ).bind(membUserId, 'first_contribution', groupId).first();
        if (!existing) {
          badgeStatements.push(
            c.env.DB.prepare(
              `INSERT INTO susu_badges (id, user_id, badge_type, badge_name, group_id) VALUES (?, ?, ?, ?, ?)`
            ).bind(badgeId, membUserId, 'first_contribution', badgeName, groupId)
          );
        }
      }

      // Award streak milestone badges (only on-time contributions trigger these)
      if (!is_late) {
        const streak = stats.current_streak;
        let streakBadgeType: string | null = null;
        if (streak >= 20) streakBadgeType = 'streak_20';
        else if (streak >= 10) streakBadgeType = 'streak_10';
        else if (streak >= 5) streakBadgeType = 'streak_5';

        if (streakBadgeType) {
          const existing = await c.env.DB.prepare(
            `SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ? AND group_id = ?`
          ).bind(membUserId, streakBadgeType, groupId).first();
          if (!existing) {
            const badgeId = generateId();
            const badgeName = BADGE_NAMES[streakBadgeType] ?? streakBadgeType;
            badgeStatements.push(
              c.env.DB.prepare(
                `INSERT INTO susu_badges (id, user_id, badge_type, badge_name, group_id) VALUES (?, ?, ?, ?, ?)`
              ).bind(badgeId, membUserId, streakBadgeType, badgeName, groupId)
            );
          }
        }
      }

      // Batch trust score update + badge inserts
      await c.env.DB.batch(badgeStatements);
    }
  } else if (batchStatements.length > 0) {
    // No contributing member found but still need to flush penalty/guarantee writes
    await c.env.DB.batch(batchStatements);
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

  if (!contribution) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...contribution,
      receipt_number: `CS-${contribId.slice(0, 8).toUpperCase()}`,
      group_name: groupRow?.name ?? '',
      member_name: memberRow?.display_name ?? '',
      round: group.current_round,
      total_rounds: groupRow?.max_members ?? 0,
      is_late: is_late ?? false,
      penalty_pesewas,
    },
  }, 201);
});

// ─── POST /groups/:id/payouts — record payout for current round (creator only)

susu.post('/groups/:id/payouts', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round, contribution_pesewas, variant, goal_amount_pesewas, max_members FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{
    id: string;
    creator_id: string;
    current_round: number;
    contribution_pesewas: number;
    variant: SusuVariant;
    goal_amount_pesewas: number | null;
    max_members: number;
  }>();

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

  // ── Accumulating variant: final split payout ──────────────────────────────
  if (group.variant === 'accumulating') {
    // Only allow when all rounds are complete (current_round > max_members)
    if (group.current_round <= group.max_members) {
      return c.json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Accumulating groups can only distribute after all rounds are complete',
        },
      }, 400);
    }

    const totalRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>();
    const totalPool = totalRow?.total ?? 0;
    const sharePerMember = member_count > 0 ? Math.floor(totalPool / member_count) : 0;

    const { results: allMembers } = await c.env.DB.prepare(
      `SELECT id FROM susu_members WHERE group_id = ?`
    ).bind(groupId).all<{ id: string }>();

    const payouts: SusuPayoutRow[] = [];
    for (const m of allMembers) {
      const payoutId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(payoutId, groupId, m.id, group.current_round, sharePerMember).run();
      const p = await c.env.DB.prepare(
        `SELECT id, group_id, member_id, round, amount_pesewas, paid_at FROM susu_payouts WHERE id = ?`
      ).bind(payoutId).first<SusuPayoutRow>();
      if (p) payouts.push(p);
    }

    return c.json({ data: { type: 'accumulating_distribution', payouts, share_per_member: sharePerMember } }, 201);
  }

  // ── Goal-based variant: final distribution when goal is met ──────────────
  if (group.variant === 'goal_based') {
    const totalRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>();
    const totalPool = totalRow?.total ?? 0;

    if (group.goal_amount_pesewas && totalPool < group.goal_amount_pesewas) {
      return c.json({
        error: {
          code: 'BAD_REQUEST',
          message: `Goal not yet reached. Contributed: ${totalPool}, Goal: ${group.goal_amount_pesewas}`,
        },
      }, 400);
    }

    const sharePerMember = member_count > 0 ? Math.floor(totalPool / member_count) : 0;
    const { results: allMembers } = await c.env.DB.prepare(
      `SELECT id FROM susu_members WHERE group_id = ?`
    ).bind(groupId).all<{ id: string }>();

    const payouts: SusuPayoutRow[] = [];
    for (const m of allMembers) {
      const payoutId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(payoutId, groupId, m.id, group.current_round, sharePerMember).run();
      const p = await c.env.DB.prepare(
        `SELECT id, group_id, member_id, round, amount_pesewas, paid_at FROM susu_payouts WHERE id = ?`
      ).bind(payoutId).first<SusuPayoutRow>();
      if (p) payouts.push(p);
    }

    return c.json({ data: { type: 'goal_distribution', payouts, total_pool: totalPool, share_per_member: sharePerMember } }, 201);
  }

  // ── Bulk Purchase variant: single payout to group (supplier payment) ──────
  if (group.variant === 'bulk_purchase') {
    const totalRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>();
    const totalPool = totalRow?.total ?? 0;

    // Creator records a single payout representing the supplier payment
    const creatorMember = await c.env.DB.prepare(
      `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
    ).bind(groupId, userId).first<{ id: string }>();

    if (!creatorMember) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Creator member not found' } }, 404);
    }

    const payoutId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(payoutId, groupId, creatorMember.id, group.current_round, totalPool).run();

    const payout = await c.env.DB.prepare(
      `SELECT id, group_id, member_id, round, amount_pesewas, paid_at FROM susu_payouts WHERE id = ?`
    ).bind(payoutId).first<SusuPayoutRow>();

    return c.json({ data: { type: 'bulk_purchase_payment', payout, total_pool: totalPool } }, 201);
  }

  // ── Rotating / Bidding variant: one member gets payout per round ──────────
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

  if (!payout) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: payout }, 201);
});

// ─── POST /groups/:id/advance-round — advance to next round (creator only) ───

susu.post('/groups/:id/advance-round', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, current_round, variant, goal_amount_pesewas, max_members, guarantee_percent, guarantee_pool_pesewas FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{
    id: string;
    creator_id: string;
    current_round: number;
    variant: SusuVariant;
    goal_amount_pesewas: number | null;
    max_members: number;
    guarantee_percent: number;
    guarantee_pool_pesewas: number;
  }>();

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

  // Check all members contributed this round
  const contribCount = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_contributions WHERE group_id = ? AND round = ?`
  ).bind(groupId, group.current_round).first<{ cnt: number }>();

  if ((contribCount?.cnt ?? 0) < member_count) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Not all members have contributed this round' } },
      400
    );
  }

  // ── Variant-specific advance logic ────────────────────────────────────────

  if (group.variant === 'accumulating' || group.variant === 'funeral_fund' || group.variant === 'bulk_purchase') {
    // No per-round payout required. Contributions accumulate in the pool.
    // For accumulating: when all rounds complete, flag as complete.
    // For funeral_fund: pool grows indefinitely, payouts triggered by claims.
    // For bulk_purchase: pool grows until creator pays supplier.
    await c.env.DB.prepare(
      `UPDATE susu_groups
       SET current_round = current_round + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(groupId).run();

  } else if (group.variant === 'goal_based') {
    // No per-round payout. Check if goal has been reached to mark complete.
    const totalRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
    ).bind(groupId).first<{ total: number }>();
    const totalContributed = totalRow?.total ?? 0;
    const goalReached = group.goal_amount_pesewas !== null && totalContributed >= group.goal_amount_pesewas;

    await c.env.DB.prepare(
      `UPDATE susu_groups
       SET current_round = current_round + 1,
           is_active = CASE WHEN ? THEN 0 ELSE is_active END,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(goalReached ? 1 : 0, groupId).run();

  } else {
    // rotating or bidding — payout must be recorded first
    const payoutRow = await c.env.DB.prepare(
      `SELECT id FROM susu_payouts WHERE group_id = ? AND round = ?`
    ).bind(groupId, group.current_round).first();

    if (!payoutRow) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: 'Payout has not been recorded for this round' } },
        400
      );
    }

    // Distribute penalty pool as bonus if all contributions were on time this round
    const latePenaltyCount = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM susu_penalties WHERE group_id = ? AND round = ?`
    ).bind(groupId, group.current_round).first<{ cnt: number }>();

    const allOnTime = (latePenaltyCount?.cnt ?? 0) === 0;

    if (allOnTime) {
      const poolRow = await c.env.DB.prepare(
        `SELECT penalty_pool_pesewas FROM susu_groups WHERE id = ?`
      ).bind(groupId).first<{ penalty_pool_pesewas: number }>();

      const pool = poolRow?.penalty_pool_pesewas ?? 0;

      if (pool > 0 && member_count > 0) {
        const bonusPerMember = Math.floor(pool / member_count);
        if (bonusPerMember > 0) {
          const { results: allMembers } = await c.env.DB.prepare(
            `SELECT id FROM susu_members WHERE group_id = ?`
          ).bind(groupId).all<{ id: string }>();

          for (const m of allMembers) {
            const bonusPayoutId = generateId();
            await c.env.DB.prepare(
              `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(bonusPayoutId, groupId, m.id, group.current_round, bonusPerMember).run().catch(() => {
              // Ignore duplicate if payout already exists — bonus is best-effort
            });
          }

          await c.env.DB.prepare(
            `UPDATE susu_groups SET penalty_pool_pesewas = 0, updated_at = datetime('now') WHERE id = ?`
          ).bind(groupId).run();
        }
      }
    }

    await c.env.DB.prepare(
      `UPDATE susu_groups
       SET current_round = current_round + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(groupId).run();
  }

  // Refund guarantee pool if cycle is complete (new round > max_members)
  const afterRound = group.current_round + 1;
  if (group.guarantee_percent > 0 && group.guarantee_pool_pesewas > 0 && afterRound > group.max_members && member_count > 0) {
    const refundPerMember = Math.floor(group.guarantee_pool_pesewas / member_count);
    if (refundPerMember > 0) {
      const { results: allMembersForRefund } = await c.env.DB.prepare(
        `SELECT id FROM susu_members WHERE group_id = ?`
      ).bind(groupId).all<{ id: string }>();

      for (const m of allMembersForRefund) {
        const refundPayoutId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(refundPayoutId, groupId, m.id, group.current_round, refundPerMember).run().catch(() => {
          // Best-effort — ignore duplicate
        });
      }

      await c.env.DB.prepare(
        `UPDATE susu_groups SET guarantee_pool_pesewas = 0, updated_at = datetime('now') WHERE id = ?`
      ).bind(groupId).run();
    }
  }

  const updated = await c.env.DB.prepare(
    `SELECT id, name, creator_id, invite_code, contribution_pesewas, frequency,
            max_members, current_round, is_active, variant, goal_amount_pesewas, goal_description,
            penalty_percent, penalty_pool_pesewas, target_term, school_name, base_currency, event_name, event_date, guarantee_percent, guarantee_pool_pesewas, supplier_name, supplier_contact, item_description, estimated_savings_percent, crop_type, planting_month, harvest_month, organization_name, organization_type, created_at, updated_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<SusuGroupRow>();

  if (!updated) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: mapGroup(updated) });
});


// ─── GET /groups/:id/penalties — list penalties for the group ────────────────

susu.get('/groups/:id/penalties', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT sp.id, sp.group_id, sp.member_id, sm.display_name AS member_name,
            sp.round, sp.penalty_pesewas, sp.reason, sp.created_at
     FROM susu_penalties sp
     INNER JOIN susu_members sm ON sm.id = sp.member_id
     WHERE sp.group_id = ?
     ORDER BY sp.created_at DESC`
  ).bind(groupId).all<SusuPenaltyRow & { member_name: string }>();

  return c.json({ data: results });
});
// ─── GET /groups/trust/:userId — get a user's trust score ─────────────────────

susu.get('/groups/trust/:userId', async (c) => {
  const requestingUserId = c.get('userId');
  const targetUserId = c.req.param('userId');

  // Only allow if the requesting user shares at least one group with the target user
  if (requestingUserId !== targetUserId) {
    const sharedGroup = await c.env.DB.prepare(
      `SELECT 1 FROM susu_members m1
       INNER JOIN susu_members m2 ON m1.group_id = m2.group_id
       WHERE m1.user_id = ? AND m2.user_id = ?
       LIMIT 1`
    ).bind(requestingUserId, targetUserId).first();

    if (!sharedGroup) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'You do not share a group with this user' } }, 403);
    }
  }

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
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200);

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
     ORDER BY sc.round DESC, sc.contributed_at DESC
     LIMIT ?`
  ).bind(groupId, limit).all<SusuContributionRow & { member_display_name: string }>();

  const { results: payouts } = await c.env.DB.prepare(
    `SELECT sp.id, sp.group_id, sp.member_id, sp.round, sp.amount_pesewas, sp.paid_at,
            sm.display_name AS member_display_name
     FROM susu_payouts sp
     INNER JOIN susu_members sm ON sm.id = sp.member_id
     WHERE sp.group_id = ?
     ORDER BY sp.round DESC, sp.paid_at DESC
     LIMIT ?`
  ).bind(groupId, limit).all<SusuPayoutRow & { member_display_name: string }>();

  return c.json({ data: { contributions, payouts }, meta: { limit } });
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

interface FuneralClaimRow {
  id: string;
  group_id: string;
  claimant_member_id: string;
  deceased_name: string;
  relationship: string;
  description: string | null;
  amount_pesewas: number;
  status: string;
  approved_by_count: number;
  denied_by_count: number;
  approval_threshold: number;
  created_at: string;
  resolved_at: string | null;
}

interface WelfareClaimRow {
  id: string;
  group_id: string;
  claimant_member_id: string;
  claim_type: string;
  description: string;
  amount_requested_pesewas: number;
  amount_approved_pesewas: number | null;
  status: string;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
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

  if (!row) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...row,
      premium_pesewas: Math.round(row.amount_pesewas * row.premium_percent / 100),
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

  if (!final) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...final,
      premium_pesewas: Math.round(final.amount_pesewas * final.premium_percent / 100),
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

  // Batch: insert payout + mark request as paid in a single transaction
  const payoutId = generateId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(payoutId, groupId, request.requester_member_id, group.current_round, totalPayout),
    c.env.DB.prepare(
      `UPDATE early_payout_requests SET status = 'paid', resolved_at = datetime('now') WHERE id = ?`
    ).bind(requestId),
  ]);

  const final = await c.env.DB.prepare(
    `SELECT epr.*, sm.display_name AS requester_name
     FROM early_payout_requests epr
     INNER JOIN susu_members sm ON sm.id = epr.requester_member_id
     WHERE epr.id = ?`
  ).bind(requestId).first<EarlyPayoutRequestRow & { requester_name: string }>();

  if (!final) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...final,
      premium_pesewas: premium,
      payout_amount_pesewas: totalPayout,
    },
  });
});

// ─── GET /groups/:id/analytics — group analytics dashboard ──────────────────

susu.get('/groups/:id/analytics', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership or creator access
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  const groupRow = await c.env.DB.prepare(
    `SELECT id, creator_id, contribution_pesewas, frequency, max_members,
            current_round, penalty_pool_pesewas, created_at
     FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{
    id: string;
    creator_id: string;
    contribution_pesewas: number;
    frequency: SusuFrequency;
    max_members: number;
    current_round: number;
    penalty_pool_pesewas: number;
    created_at: string;
  }>();

  if (!groupRow || (!myMember && groupRow.creator_id !== userId)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Total contributions (count + sum)
  const totalContribRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_pesewas), 0) AS total
     FROM susu_contributions WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number; total: number }>();

  const total_contributed_pesewas = totalContribRow?.total ?? 0;
  const totalContribCount = totalContribRow?.cnt ?? 0;

  // Total payouts
  const totalPayoutsRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_payouts WHERE group_id = ?`
  ).bind(groupId).first<{ total: number }>();

  const total_payouts_pesewas = totalPayoutsRow?.total ?? 0;

  // Late contributions: any contribution that has a penalty entry
  // (penalty is keyed on member_id + round)
  const { results: penaltyRows } = await c.env.DB.prepare(
    `SELECT DISTINCT member_id, round FROM susu_penalties WHERE group_id = ?`
  ).bind(groupId).all<{ member_id: string; round: number }>();

  const lateSet = new Set(penaltyRows.map((p) => `${p.member_id}:${p.round}`));
  const lateCount = lateSet.size;
  const onTimeCount = Math.max(0, totalContribCount - lateCount);

  // Member count for expected contributions
  const memberCountRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const memberCount = memberCountRow?.cnt ?? 0;

  // Rounds completed = current_round - 1 (rounds before the current one)
  const rounds_completed = Math.max(0, groupRow.current_round - 1);
  const total_rounds = groupRow.max_members;

  // Expected contributions = member_count * rounds_completed
  const expectedContributions = memberCount * rounds_completed;
  const contribution_rate =
    expectedContributions > 0
      ? Math.round((totalContribCount / expectedContributions) * 100)
      : 100;

  const on_time_rate =
    totalContribCount > 0
      ? Math.round((onTimeCount / totalContribCount) * 100)
      : 100;

  // Per-round breakdown
  const { results: roundRows } = await c.env.DB.prepare(
    `SELECT round,
            COUNT(*) AS contributions,
            COALESCE(SUM(amount_pesewas), 0) AS total_pesewas
     FROM susu_contributions
     WHERE group_id = ?
     GROUP BY round
     ORDER BY round ASC`
  ).bind(groupId).all<{ round: number; contributions: number; total_pesewas: number }>();

  const per_round = roundRows.map((r) => ({
    round: r.round,
    total_pesewas: r.total_pesewas,
    contributions: r.contributions,
    expected: memberCount,
  }));

  // Per-member breakdown
  const { results: memberRows } = await c.env.DB.prepare(
    `SELECT sm.display_name AS member_name,
            COUNT(sc.id) AS contributions,
            COALESCE(SUM(sc.amount_pesewas), 0) AS total_pesewas
     FROM susu_members sm
     LEFT JOIN susu_contributions sc ON sc.member_id = sm.id AND sc.group_id = sm.group_id
     WHERE sm.group_id = ?
     GROUP BY sm.id, sm.display_name
     ORDER BY total_pesewas DESC`
  ).bind(groupId).all<{ member_name: string; contributions: number; total_pesewas: number }>();

  // Per-member on-time count: contributions - late entries for that member
  const { results: memberPenaltyRows } = await c.env.DB.prepare(
    `SELECT sm.display_name AS member_name, COUNT(DISTINCT sp.round) AS late_count
     FROM susu_penalties sp
     INNER JOIN susu_members sm ON sm.id = sp.member_id
     WHERE sp.group_id = ?
     GROUP BY sp.member_id, sm.display_name`
  ).bind(groupId).all<{ member_name: string; late_count: number }>();

  const lateByMember = new Map(memberPenaltyRows.map((r) => [r.member_name, r.late_count]));

  const per_member = memberRows.map((m) => {
    const lateForMember = lateByMember.get(m.member_name) ?? 0;
    const on_time = Math.max(0, m.contributions - lateForMember);
    return {
      member_name: m.member_name,
      contributions: m.contributions,
      on_time,
      total_pesewas: m.total_pesewas,
    };
  });

  // Projected completion date based on frequency
  let projected_completion_date: string | null = null;
  const remainingRounds = total_rounds - rounds_completed;

  if (remainingRounds > 0) {
    const now = new Date();
    let projectedMs = now.getTime();

    const freqMs: Record<SusuFrequency, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    projectedMs += remainingRounds * freqMs[groupRow.frequency];
    projected_completion_date = new Date(projectedMs).toISOString().split('T')[0];
  }

  return c.json({
    data: {
      total_contributed_pesewas,
      total_payouts_pesewas,
      penalty_pool_pesewas: groupRow.penalty_pool_pesewas,
      contribution_rate,
      on_time_rate,
      rounds_completed,
      total_rounds,
      projected_completion_date,
      per_round,
      per_member,
    },
  });
});

// ─── GET /groups/:id/leaderboard — ranked member list ────────────────────────

susu.get('/groups/:id/leaderboard', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT
       sm.display_name AS member_name,
       COALESCE(ts.score, 50) AS trust_score,
       COALESCE(ts.current_streak, 0) AS current_streak,
       COALESCE(ts.total_contributions, 0) AS total_contributions,
       (SELECT COUNT(*) FROM susu_badges b WHERE b.user_id = sm.user_id AND b.group_id = ?) AS badges_count
     FROM susu_members sm
     LEFT JOIN trust_scores ts ON ts.user_id = sm.user_id
     WHERE sm.group_id = ?
     ORDER BY trust_score DESC, current_streak DESC, total_contributions DESC`
  ).bind(groupId, groupId).all<{
    member_name: string;
    trust_score: number;
    current_streak: number;
    total_contributions: number;
    badges_count: number;
  }>();

  return c.json({ data: results });
});

// ─── GET /groups/:id/badges — badges earned by the current user in this group ─

susu.get('/groups/:id/badges', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, badge_type, badge_name, earned_at
     FROM susu_badges
     WHERE user_id = ? AND group_id = ?
     ORDER BY earned_at ASC`
  ).bind(userId, groupId).all<{
    id: string;
    badge_type: string;
    badge_name: string;
    earned_at: string;
  }>();

  return c.json({ data: results });
});

// ─── GET /groups/:id/messages — fetch chat messages (cursor pagination) ───────

susu.get('/groups/:id/messages', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const limitRaw = c.req.query('limit');
  const before = c.req.query('before');
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);

  interface MessageRow {
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    attachment_key: string | null;
    attachment_type: string | null;
    attachment_name: string | null;
    attachment_size: number | null;
  }

  let query: string;
  let bindings: unknown[];

  if (before) {
    const cursorRow = await c.env.DB.prepare(
      `SELECT rowid FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(before, groupId).first<{ rowid: number }>();

    if (!cursorRow) {
      return c.json({ data: [] });
    }

    query = `
      SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
             m.reply_to_id, m.edited_at, m.deleted_at,
             m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
             rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
      FROM susu_messages m
      JOIN susu_members sm ON m.member_id = sm.id
      LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
      LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
      WHERE m.group_id = ? AND m.rowid < ?
      ORDER BY m.rowid DESC
      LIMIT ?
    `;
    bindings = [groupId, cursorRow.rowid, limit];
  } else {
    query = `
      SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
             m.reply_to_id, m.edited_at, m.deleted_at,
             m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
             rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
      FROM susu_messages m
      JOIN susu_members sm ON m.member_id = sm.id
      LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
      LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
      WHERE m.group_id = ?
      ORDER BY m.rowid DESC
      LIMIT ?
    `;
    bindings = [groupId, limit];
  }

  const { results } = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all<MessageRow>();

  // Reverse so oldest-first
  const rawMessages = [...results].reverse();

  // Enrich with reactions and read_by_count
  const messages = [];

  // Get total member count for read receipt calculation
  const memberCountRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const totalMembers = memberCountRow?.cnt ?? 0;

  for (const msg of rawMessages) {
    // Get reactions for this message
    const { results: reactionRows } = await c.env.DB.prepare(
      `SELECT emoji, COUNT(*) AS count,
              MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
       FROM message_reactions
       WHERE message_id = ?
       GROUP BY emoji`
    ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

    // Count how many members have read up to or past this message
    const readCountRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM chat_read_receipts crr
       WHERE crr.group_id = ? AND crr.last_read_message_id IS NOT NULL
       AND (SELECT rowid FROM susu_messages WHERE id = crr.last_read_message_id) >= (SELECT rowid FROM susu_messages WHERE id = ?)`
    ).bind(groupId, msg.id).first<{ cnt: number }>();

    messages.push({
      id: msg.id,
      content: msg.deleted_at ? '' : msg.content,
      sender_name: msg.sender_name,
      sender_user_id: msg.sender_user_id,
      created_at: msg.created_at,
      reply_to_id: msg.reply_to_id,
      reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
      reply_to_sender: msg.reply_to_sender,
      edited_at: msg.edited_at,
      is_deleted: msg.deleted_at !== null,
      reactions: reactionRows.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reacted_by_me: r.reacted_by_me === 1,
      })),
      read_by_count: readCountRow?.cnt ?? 0,
      attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
      attachment_type: msg.attachment_type,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
    });
  }

  return c.json({ data: messages });
});

// ─── GET /groups/:id/messages/poll — long-poll for new messages ──────────────

susu.get('/groups/:id/messages/poll', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const afterId = c.req.query('after');
  const timeoutSec = Math.min(parseInt(c.req.query('timeout') ?? '25', 10) || 25, 25);

  interface MessageRow {
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    attachment_key: string | null;
    attachment_type: string | null;
    attachment_name: string | null;
    attachment_size: number | null;
  }

  const checkForNew = async (): Promise<MessageRow[]> => {
    if (!afterId) return [];

    const cursorRow = await c.env.DB.prepare(
      `SELECT rowid FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(afterId, groupId).first<{ rowid: number }>();

    if (!cursorRow) return [];

    const { results } = await c.env.DB.prepare(
      `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
              m.reply_to_id, m.edited_at, m.deleted_at,
              m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
              rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
       FROM susu_messages m
       JOIN susu_members sm ON m.member_id = sm.id
       LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
       LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
       WHERE m.group_id = ? AND m.rowid > ?
       ORDER BY m.rowid ASC
       LIMIT 50`
    ).bind(groupId, cursorRow.rowid).all<MessageRow>();

    return results;
  };

  // Try up to timeoutSec/2 iterations (check every 2 seconds)
  const maxChecks = Math.ceil(timeoutSec / 2);
  for (let i = 0; i < maxChecks; i++) {
    const newMsgs = await checkForNew();
    if (newMsgs.length > 0) {
      // Enrich with reactions and read_by_count
      const enriched = [];
      for (const msg of newMsgs) {
        const { results: reactionRows } = await c.env.DB.prepare(
          `SELECT emoji, COUNT(*) AS count,
                  MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
           FROM message_reactions
           WHERE message_id = ?
           GROUP BY emoji`
        ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

        const readCountRow = await c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM chat_read_receipts crr
           WHERE crr.group_id = ? AND crr.last_read_message_id IS NOT NULL
           AND (SELECT rowid FROM susu_messages WHERE id = crr.last_read_message_id) >= (SELECT rowid FROM susu_messages WHERE id = ?)`
        ).bind(groupId, msg.id).first<{ cnt: number }>();

        enriched.push({
          id: msg.id,
          content: msg.deleted_at ? '' : msg.content,
          sender_name: msg.sender_name,
          sender_user_id: msg.sender_user_id,
          created_at: msg.created_at,
          reply_to_id: msg.reply_to_id,
          reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
          reply_to_sender: msg.reply_to_sender,
          edited_at: msg.edited_at,
          is_deleted: msg.deleted_at !== null,
          reactions: reactionRows.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reacted_by_me: r.reacted_by_me === 1,
          })),
          read_by_count: readCountRow?.cnt ?? 0,
          attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
          attachment_type: msg.attachment_type,
          attachment_name: msg.attachment_name,
          attachment_size: msg.attachment_size,
        });
      }

      return c.json({ data: enriched, has_more: newMsgs.length === 50 });
    }

    // Wait 2 seconds before next check (except on last iteration)
    if (i < maxChecks - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Timeout — return empty
  return c.json({ data: [], has_more: false });
});

// ─── POST /groups/:id/typing — set typing indicator ─────────────────────────

susu.post('/groups/:id/typing', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id, display_name FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string; display_name: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Store typing state in KV as JSON object: { [memberId]: { name, timestamp } }
  const kvKey = `typing:${groupId}`;
  const existing = await c.env.KV.get<Record<string, { name: string; ts: number }>>(kvKey, 'json');
  const typingMap = existing ?? {};

  typingMap[myMember.id] = { name: myMember.display_name, ts: Date.now() };

  // Clean up entries older than 5 seconds
  const cutoff = Date.now() - 5000;
  for (const [key, val] of Object.entries(typingMap)) {
    if (val.ts < cutoff) delete typingMap[key];
  }

  await c.env.KV.put(kvKey, JSON.stringify(typingMap), { expirationTtl: 10 });

  return c.body(null, 204);
});

// ─── GET /groups/:id/typing — get typing indicators ─────────────────────────

susu.get('/groups/:id/typing', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const kvKey = `typing:${groupId}`;
  const typingMap = await c.env.KV.get<Record<string, { name: string; ts: number }>>(kvKey, 'json');

  if (!typingMap) {
    return c.json({ data: [] });
  }

  const cutoff = Date.now() - 5000;
  const typingUsers = Object.entries(typingMap)
    .filter(([memberId, val]) => val.ts >= cutoff && memberId !== myMember.id)
    .map(([memberId, val]) => ({
      member_id: memberId,
      display_name: val.name,
    }));

  return c.json({ data: typingUsers });
});

// ─── POST /groups/:id/messages/read — mark messages as read ─────────────────

susu.post('/groups/:id/messages/read', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let body: { last_message_id: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  if (!body.last_message_id || typeof body.last_message_id !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'last_message_id is required' } }, 422);
  }

  // Verify message exists in this group
  const msgExists = await c.env.DB.prepare(
    `SELECT id FROM susu_messages WHERE id = ? AND group_id = ?`
  ).bind(body.last_message_id, groupId).first<{ id: string }>();

  if (!msgExists) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  await c.env.DB.prepare(
    `INSERT INTO chat_read_receipts (member_id, group_id, last_read_message_id, last_read_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(member_id, group_id)
     DO UPDATE SET last_read_message_id = excluded.last_read_message_id, last_read_at = excluded.last_read_at`
  ).bind(myMember.id, groupId, body.last_message_id).run();

  return c.body(null, 204);
});

// ─── POST /groups/:id/messages — send a chat message ─────────────────────────

susu.post('/groups/:id/messages', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership and get member_id
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = susuMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  const messageId = generateId();
  const replyToId = parsed.data.reply_to_id ?? null;

  // Validate reply_to_id if provided
  if (replyToId) {
    const replyMsg = await c.env.DB.prepare(
      `SELECT id FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(replyToId, groupId).first<{ id: string }>();
    if (!replyMsg) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Reply target message not found in this group' } }, 404);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO susu_messages (id, group_id, member_id, content, reply_to_id) VALUES (?, ?, ?, ?, ?)`
  ).bind(messageId, groupId, myMember.id, parsed.data.content, replyToId).run();

  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
  }>();

  const message = row ? {
    id: row.id,
    content: row.content,
    sender_name: row.sender_name,
    sender_user_id: row.sender_user_id,
    created_at: row.created_at,
    reply_to_id: row.reply_to_id,
    reply_to_content: row.reply_to_content ? (row.reply_to_content.length > 100 ? row.reply_to_content.slice(0, 100) + '...' : row.reply_to_content) : null,
    reply_to_sender: row.reply_to_sender,
    edited_at: row.edited_at,
    is_deleted: false,
    reactions: [] as Array<{ emoji: string; count: number; reacted_by_me: boolean }>,
    read_by_count: 0,
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    attachment_size: null,
  } : null;

  return c.json({ data: message }, 201);
});

// ─── POST /groups/:id/messages/:messageId/react — toggle emoji reaction ──────

susu.post('/groups/:id/messages/:messageId/react', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists in this group
  const msg = await c.env.DB.prepare(
    `SELECT id FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = messageReactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  const { emoji } = parsed.data;

  // Check if reaction already exists (toggle)
  const existing = await c.env.DB.prepare(
    `SELECT id FROM message_reactions WHERE message_id = ? AND member_id = ? AND emoji = ?`
  ).bind(messageId, myMember.id, emoji).first<{ id: string }>();

  if (existing) {
    // Remove reaction
    await c.env.DB.prepare(
      `DELETE FROM message_reactions WHERE id = ?`
    ).bind(existing.id).run();
  } else {
    // Add reaction
    const reactionId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO message_reactions (id, message_id, member_id, emoji) VALUES (?, ?, ?, ?)`
    ).bind(reactionId, messageId, myMember.id, emoji).run();
  }

  // Return updated reactions for this message
  const { results: reactionRows } = await c.env.DB.prepare(
    `SELECT emoji, COUNT(*) AS count,
            MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
     FROM message_reactions
     WHERE message_id = ?
     GROUP BY emoji`
  ).bind(myMember.id, messageId).all<{ emoji: string; count: number; reacted_by_me: number }>();

  const reactions = reactionRows.map((r) => ({
    emoji: r.emoji,
    count: r.count,
    reacted_by_me: r.reacted_by_me === 1,
  }));

  return c.json({ data: { message_id: messageId, reactions } });
});

// ─── PUT /groups/:id/messages/:messageId — edit a message ────────────────────

susu.put('/groups/:id/messages/:messageId', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists, belongs to sender, and is within 15 minutes
  const msg = await c.env.DB.prepare(
    `SELECT id, member_id, created_at FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string; member_id: string; created_at: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  if (msg.member_id !== myMember.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own messages' } }, 403);
  }

  // Check 15-minute window
  const createdAt = new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z');
  const now = new Date();
  const diffMin = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  if (diffMin > 15) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messages can only be edited within 15 minutes of sending' } }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  await c.env.DB.prepare(
    `UPDATE susu_messages SET content = ?, edited_at = datetime('now') WHERE id = ?`
  ).bind(parsed.data.content, messageId).run();

  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  // Get reactions
  const { results: reactionRows } = await c.env.DB.prepare(
    `SELECT emoji, COUNT(*) AS count,
            MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
     FROM message_reactions WHERE message_id = ? GROUP BY emoji`
  ).bind(myMember.id, messageId).all<{ emoji: string; count: number; reacted_by_me: number }>();

  return c.json({
    data: {
      id: row.id,
      content: row.content,
      sender_name: row.sender_name,
      sender_user_id: row.sender_user_id,
      created_at: row.created_at,
      reply_to_id: row.reply_to_id,
      reply_to_content: row.reply_to_content ? (row.reply_to_content.length > 100 ? row.reply_to_content.slice(0, 100) + '...' : row.reply_to_content) : null,
      reply_to_sender: row.reply_to_sender,
      edited_at: row.edited_at,
      is_deleted: false,
      reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count, reacted_by_me: r.reacted_by_me === 1 })),
      read_by_count: 0,
      attachment_url: row.attachment_key ? `/susu/groups/${groupId}/messages/${row.id}/attachment` : null,
      attachment_type: row.attachment_type,
      attachment_name: row.attachment_name,
      attachment_size: row.attachment_size,
    },
  });
});

// ─── DELETE /groups/:id/messages/:messageId — soft delete a message ──────────

susu.delete('/groups/:id/messages/:messageId', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists
  const msg = await c.env.DB.prepare(
    `SELECT id, member_id FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string; member_id: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  // Check if sender or group creator (for moderation)
  const group = await c.env.DB.prepare(
    `SELECT creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ creator_id: string }>();

  if (msg.member_id !== myMember.id && group?.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' } }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE susu_messages SET deleted_at = datetime('now') WHERE id = ?`
  ).bind(messageId).run();

  return c.body(null, 204);
});

// ─── GET /groups/:id/messages/search — search messages ───────────────────────

susu.get('/groups/:id/messages/search', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const q = c.req.query('q') ?? '';
  if (q.length < 2) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' } }, 422);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.group_id = ? AND m.deleted_at IS NULL AND m.content LIKE ?
     ORDER BY m.created_at DESC
     LIMIT 20`
  ).bind(groupId, `%${q}%`).all<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  const messages = [];
  for (const msg of results) {
    const { results: reactionRows } = await c.env.DB.prepare(
      `SELECT emoji, COUNT(*) AS count,
              MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
       FROM message_reactions WHERE message_id = ? GROUP BY emoji`
    ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

    messages.push({
      id: msg.id,
      content: msg.content,
      sender_name: msg.sender_name,
      sender_user_id: msg.sender_user_id,
      created_at: msg.created_at,
      reply_to_id: msg.reply_to_id,
      reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
      reply_to_sender: msg.reply_to_sender,
      edited_at: msg.edited_at,
      is_deleted: false,
      reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count, reacted_by_me: r.reacted_by_me === 1 })),
      read_by_count: 0,
      attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
      attachment_type: msg.attachment_type,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
    });
  }

  return c.json({ data: messages });
});

// ─── POST /groups/:id/funeral-claim — submit a funeral claim ─────────────────

susu.post('/groups/:id/funeral-claim', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const body = await c.req.json();
  const parsed = funeralClaimSchema.safeParse(body);

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

  // Verify group is funeral_fund variant
  const group = await c.env.DB.prepare(
    `SELECT id, variant FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; variant: SusuVariant }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.variant !== 'funeral_fund') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Funeral claims are only for funeral fund groups' } }, 400);
  }

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'You are not a member of this group' } }, 404);
  }

  // Check no active claim already exists
  const existingClaim = await c.env.DB.prepare(
    `SELECT id FROM funeral_claims WHERE group_id = ? AND status IN ('pending', 'approved')`
  ).bind(groupId).first();

  if (existingClaim) {
    return c.json({ error: { code: 'CONFLICT', message: 'There is already an active claim for this group' } }, 409);
  }

  // Calculate available pool = total contributions - total paid claims
  const totalContribRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM susu_contributions WHERE group_id = ?`
  ).bind(groupId).first<{ total: number }>();
  const totalContributed = totalContribRow?.total ?? 0;

  const totalPaidRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_pesewas), 0) AS total FROM funeral_claims WHERE group_id = ? AND status = 'paid'`
  ).bind(groupId).first<{ total: number }>();
  const totalPaid = totalPaidRow?.total ?? 0;

  const availablePool = totalContributed - totalPaid;

  if (availablePool <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No funds available in the pool' } }, 400);
  }

  // Threshold = ceil(members / 2)
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const memberCount = countRow?.cnt ?? 0;
  const threshold = Math.ceil(memberCount / 2);

  const claimId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO funeral_claims (id, group_id, claimant_member_id, deceased_name, relationship, description, amount_pesewas, approval_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    claimId, groupId, myMember.id,
    parsed.data.deceased_name, parsed.data.relationship, parsed.data.description ?? null,
    availablePool, threshold
  ).run();

  const claim = await c.env.DB.prepare(
    `SELECT fc.*, sm.display_name AS claimant_name
     FROM funeral_claims fc
     INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
     WHERE fc.id = ?`
  ).bind(claimId).first<FuneralClaimRow & { claimant_name: string }>();

  if (!claim) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...claim,
      my_vote: null,
    },
  }, 201);
});

// ─── GET /groups/:id/funeral-claim — get active funeral claim ────────────────

susu.get('/groups/:id/funeral-claim', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Find active claim (pending or approved)
  const claim = await c.env.DB.prepare(
    `SELECT fc.*, sm.display_name AS claimant_name
     FROM funeral_claims fc
     INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
     WHERE fc.group_id = ? AND fc.status IN ('pending', 'approved')
     ORDER BY fc.created_at DESC LIMIT 1`
  ).bind(groupId).first<FuneralClaimRow & { claimant_name: string }>();

  if (!claim) {
    return c.json({ data: null });
  }

  // Find my vote
  const myVoteRow = await c.env.DB.prepare(
    `SELECT vote FROM funeral_claim_votes WHERE claim_id = ? AND member_id = ?`
  ).bind(claim.id, myMember.id).first<{ vote: string }>();

  return c.json({
    data: {
      ...claim,
      my_vote: myVoteRow?.vote ?? null,
    },
  });
});

// ─── POST /groups/:id/funeral-claim/:claimId/vote — vote on a funeral claim ──

susu.post('/groups/:id/funeral-claim/:claimId/vote', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const claimId = c.req.param('claimId');

  const body = await c.req.json();
  const parsed = funeralClaimVoteSchema.safeParse(body);

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

  // Get the pending claim
  const claim = await c.env.DB.prepare(
    `SELECT * FROM funeral_claims WHERE id = ? AND group_id = ? AND status = 'pending'`
  ).bind(claimId, groupId).first<FuneralClaimRow>();

  if (!claim) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No pending claim found' } }, 404);
  }

  // Claimant cannot vote on their own claim
  if (claim.claimant_member_id === myMember.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You cannot vote on your own claim' } }, 403);
  }

  // Cast vote
  const voteId = generateId();
  try {
    await c.env.DB.prepare(
      `INSERT INTO funeral_claim_votes (id, claim_id, member_id, vote)
       VALUES (?, ?, ?, ?)`
    ).bind(voteId, claimId, myMember.id, parsed.data.vote).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'You have already voted on this claim' } }, 409);
    }
    throw err;
  }

  // Update vote counts
  const voteColumn = parsed.data.vote === 'approve' ? 'approved_by_count' : 'denied_by_count';
  await c.env.DB.prepare(
    `UPDATE funeral_claims SET ${voteColumn} = ${voteColumn} + 1 WHERE id = ?`
  ).bind(claimId).run();

  // Re-fetch updated claim
  const updated = await c.env.DB.prepare(
    `SELECT * FROM funeral_claims WHERE id = ?`
  ).bind(claimId).first<FuneralClaimRow>();

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  }

  // Get total members for auto-deny calculation
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const totalMembers = countRow?.cnt ?? 0;

  // Auto-approve if approved_by_count >= threshold
  if (updated.approved_by_count >= updated.approval_threshold) {
    await c.env.DB.prepare(
      `UPDATE funeral_claims SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`
    ).bind(claimId).run();
  }
  // Auto-deny if it's impossible to reach threshold
  else if (updated.denied_by_count > totalMembers - updated.approval_threshold) {
    await c.env.DB.prepare(
      `UPDATE funeral_claims SET status = 'denied', resolved_at = datetime('now') WHERE id = ?`
    ).bind(claimId).run();
  }

  // Return final state
  const final = await c.env.DB.prepare(
    `SELECT fc.*, sm.display_name AS claimant_name
     FROM funeral_claims fc
     INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
     WHERE fc.id = ?`
  ).bind(claimId).first<FuneralClaimRow & { claimant_name: string }>();

  if (!final) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...final,
      my_vote: parsed.data.vote,
    },
  });
});

// ─── POST /groups/:id/funeral-claim/:claimId/pay — pay out approved claim ────

susu.post('/groups/:id/funeral-claim/:claimId/pay', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const claimId = c.req.param('claimId');

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

  // Get the approved claim
  const claim = await c.env.DB.prepare(
    `SELECT * FROM funeral_claims WHERE id = ? AND group_id = ? AND status = 'approved'`
  ).bind(claimId, groupId).first<FuneralClaimRow>();

  if (!claim) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No approved claim found' } }, 404);
  }

  // Record as a susu_payout
  const payoutId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO susu_payouts (id, group_id, member_id, round, amount_pesewas)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(payoutId, groupId, claim.claimant_member_id, group.current_round, claim.amount_pesewas).run();

  // Mark claim as paid
  await c.env.DB.prepare(
    `UPDATE funeral_claims SET status = 'paid', resolved_at = datetime('now') WHERE id = ?`
  ).bind(claimId).run();

  const final = await c.env.DB.prepare(
    `SELECT fc.*, sm.display_name AS claimant_name
     FROM funeral_claims fc
     INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
     WHERE fc.id = ?`
  ).bind(claimId).first<FuneralClaimRow & { claimant_name: string }>();

  if (!final) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({
    data: {
      ...final,
      payout_amount_pesewas: claim.amount_pesewas,
    },
  });
});

// ─── GET /groups/:id/funeral-claims/history — past funeral claims ────────────

susu.get('/groups/:id/funeral-claims/history', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT fc.*, sm.display_name AS claimant_name
     FROM funeral_claims fc
     INNER JOIN susu_members sm ON sm.id = fc.claimant_member_id
     WHERE fc.group_id = ?
     ORDER BY fc.created_at DESC`
  ).bind(groupId).all<FuneralClaimRow & { claimant_name: string }>();

  // Attach my_vote to each claim
  const data = [];
  for (const claim of results) {
    const myVoteRow = await c.env.DB.prepare(
      `SELECT vote FROM funeral_claim_votes WHERE claim_id = ? AND member_id = ?`
    ).bind(claim.id, myMember.id).first<{ vote: string }>();
    data.push({ ...claim, my_vote: myVoteRow?.vote ?? null });
  }

  return c.json({ data });
});

// ─── GET /certificate — generate micro-credit certificate ───────────────────

susu.get('/certificate', async (c) => {
  const userId = c.get('userId');

  // Fetch user info
  const user = await c.env.DB.prepare(
    `SELECT id, name, phone, created_at FROM users WHERE id = ?`
  ).bind(userId).first<{ id: string; name: string; phone: string; created_at: string }>();

  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  // Fetch trust score data
  const trustRow = await c.env.DB.prepare(
    `SELECT score, total_contributions, on_time_contributions, late_contributions,
            missed_contributions, groups_completed, current_streak, longest_streak
     FROM trust_scores WHERE user_id = ?`
  ).bind(userId).first<{
    score: number;
    total_contributions: number;
    on_time_contributions: number;
    late_contributions: number;
    missed_contributions: number;
    groups_completed: number;
    current_streak: number;
    longest_streak: number;
  }>();

  const score = trustRow?.score ?? 50;
  const trustLabel = getTrustLabel(score);

  // Count total groups participated
  const groupsRow = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT sm.group_id) AS total_groups
     FROM susu_members sm WHERE sm.user_id = ?`
  ).bind(userId).first<{ total_groups: number }>();

  // Total contributed pesewas across all groups
  const contribRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(sc.amount_pesewas), 0) AS total_pesewas
     FROM susu_contributions sc
     INNER JOIN susu_members sm ON sm.id = sc.member_id
     WHERE sm.user_id = ?`
  ).bind(userId).first<{ total_pesewas: number }>();

  // Earliest joined_at
  const memberSinceRow = await c.env.DB.prepare(
    `SELECT MIN(joined_at) AS earliest FROM susu_members WHERE user_id = ?`
  ).bind(userId).first<{ earliest: string | null }>();

  // Badges earned
  const badgesResult = await c.env.DB.prepare(
    `SELECT DISTINCT badge_name FROM susu_badges WHERE user_id = ? ORDER BY badge_name`
  ).bind(userId).all<{ badge_name: string }>();

  const badges = badgesResult.results.map((b) => b.badge_name);

  const totalContribs = trustRow?.total_contributions ?? 0;
  const onTimeContribs = trustRow?.on_time_contributions ?? 0;
  const onTimeRate = totalContribs > 0 ? Math.round((onTimeContribs / totalContribs) * 100) : 0;
  const memberSince = memberSinceRow?.earliest ?? user.created_at;

  // Generate certificate ID from user_id + timestamp
  const generatedAt = new Date().toISOString();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(userId + generatedAt)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const certId = 'CS-CERT-' + hashArray.slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  // Format member since date
  const sinceDate = new Date(memberSince);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const sinceFormatted = `${monthNames[sinceDate.getMonth()]} ${sinceDate.getFullYear()}`;

  const summary = `${user.name} has been an active CediSense Susu member since ${sinceFormatted}. ` +
    `With a Trust Score of ${score}/100 (${trustLabel}), they have completed ` +
    `${trustRow?.groups_completed ?? 0} savings group${(trustRow?.groups_completed ?? 0) !== 1 ? 's' : ''} and made ` +
    `${totalContribs} contribution${totalContribs !== 1 ? 's' : ''} with a ${onTimeRate}% on-time rate. ` +
    `This demonstrates consistent financial discipline and reliability.`;

  const certificate: CreditCertificate = {
    certificate_id: certId,
    user_name: user.name,
    user_phone: user.phone,
    generated_at: generatedAt,
    trust_score: score,
    trust_label: trustLabel,
    total_groups_participated: groupsRow?.total_groups ?? 0,
    total_groups_completed: trustRow?.groups_completed ?? 0,
    total_contributed_pesewas: contribRow?.total_pesewas ?? 0,
    total_contributions: totalContribs,
    on_time_rate: onTimeRate,
    current_streak: trustRow?.current_streak ?? 0,
    longest_streak: trustRow?.longest_streak ?? 0,
    member_since: memberSince,
    badges_earned: badges,
    summary,
  };

  // Persist certificate for verification
  await c.env.DB.prepare(
    `INSERT INTO credit_certificates (id, user_id, certificate_data) VALUES (?, ?, ?)`
  ).bind(certId, userId, JSON.stringify(certificate)).run();

  return c.json({ data: certificate });
});

// ─── GET /certificate/verify/:certificateId — public verification ────────────

susu.get('/certificate/verify/:certificateId', async (c) => {
  const certId = c.req.param('certificateId');

  const row = await c.env.DB.prepare(
    `SELECT certificate_data, created_at FROM credit_certificates WHERE id = ?`
  ).bind(certId).first<{ certificate_data: string; created_at: string }>();

  if (!row) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Certificate not found' } },
      404
    );
  }

  const certificate: CreditCertificate = JSON.parse(row.certificate_data);
  return c.json({ data: certificate });
});

// ─── POST /groups/:id/guarantee-claim — claim from guarantee fund (creator only)

susu.post('/groups/:id/guarantee-claim', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, guarantee_percent, guarantee_pool_pesewas FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; guarantee_percent: number; guarantee_pool_pesewas: number }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can claim from the guarantee fund' } }, 403);
  }

  if (group.guarantee_percent === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Guarantee fund is not enabled for this group' } }, 400);
  }

  const body = await c.req.json();
  const parsed = guaranteeClaimSchema.safeParse(body);

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

  const { defaulting_member_id, round, covered_amount_pesewas } = parsed.data;

  // Verify member belongs to this group
  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE id = ? AND group_id = ?`
  ).bind(defaulting_member_id, groupId).first();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Member not found in this group' } }, 404);
  }

  // Check sufficient funds in guarantee pool
  if (covered_amount_pesewas > group.guarantee_pool_pesewas) {
    return c.json({
      error: {
        code: 'BAD_REQUEST',
        message: `Insufficient guarantee fund. Available: ${group.guarantee_pool_pesewas}, Requested: ${covered_amount_pesewas}`,
      },
    }, 400);
  }

  const claimId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO guarantee_claims (id, group_id, defaulting_member_id, round, covered_amount_pesewas)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(claimId, groupId, defaulting_member_id, round, covered_amount_pesewas).run();

  // Deduct from guarantee pool
  await c.env.DB.prepare(
    `UPDATE susu_groups
     SET guarantee_pool_pesewas = guarantee_pool_pesewas - ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(covered_amount_pesewas, groupId).run();

  const claim = await c.env.DB.prepare(
    `SELECT gc.id, gc.group_id, gc.defaulting_member_id, sm.display_name AS defaulting_member_name,
            gc.round, gc.covered_amount_pesewas, gc.created_at
     FROM guarantee_claims gc
     INNER JOIN susu_members sm ON sm.id = gc.defaulting_member_id
     WHERE gc.id = ?`
  ).bind(claimId).first();

  return c.json({ data: claim }, 201);
});

// ─── POST /groups/:id/welfare-claim — submit a welfare claim ──────────────────

susu.post('/groups/:id/welfare-claim', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const body = await c.req.json();
  const parsed = welfareClaimSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: { fieldErrors: parsed.error.flatten().fieldErrors } } },
      400
    );
  }

  // Verify group is welfare variant
  const group = await c.env.DB.prepare(
    `SELECT id, variant FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; variant: string }>();

  if (!group || group.variant !== 'welfare') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'This is not a welfare group' } }, 400);
  }

  // Verify membership
  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'You are not a member of this group' } }, 404);
  }

  const { claim_type, description, amount_requested_pesewas } = parsed.data;
  const claimId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO welfare_claims (id, group_id, claimant_member_id, claim_type, description, amount_requested_pesewas)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(claimId, groupId, member.id, claim_type, description, amount_requested_pesewas).run();

  const claim = await c.env.DB.prepare(
    `SELECT wc.*, sm.display_name AS claimant_name
     FROM welfare_claims wc
     INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
     WHERE wc.id = ?`
  ).bind(claimId).first<WelfareClaimRow & { claimant_name: string }>();

  return c.json({ data: claim }, 201);
});

// ─── GET /groups/:id/welfare-claims — list all welfare claims ────────────────

susu.get('/groups/:id/welfare-claims', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const member = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!member) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'You are not a member of this group' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT wc.*, sm.display_name AS claimant_name
     FROM welfare_claims wc
     INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
     WHERE wc.group_id = ?
     ORDER BY wc.created_at DESC
     LIMIT 50`
  ).bind(groupId).all<WelfareClaimRow & { claimant_name: string }>();

  return c.json({ data: results });
});

// ─── POST /groups/:id/welfare-claim/:claimId/approve — approve a welfare claim ─

susu.post('/groups/:id/welfare-claim/:claimId/approve', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const claimId = c.req.param('claimId');

  // Verify creator
  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, variant FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; variant: string }>();

  if (!group || group.variant !== 'welfare') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'This is not a welfare group' } }, 400);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the group leader can approve claims' } }, 403);
  }

  const creatorMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  const claim = await c.env.DB.prepare(
    `SELECT * FROM welfare_claims WHERE id = ? AND group_id = ?`
  ).bind(claimId, groupId).first<WelfareClaimRow>();

  if (!claim) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  }

  if (claim.status !== 'pending') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Claim is not pending' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = welfareClaimApproveSchema.safeParse(body);
  const approvedAmount = parsed.success && parsed.data.amount_approved_pesewas
    ? parsed.data.amount_approved_pesewas
    : claim.amount_requested_pesewas;

  const status = approvedAmount < claim.amount_requested_pesewas ? 'partially_approved' : 'approved';

  await c.env.DB.prepare(
    `UPDATE welfare_claims SET status = ?, amount_approved_pesewas = ?, approved_by = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).bind(status, approvedAmount, creatorMember?.id ?? null, claimId).run();

  const updated = await c.env.DB.prepare(
    `SELECT wc.*, sm.display_name AS claimant_name
     FROM welfare_claims wc
     INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
     WHERE wc.id = ?`
  ).bind(claimId).first<WelfareClaimRow & { claimant_name: string }>();

  return c.json({ data: updated });
});

// ─── POST /groups/:id/welfare-claim/:claimId/deny — deny a welfare claim ─────

susu.post('/groups/:id/welfare-claim/:claimId/deny', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const claimId = c.req.param('claimId');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, variant FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; variant: string }>();

  if (!group || group.variant !== 'welfare') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'This is not a welfare group' } }, 400);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the group leader can deny claims' } }, 403);
  }

  const claim = await c.env.DB.prepare(
    `SELECT * FROM welfare_claims WHERE id = ? AND group_id = ?`
  ).bind(claimId, groupId).first<WelfareClaimRow>();

  if (!claim) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  }

  if (claim.status !== 'pending') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Claim is not pending' } }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE welfare_claims SET status = 'denied', resolved_at = datetime('now') WHERE id = ?`
  ).bind(claimId).run();

  const updated = await c.env.DB.prepare(
    `SELECT wc.*, sm.display_name AS claimant_name
     FROM welfare_claims wc
     INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
     WHERE wc.id = ?`
  ).bind(claimId).first<WelfareClaimRow & { claimant_name: string }>();

  return c.json({ data: updated });
});

// ─── POST /groups/:id/welfare-claim/:claimId/pay — pay out an approved claim ──

susu.post('/groups/:id/welfare-claim/:claimId/pay', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const claimId = c.req.param('claimId');

  const group = await c.env.DB.prepare(
    `SELECT id, creator_id, variant FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; creator_id: string; variant: string }>();

  if (!group || group.variant !== 'welfare') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'This is not a welfare group' } }, 400);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the group leader can pay out claims' } }, 403);
  }

  const claim = await c.env.DB.prepare(
    `SELECT * FROM welfare_claims WHERE id = ? AND group_id = ?`
  ).bind(claimId, groupId).first<WelfareClaimRow>();

  if (!claim) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Claim not found' } }, 404);
  }

  if (claim.status !== 'approved' && claim.status !== 'partially_approved') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Claim must be approved before payment' } }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE welfare_claims SET status = 'paid', resolved_at = datetime('now') WHERE id = ?`
  ).bind(claimId).run();

  const updated = await c.env.DB.prepare(
    `SELECT wc.*, sm.display_name AS claimant_name
     FROM welfare_claims wc
     INNER JOIN susu_members sm ON sm.id = wc.claimant_member_id
     WHERE wc.id = ?`
  ).bind(claimId).first<WelfareClaimRow & { claimant_name: string }>();

  return c.json({ data: updated });
});

// ─── POST /groups/:id/messages/upload — upload file and create message ────────

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
]);
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB

susu.post('/groups/:id/messages/upload', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Expected multipart/form-data' } }, 400);
  }

  const file = formData.get('file');
  const contentText = (formData.get('content') as string | null) ?? '';

  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No file provided' } }, 400);
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'File type not allowed. Accepted: JPEG, PNG, GIF, PDF' } }, 400);
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 5 MB' } }, 400);
  }

  const messageId = generateId();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `chat/${groupId}/${messageId}/${safeFilename}`;

  // Upload to R2
  await c.env.R2.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  // Insert message with attachment fields
  const messageContent = contentText.trim().slice(0, 500);
  await c.env.DB.prepare(
    `INSERT INTO susu_messages (id, group_id, member_id, content, attachment_key, attachment_type, attachment_name, attachment_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(messageId, groupId, myMember.id, messageContent, r2Key, file.type, file.name, file.size).run();

  // Fetch the created message
  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  const message = row ? {
    id: row.id,
    content: row.content,
    sender_name: row.sender_name,
    sender_user_id: row.sender_user_id,
    created_at: row.created_at,
    reply_to_id: row.reply_to_id,
    reply_to_content: null,
    reply_to_sender: null,
    edited_at: null,
    is_deleted: false,
    reactions: [] as Array<{ emoji: string; count: number; reacted_by_me: boolean }>,
    read_by_count: 0,
    attachment_url: `/susu/groups/${groupId}/messages/${row.id}/attachment`,
    attachment_type: row.attachment_type,
    attachment_name: row.attachment_name,
    attachment_size: row.attachment_size,
  } : null;

  return c.json({ data: message }, 201);
});

// ─── GET /groups/:id/messages/:messageId/attachment — stream attachment from R2 ──

susu.get('/groups/:id/messages/:messageId/attachment', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Get attachment info
  const msg = await c.env.DB.prepare(
    `SELECT attachment_key, attachment_type, attachment_name FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ attachment_key: string | null; attachment_type: string | null; attachment_name: string | null }>();

  if (!msg?.attachment_key) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Attachment not found' } }, 404);
  }

  const object = await c.env.R2.get(msg.attachment_key);
  if (!object) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'File not found in storage' } }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', msg.attachment_type ?? 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${msg.attachment_name ?? 'attachment'}"`);
  headers.set('Cache-Control', 'private, max-age=3600');

  return new Response(object.body, { headers });
});

// ─── GET /unread-total — total unread messages across all groups ─────────────

susu.get('/unread-total', async (c) => {
  const userId = c.get('userId');

  // Get all groups the user is a member of
  const { results: memberships } = await c.env.DB.prepare(
    `SELECT sm.id AS member_id, sm.group_id
     FROM susu_members sm
     WHERE sm.user_id = ?`
  ).bind(userId).all<{ member_id: string; group_id: string }>();

  if (memberships.length === 0) {
    return c.json({ data: { total: 0 } });
  }

  let total = 0;

  for (const mem of memberships) {
    const receipt = await c.env.DB.prepare(
      `SELECT last_read_message_id FROM chat_read_receipts WHERE member_id = ? AND group_id = ?`
    ).bind(mem.member_id, mem.group_id).first<{ last_read_message_id: string | null }>();

    if (receipt?.last_read_message_id) {
      const cursorRow = await c.env.DB.prepare(
        `SELECT rowid FROM susu_messages WHERE id = ?`
      ).bind(receipt.last_read_message_id).first<{ rowid: number }>();

      if (cursorRow) {
        const countRow = await c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND rowid > ? AND deleted_at IS NULL`
        ).bind(mem.group_id, cursorRow.rowid).first<{ cnt: number }>();
        total += countRow?.cnt ?? 0;
      }
    } else {
      // No read receipt — all messages are unread
      const countRow = await c.env.DB.prepare(
        `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND deleted_at IS NULL`
      ).bind(mem.group_id).first<{ cnt: number }>();
      total += countRow?.cnt ?? 0;
    }
  }

  return c.json({ data: { total } });
});

export { susu };
