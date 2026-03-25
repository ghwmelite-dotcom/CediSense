import { Hono } from 'hono';
import type { AppType, SusuGroupRow, SusuMemberRow, SusuContributionRow, FuneralClaimRow, WelfareClaimRow } from './index.js';
import { generateId, mapGroup, awardBadge } from './index.js';
import {
  createSusuGroupSchema,
  updateSusuGroupSchema,
} from '@cedisense/shared';
import type { SusuVariant, AgriculturalPhase } from '@cedisense/shared';
import { getTrustLabel } from '../../lib/trust-score.js';
import { logAuditAction } from '../../lib/audit.js';

const groups = new Hono<AppType>();

// ─── POST /groups — create a new susu group ───────────────────────────────────

groups.post('/groups', async (c) => {
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

groups.get('/groups', async (c) => {
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

  const data = results.map((row) => {
    const mapped = mapGroup(row);
    // Hide invite_code from non-creators
    if (row.creator_id !== userId) {
      mapped.invite_code = null as unknown as string;
    }
    return {
      ...mapped,
      member_count: row.member_count,
      unread_count: unreadCounts.get(row.id) ?? 0,
    };
  });

  return c.json({ data, meta: { limit, offset } });
});

// ─── GET /groups/:id — full group detail ─────────────────────────────────────

groups.get('/groups/:id', async (c) => {
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
    `SELECT sm.id, sm.group_id, sm.user_id, sm.display_name, sm.payout_order, sm.pre_paid, sm.joined_at,
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
    pre_paid: m.pre_paid === 1,
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

  // Hide invite_code from non-creators
  const mappedGroup = mapGroup(group);
  if (group.creator_id !== userId) {
    mappedGroup.invite_code = null as unknown as string;
  }

  return c.json({
    data: {
      ...mappedGroup,
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

groups.put('/groups/:id', async (c) => {
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

groups.delete('/groups/:id', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const group = await c.env.DB.prepare(
    `SELECT id, name, creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ id: string; name: string; creator_id: string }>();

  if (!group) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  if (group.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can delete this group' } }, 403);
  }

  await c.env.DB.prepare(
    `DELETE FROM susu_groups WHERE id = ?`
  ).bind(groupId).run();

  void logAuditAction(c.env.DB, {
    adminId: userId, action: 'group.delete',
    targetType: 'group', targetId: groupId,
    details: { group_name: group.name },
  });

  return c.body(null, 204);
});

export default groups;
