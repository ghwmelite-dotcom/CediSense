import { Hono } from 'hono';
import type { AppType } from './index.js';
import { generateId } from './index.js';
import type { CreditCertificate } from '@cedisense/shared';
import { getTrustLabel } from '../../lib/trust-score.js';

const gamification = new Hono<AppType>();

// ─── GET /groups/trust/:userId — get a user's trust score ─────────────────────

gamification.get('/groups/trust/:userId', async (c) => {
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

// ─── GET /groups/:id/leaderboard — ranked member list ────────────────────────

gamification.get('/groups/:id/leaderboard', async (c) => {
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
       COALESCE(badge_counts.cnt, 0) AS badges_count
     FROM susu_members sm
     LEFT JOIN trust_scores ts ON ts.user_id = sm.user_id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS cnt
       FROM susu_badges
       WHERE group_id = ?
       GROUP BY user_id
     ) badge_counts ON badge_counts.user_id = sm.user_id
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

gamification.get('/groups/:id/badges', async (c) => {
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

// ─── GET /certificate — generate micro-credit certificate ───────────────────

gamification.get('/certificate', async (c) => {
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

gamification.get('/certificate/verify/:certificateId', async (c) => {
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

export default gamification;
