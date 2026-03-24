import { Hono } from 'hono';
import type { AppType, SusuGroupRow, SusuContributionRow, SusuPayoutRow, SusuPenaltyRow } from './index.js';
import { generateId, BADGE_NAMES, mapGroup } from './index.js';
import { recordContributionSchema } from '@cedisense/shared';
import type { SusuFrequency, SusuVariant } from '@cedisense/shared';
import { computeTrustScore } from '../../lib/trust-score.js';
import { withNotification } from '../../lib/with-notification.js';
import { NotificationService } from '../../lib/notifications.js';

const contributions = new Hono<AppType>();

// ─── POST /groups/:id/contributions — record a contribution (creator only) ───

contributions.post('/groups/:id/contributions', withNotification(async (c) => {
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
}, (c, data) => {
  // data = the contribution receipt returned by this handler
  const groupId = c.req.param('id') ?? '';
  const actorId = c.get('userId');
  const d = data as {
    member_name?: string;
    amount_pesewas?: number;
    round?: number;
    id?: string;
  };
  if (!groupId) return null;
  return {
    type: 'susu_contribution',
    groupId,
    actorId,
    data: {
      actorName: d.member_name ?? 'A member',
      amount_pesewas: d.amount_pesewas,
      round: d.round,
      referenceId: d.id,
      referenceType: 'contribution',
    },
  };
}));

// ─── POST /groups/:id/payouts — record payout for current round (creator only)

contributions.post('/groups/:id/payouts', withNotification(async (c) => {
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
}, (c, data) => {
  // data = payout or distribution object — handle all variant shapes
  const groupId = c.req.param('id') ?? '';
  if (!groupId) return null;
  const actorId = c.get('userId');
  const d = data as {
    type?: string;
    // rotating/bidding path
    id?: string;
    amount_pesewas?: number;
    round?: number;
    // accumulating/goal path
    share_per_member?: number;
    payouts?: Array<{ id: string; amount_pesewas: number; round: number }>;
    // bulk path
    payout?: { id: string; amount_pesewas: number; round: number };
    total_pool?: number;
  };

  // Derive a sensible amount and referenceId from whichever variant was returned
  let amount_pesewas: number | undefined;
  let referenceId: string | undefined;
  let round: number | undefined;

  if (!d.type) {
    // Rotating/bidding — plain SusuPayoutRow
    amount_pesewas = d.amount_pesewas;
    referenceId = d.id;
    round = d.round;
  } else if (d.type === 'bulk_purchase_payment' && d.payout) {
    amount_pesewas = d.payout.amount_pesewas;
    referenceId = d.payout.id;
    round = d.payout.round;
  } else if (d.payouts && d.payouts.length > 0) {
    // accumulating or goal — use share per member as amount
    amount_pesewas = d.share_per_member ?? d.payouts[0]?.amount_pesewas;
    referenceId = d.payouts[0]?.id;
    round = d.payouts[0]?.round;
  }

  return {
    type: 'susu_payout',
    groupId,
    actorId,
    data: {
      actorName: 'Group creator',
      amount_pesewas,
      round,
      referenceId,
      referenceType: 'payout',
    },
  };
}));

// ─── POST /groups/:id/advance-round — advance to next round (creator only) ───

contributions.post('/groups/:id/advance-round', async (c) => {
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
    await c.env.DB.prepare(
      `UPDATE susu_groups
       SET current_round = current_round + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(groupId).run();

  } else if (group.variant === 'goal_based') {
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

contributions.get('/groups/:id/penalties', async (c) => {
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

// ─── GET /groups/:id/history — all contributions + payouts ───────────────────

contributions.get('/groups/:id/history', async (c) => {
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

  const { results: contribs } = await c.env.DB.prepare(
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

  return c.json({ data: { contributions: contribs, payouts }, meta: { limit } });
});

// ─── GET /groups/:groupId/contributions/:id/receipt — fetch receipt data ──────

contributions.get('/groups/:groupId/contributions/:id/receipt', async (c) => {
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

// ─── GET /groups/:id/analytics — group analytics dashboard ──────────────────

contributions.get('/groups/:id/analytics', async (c) => {
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

export default contributions;
