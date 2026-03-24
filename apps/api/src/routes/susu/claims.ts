import { Hono } from 'hono';
import type { AppType, EarlyPayoutRequestRow, EarlyPayoutVoteRow, FuneralClaimRow, WelfareClaimRow } from './index.js';
import { generateId } from './index.js';
import {
  earlyPayoutRequestSchema,
  earlyPayoutVoteSchema,
  funeralClaimSchema,
  funeralClaimVoteSchema,
  guaranteeClaimSchema,
  welfareClaimSchema,
  welfareClaimApproveSchema,
} from '@cedisense/shared';
import type { SusuVariant } from '@cedisense/shared';
import { withNotification } from '../../lib/with-notification.js';
import { NotificationService } from '../../lib/notifications.js';

const claims = new Hono<AppType>();

// ─── POST /groups/:id/early-payout — request an early payout ─────────────────

claims.post('/groups/:id/early-payout', withNotification(async (c) => {
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
}, (c, data) => {
  // data = early payout request row
  const groupId = c.req.param('id') ?? '';
  if (!groupId) return null;
  const d = data as {
    id?: string;
    requester_name?: string;
    amount_pesewas?: number;
  };
  return {
    type: 'susu_vote_opened',
    groupId,
    actorId: c.get('userId'),
    data: {
      actorName: d.requester_name ?? 'A member',
      amount_pesewas: d.amount_pesewas,
      referenceId: d.id,
      referenceType: 'early_payout_request',
    },
  };
}));

// ─── GET /groups/:id/early-payout — get active early payout request ──────────

claims.get('/groups/:id/early-payout', async (c) => {
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

claims.post('/groups/:id/early-payout/:requestId/vote', async (c) => {
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
  let earlyPayoutResolved = false;
  let earlyPayoutOutcome: string | undefined;
  if (updated.votes_for >= updated.votes_needed) {
    await c.env.DB.prepare(
      `UPDATE early_payout_requests SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`
    ).bind(requestId).run();
    earlyPayoutResolved = true;
    earlyPayoutOutcome = 'approved';
  }
  // Auto-deny if it's impossible to reach majority
  else if (updated.votes_against > totalMembers - updated.votes_needed) {
    await c.env.DB.prepare(
      `UPDATE early_payout_requests SET status = 'denied', resolved_at = datetime('now') WHERE id = ?`
    ).bind(requestId).run();
    earlyPayoutResolved = true;
    earlyPayoutOutcome = 'denied';
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

  // Emit vote-resolved notification only when the vote just concluded
  if (earlyPayoutResolved) {
    c.executionCtx.waitUntil(
      new NotificationService(c.env).emit({
        type: 'susu_vote_resolved',
        groupId,
        actorId: userId,
        data: {
          actorName: 'Group',
          outcome: 'Early payout request',
          status: earlyPayoutOutcome,
          referenceId: requestId,
          referenceType: 'early_payout_request',
        },
      }).catch(() => undefined)
    );
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

claims.post('/groups/:id/early-payout/:requestId/pay', async (c) => {
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

// ─── POST /groups/:id/funeral-claim — submit a funeral claim ─────────────────

claims.post('/groups/:id/funeral-claim', withNotification(async (c) => {
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
}, (c, data) => {
  // data = funeral claim row
  const groupId = c.req.param('id') ?? '';
  if (!groupId) return null;
  const d = data as {
    id?: string;
    claimant_name?: string;
    deceased_name?: string;
  };
  return {
    type: 'susu_claim_filed',
    groupId,
    actorId: c.get('userId'),
    data: {
      actorName: d.claimant_name ?? 'A member',
      claimType: 'Funeral',
      referenceId: d.id,
      referenceType: 'funeral_claim',
    },
  };
}));

// ─── GET /groups/:id/funeral-claim — get active funeral claim ────────────────

claims.get('/groups/:id/funeral-claim', async (c) => {
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

claims.post('/groups/:id/funeral-claim/:claimId/vote', async (c) => {
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
  let funeralClaimResolved = false;
  let funeralClaimOutcome: string | undefined;
  if (updated.approved_by_count >= updated.approval_threshold) {
    await c.env.DB.prepare(
      `UPDATE funeral_claims SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`
    ).bind(claimId).run();
    funeralClaimResolved = true;
    funeralClaimOutcome = 'approved';
  }
  // Auto-deny if it's impossible to reach threshold
  else if (updated.denied_by_count > totalMembers - updated.approval_threshold) {
    await c.env.DB.prepare(
      `UPDATE funeral_claims SET status = 'denied', resolved_at = datetime('now') WHERE id = ?`
    ).bind(claimId).run();
    funeralClaimResolved = true;
    funeralClaimOutcome = 'denied';
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

  // Emit vote-resolved notification only when the claim just concluded
  if (funeralClaimResolved) {
    c.executionCtx.waitUntil(
      new NotificationService(c.env).emit({
        type: 'susu_vote_resolved',
        groupId,
        actorId: userId,
        data: {
          actorName: 'Group',
          outcome: 'Funeral claim',
          status: funeralClaimOutcome,
          referenceId: claimId,
          referenceType: 'funeral_claim',
        },
      }).catch(() => undefined)
    );
  }

  return c.json({
    data: {
      ...final,
      my_vote: parsed.data.vote,
    },
  });
});

// ─── POST /groups/:id/funeral-claim/:claimId/pay — pay out approved claim ────

claims.post('/groups/:id/funeral-claim/:claimId/pay', async (c) => {
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

claims.get('/groups/:id/funeral-claims/history', async (c) => {
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

// ─── POST /groups/:id/guarantee-claim — claim from guarantee fund (creator only)

claims.post('/groups/:id/guarantee-claim', async (c) => {
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

claims.post('/groups/:id/welfare-claim', withNotification(async (c) => {
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
}, (c, data) => {
  // data = welfare claim row
  const groupId = c.req.param('id') ?? '';
  if (!groupId) return null;
  const d = data as {
    id?: string;
    claimant_name?: string;
    claim_type?: string;
    amount_requested_pesewas?: number;
  };
  return {
    type: 'susu_claim_filed',
    groupId,
    actorId: c.get('userId'),
    data: {
      actorName: d.claimant_name ?? 'A member',
      claimType: d.claim_type ?? 'Welfare',
      amount_pesewas: d.amount_requested_pesewas,
      referenceId: d.id,
      referenceType: 'welfare_claim',
    },
  };
}));

// ─── GET /groups/:id/welfare-claims — list all welfare claims ────────────────

claims.get('/groups/:id/welfare-claims', async (c) => {
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

claims.post('/groups/:id/welfare-claim/:claimId/approve', async (c) => {
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

claims.post('/groups/:id/welfare-claim/:claimId/deny', async (c) => {
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

claims.post('/groups/:id/welfare-claim/:claimId/pay', async (c) => {
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

export default claims;
