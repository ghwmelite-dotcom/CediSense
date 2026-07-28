import { Hono } from 'hono';
import type { Env, Variables } from './types.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { auth } from './routes/auth.js';
import { users } from './routes/users.js';
import { accounts } from './routes/accounts.js';
import { categories } from './routes/categories.js';
import { categoryRules } from './routes/category-rules.js';
import { transactions } from './routes/transactions.js';
import { importRoutes } from './routes/import.js';
import { dashboard } from './routes/dashboard.js';
import { ai } from './routes/ai.js';
import { budgets } from './routes/budgets.js';
import { goals } from './routes/goals.js';
import { insights } from './routes/insights.js';
import { recurring } from './routes/recurring.js';
import { ious } from './routes/ious.js';
import { investments } from './routes/investments.js';
import { susu } from './routes/susu/index.js';
import { collector } from './routes/collector.js';
import { notifications } from './routes/notifications.js';
import { exportRoutes } from './routes/export.js';
import { admin } from './routes/admin/index.js';
import { adminMiddleware } from './middleware/admin.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', corsMiddleware());

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com; img-src 'self' data: blob: https://flagcdn.com; connect-src 'self' https://cedisense-api.ghwmelite.workers.dev; frame-ancestors 'none'; report-uri /api/v1/csp-report");
});

// Public auth routes
app.route('/api/v1/auth', auth);

// Public certificate verification (no auth required) — IP rate limited, PII stripped
app.get('/api/v1/susu/certificate/verify/:certificateId', async (c) => {
  // IP-based rate limiting: 20 requests per minute
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const rlKey = `rate:cert-verify:${ip}`;
  const rlCurrent = await c.env.KV.get(rlKey);
  const rlCount = rlCurrent ? parseInt(rlCurrent, 10) : 0;

  if (rlCount >= 20) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
      429,
      { 'Retry-After': '60' }
    );
  }

  // Always include TTL to prevent orphaned keys
  await c.env.KV.put(rlKey, String(rlCount + 1), { expirationTtl: 60 });

  const certId = c.req.param('certificateId');
  const row = await c.env.DB.prepare(
    `SELECT certificate_data FROM credit_certificates WHERE id = ?`
  ).bind(certId).first<{ certificate_data: string }>();
  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Certificate not found' } }, 404);
  }

  // Strip PII — only return safe public fields
  const fullData = JSON.parse(row.certificate_data) as Record<string, unknown>;
  const holderName = typeof fullData.holder_name === 'string'
    ? fullData.holder_name.split(' ')[0]
    : undefined;

  return c.json({
    data: {
      valid: true,
      holder_first_name: holderName ?? 'Member',
      trust_score_label: fullData.trust_score_label ?? null,
      issued_date: fullData.issued_date ?? fullData.issued_at ?? null,
    },
  });
});

// Protected routes with rate limiting
app.use('/api/v1/users/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/accounts/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/categories/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/category-rules/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: /import must be registered before /transactions to prevent /:id catching /import
app.use('/api/v1/import/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/transactions/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/dashboard', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ai/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/budgets', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/budgets/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / needs the first, POST /report needs the second.
app.use('/api/v1/insights', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/insights/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / needs the first, nested routes need the second.
app.use('/api/v1/recurring', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/recurring/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ious', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ious/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / and GET /summary need the first, nested routes need the second.
app.use('/api/v1/investments', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/investments/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET /groups needs the first, nested group routes need the second.
app.use('/api/v1/susu', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/susu/*', authMiddleware, rateLimitMiddleware);
// Collector (Market Women's Digital Collector)
app.use('/api/v1/collector', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/collector/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / and GET /unread-count need the first, nested routes need the second.
app.use('/api/v1/notifications', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/notifications/*', authMiddleware, rateLimitMiddleware);
// Export routes
app.use('/api/v1/export', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/export/*', authMiddleware, rateLimitMiddleware);
// Admin portal
app.use('/api/v1/admin', authMiddleware, rateLimitMiddleware, adminMiddleware);
app.use('/api/v1/admin/*', authMiddleware, rateLimitMiddleware, adminMiddleware);

app.route('/api/v1/users', users);
app.route('/api/v1/accounts', accounts);
app.route('/api/v1/categories', categories);
app.route('/api/v1/category-rules', categoryRules);
// Mount import BEFORE transactions so /transactions/import is never ambiguous
app.route('/api/v1/import', importRoutes);
app.route('/api/v1/transactions', transactions);
app.route('/api/v1/dashboard', dashboard);
app.route('/api/v1/ai', ai);
app.route('/api/v1/budgets', budgets);
app.route('/api/v1/goals', goals);
app.route('/api/v1/insights', insights);
app.route('/api/v1/recurring', recurring);
app.route('/api/v1/ious', ious);
app.route('/api/v1/investments', investments);
app.route('/api/v1/susu', susu);
app.route('/api/v1/collector', collector);
app.route('/api/v1/notifications', notifications);
app.route('/api/v1/export', exportRoutes);
app.route('/api/v1/admin', admin);

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// CSP violation report endpoint
app.post('/api/v1/csp-report', async (c) => {
  const body = await c.req.text();
  console.log(JSON.stringify({ type: 'csp-violation', report: body }));
  return c.json({ data: { received: true } });
});

// 404 fallback
app.notFound((c) => {
  return c.json(
    { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  const requestId = crypto.randomUUID();
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId,
    userId: c.get('userId') ?? null,
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }));
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', request_id: requestId } },
    500
  );
});

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      const { NotificationService } = await import('./lib/notifications.js');
      const service = new NotificationService(env);
      const deleted = await service.purgeExpired(30);
      console.log(JSON.stringify({ type: 'cron', action: 'purge', deleted, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'purge', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }

    // Feature 1: streak-risk nudges — push members whose streak dies if they
    // miss the current round.
    try {
      const { computeStreakNudges } = await import('./lib/streak-nudge.js');
      const { sendWebPush } = await import('./lib/web-push.js');
      const { results } = await env.DB.prepare(
        `SELECT m.user_id, m.display_name, g.id AS group_id, g.name AS group_name,
                COALESCE(ts.current_streak, 0) AS current_streak,
                EXISTS(SELECT 1 FROM susu_contributions sc
                       WHERE sc.group_id = g.id AND sc.member_id = m.id AND sc.round = g.current_round) AS contributed_this_round
         FROM susu_members m
         JOIN susu_groups g ON g.id = m.group_id AND g.is_active = 1
         LEFT JOIN trust_scores ts ON ts.user_id = m.user_id`
      ).all<{
        user_id: string; display_name: string; group_id: string; group_name: string;
        current_streak: number; contributed_this_round: number;
      }>();

      const nudges = computeStreakNudges(results);
      const vapid = {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        contactEmail: env.VAPID_CONTACT_EMAIL,
      };

      for (const n of nudges) {
        const insert = env.DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, group_id, reference_id, reference_type, created_at)
           VALUES (?, 'streak_risk', ?, ?, ?, ?, 'susu_group', datetime('now'))`
        ).bind(n.userId, n.title, n.body, n.groupId, n.groupId);

        const subs = await env.DB.prepare(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
        ).bind(n.userId).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

        const pushes = (subs.results ?? []).map((sub) =>
          sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title: n.title, body: n.body, data: { url: '/susu' } },
            vapid
          )
        );
        ctx.waitUntil(Promise.all([insert.run(), ...pushes]));
      }
      console.log(JSON.stringify({ type: 'cron', action: 'streak-nudge', sent: nudges.length, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'streak-nudge', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }

    // Feature 3: due-date nudge sequence — 3 escalating stages per round,
    // deduped per group+round+stage via KV.
    try {
      const { dueStage, stageMessage } = await import('./lib/due-nudge.js');
      const { sendWebPush } = await import('./lib/web-push.js');

      const { results: activeGroups } = await env.DB.prepare(
        `SELECT id, name, frequency, current_round, round_started_at
         FROM susu_groups WHERE is_active = 1 AND round_started_at IS NOT NULL`
      ).all<{ id: string; name: string; frequency: 'daily' | 'weekly' | 'monthly'; current_round: number; round_started_at: string }>();

      let sent = 0;
      for (const g of activeGroups ?? []) {
        const stage = dueStage(g.round_started_at, g.frequency);
        if (stage === 0) continue;

        const dedupeKey = `due-nudge:${g.id}:${g.current_round}:${stage}`;
        if (await env.KV.get(dedupeKey)) continue;

        const { results: pending } = await env.DB.prepare(
          `SELECT m.user_id, m.display_name FROM susu_members m
           WHERE m.group_id = ? AND NOT EXISTS (
             SELECT 1 FROM susu_contributions sc
             WHERE sc.group_id = m.group_id AND sc.member_id = m.id AND sc.round = ?)`
        ).bind(g.id, g.current_round).all<{ user_id: string; display_name: string }>();

        for (const member of pending ?? []) {
          const msg = stageMessage(stage, member.display_name, g.name);
          const insert = env.DB.prepare(
            `INSERT INTO notifications (user_id, type, title, body, group_id, reference_id, reference_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'susu_group', datetime('now'))`
          ).bind(member.user_id, `due_${stage}`, msg.title, msg.body, g.id, g.id);

          const subs = await env.DB.prepare(
            `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
          ).bind(member.user_id).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

          const vapid = {
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            contactEmail: env.VAPID_CONTACT_EMAIL,
          };
          const pushes = (subs.results ?? []).map((sub) =>
            sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title: msg.title, body: msg.body, data: { url: '/susu' } },
              vapid
            )
          );
          ctx.waitUntil(Promise.all([insert.run(), ...pushes]));
          sent++;
        }

        // Mark this stage sent for this round (outlives any round window)
        ctx.waitUntil(env.KV.put(dedupeKey, '1', { expirationTtl: 40 * 24 * 3600 }));
      }
      console.log(JSON.stringify({ type: 'cron', action: 'due-nudge', sent, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'due-nudge', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }

    // Feature 4: daily chat digest — one notification per member per group
    // summarizing unread messages from the last 24h.
    try {
      const { sendWebPush } = await import('./lib/web-push.js');
      const today = new Date().toISOString().slice(0, 10);

      const { results: digestRows } = await env.DB.prepare(
        `SELECT g.id AS group_id, g.name AS group_name, m.id AS member_id, m.user_id,
                (SELECT COUNT(*) FROM susu_messages msg
                 WHERE msg.group_id = g.id AND msg.deleted_at IS NULL
                   AND msg.created_at >= datetime('now', '-1 day')
                   AND msg.rowid > COALESCE((
                     SELECT sm2.rowid FROM susu_messages sm2
                     JOIN chat_read_receipts rr ON rr.last_read_message_id = sm2.id
                     WHERE rr.member_id = m.id
                   ), 0)) AS unread
         FROM susu_groups g
         JOIN susu_members m ON m.group_id = g.id
         WHERE g.is_active = 1`
      ).all<{ group_id: string; group_name: string; member_id: string; user_id: string; unread: number }>();

      let sent = 0;
      for (const row of digestRows ?? []) {
        if (!row.unread || row.unread <= 0) continue;
        const dedupeKey = `chat-digest:${row.group_id}:${row.member_id}:${today}`;
        if (await env.KV.get(dedupeKey)) continue;

        const title = `${row.unread} new message${row.unread === 1 ? '' : 's'} 💬`;
        const body = `You have ${row.unread} unread message${row.unread === 1 ? '' : 's'} in "${row.group_name}" from the last day. Catch up now.`;

        const insert = env.DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, group_id, reference_id, reference_type, created_at)
           VALUES (?, 'chat_digest', ?, ?, ?, ?, 'susu_group', datetime('now'))`
        ).bind(row.user_id, title, body, row.group_id, row.group_id);

        const subs = await env.DB.prepare(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
        ).bind(row.user_id).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

        const vapid = {
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          contactEmail: env.VAPID_CONTACT_EMAIL,
        };
        const pushes = (subs.results ?? []).map((sub) =>
          sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, data: { url: '/susu' } },
            vapid
          )
        );
        ctx.waitUntil(Promise.all([insert.run(), ...pushes, env.KV.put(dedupeKey, '1', { expirationTtl: 2 * 24 * 3600 })]));
        sent++;
      }
      console.log(JSON.stringify({ type: 'cron', action: 'chat-digest', sent, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'chat-digest', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }

    // Feature 10: month-end challenge winner — on the 1st, the group that led
    // its "circle" (groups sharing at least one member) last month gets a
    // winner system message.
    try {
      const now = new Date();
      if (now.getUTCDate() === 1) {
        const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const monthKey = prevMonth.toISOString().slice(0, 7);

        const { results: challengeRows } = await env.DB.prepare(
          `SELECT g.id, g.name,
                  (SELECT COUNT(*) FROM susu_contributions sc WHERE sc.group_id = g.id
                     AND sc.contributed_at >= datetime('now', 'start of month', '-1 month')
                     AND sc.contributed_at < datetime('now', 'start of month')) AS contributions_last_month,
                  (SELECT m2.id FROM susu_members m2 WHERE m2.group_id = g.id ORDER BY m2.payout_order LIMIT 1) AS any_member_id
           FROM susu_groups g WHERE g.is_active = 1`
        ).all<{ id: string; name: string; contributions_last_month: number; any_member_id: string | null }>();

        // Sibling sets: groups that share at least one member
        const { results: membership } = await env.DB.prepare(
          `SELECT group_id, user_id FROM susu_members`
        ).all<{ group_id: string; user_id: string }>();

        const userGroups = new Map<string, Set<string>>();
        for (const m of membership ?? []) {
          if (!userGroups.has(m.user_id)) userGroups.set(m.user_id, new Set());
          userGroups.get(m.user_id)!.add(m.group_id);
        }
        const siblings = new Map<string, Set<string>>();
        for (const groups of userGroups.values()) {
          for (const gid of groups) {
            if (!siblings.has(gid)) siblings.set(gid, new Set());
            for (const other of groups) siblings.get(gid)!.add(other);
          }
        }

        let winners = 0;
        for (const g of challengeRows ?? []) {
          if (!g.any_member_id) continue;
          const circle = siblings.get(g.id) ?? new Set([g.id]);
          const circleRows = (challengeRows ?? []).filter((r) => circle.has(r.id));
          const top = Math.max(...circleRows.map((r) => r.contributions_last_month));
          if (g.contributions_last_month === 0 || g.contributions_last_month < top) continue;

          const dedupeKey = `challenge-winner:${g.id}:${monthKey}`;
          if (await env.KV.get(dedupeKey)) continue;

          await env.DB.prepare(
            `INSERT INTO susu_messages (id, group_id, member_id, content, message_type)
             VALUES (?, ?, ?, ?, 'system')`
          ).bind(crypto.randomUUID().replace(/-/g, '').slice(0, 32), g.id, g.any_member_id,
            `🏁 ${monthKey} challenge: this group led your circle with ${g.contributions_last_month} contributions! Champions! 🏆`).run();
          await env.KV.put(dedupeKey, '1', { expirationTtl: 40 * 24 * 3600 });
          winners++;
        }
        console.log(JSON.stringify({ type: 'cron', action: 'challenge-winner', winners, month: monthKey, timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'challenge-winner', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }

    // Feature 5: weekly group health recap — system message in every active
    // group's chat each Monday, deduped per ISO week.
    try {
      const now = new Date();
      if (now.getUTCDay() === 1) {
        const isoWeek = `${now.getUTCFullYear()}-W${String(Math.ceil(((now.getTime() - new Date(now.getUTCFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;

        const { results: recapGroups } = await env.DB.prepare(
          `SELECT g.id, g.name,
                  (SELECT COUNT(*) FROM susu_members m WHERE m.group_id = g.id) AS member_count,
                  (SELECT COUNT(*) FROM susu_contributions sc WHERE sc.group_id = g.id
                     AND sc.contributed_at >= datetime('now', '-7 days')) AS contributions_7d,
                  (SELECT COUNT(*) FROM susu_members m WHERE m.group_id = g.id AND NOT EXISTS (
                     SELECT 1 FROM susu_contributions sc
                     WHERE sc.group_id = m.group_id AND sc.member_id = m.id AND sc.round = g.current_round)) AS pending_now,
                  (SELECT m2.id FROM susu_members m2 WHERE m2.group_id = g.id ORDER BY m2.payout_order LIMIT 1) AS any_member_id
           FROM susu_groups g WHERE g.is_active = 1`
        ).all<{ id: string; name: string; member_count: number; contributions_7d: number; pending_now: number; any_member_id: string | null }>();

        let posted = 0;
        for (const g of recapGroups ?? []) {
          if (!g.any_member_id) continue;
          const dedupeKey = `weekly-recap:${g.id}:${isoWeek}`;
          if (await env.KV.get(dedupeKey)) continue;

          const full = g.pending_now === 0 && g.member_count > 0;
          const content = full
            ? `📊 Weekly recap: ${g.contributions_7d} contribution${g.contributions_7d === 1 ? '' : 's'} logged this week — everyone is current. Perfect week, keep it up! 🏆`
            : `📊 Weekly recap: ${g.contributions_7d} contribution${g.contributions_7d === 1 ? '' : 's'} logged this week. ${g.pending_now} member${g.pending_now === 1 ? ' is' : 's are'} still pending this round — a quick tap keeps the group on track.`;

          await env.DB.prepare(
            `INSERT INTO susu_messages (id, group_id, member_id, content, message_type)
             VALUES (?, ?, ?, ?, 'system')`
          ).bind(crypto.randomUUID().replace(/-/g, '').slice(0, 32), g.id, g.any_member_id, content).run();
          await env.KV.put(dedupeKey, '1', { expirationTtl: 10 * 24 * 3600 });
          posted++;
        }
        console.log(JSON.stringify({ type: 'cron', action: 'weekly-recap', posted, week: isoWeek, timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      console.error(JSON.stringify({ type: 'cron', action: 'weekly-recap', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
    }
  },
};
