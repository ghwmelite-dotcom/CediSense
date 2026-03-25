// apps/api/src/routes/admin/dashboard.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /admin/dashboard — key metrics
dashboard.get('/dashboard', async (c) => {
  const [totalUsers, totalGroups, activeGroups, volume, newSignups] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM susu_groups').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM susu_groups WHERE is_active = 1').first<{ count: number }>(),
    c.env.DB.prepare('SELECT COALESCE(SUM(amount_pesewas), 0) as total FROM susu_contributions').first<{ total: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE created_at > datetime('now', '-7 days')").first<{ count: number }>(),
  ]);

  return c.json({
    data: {
      total_users: totalUsers?.count ?? 0,
      total_groups: totalGroups?.count ?? 0,
      active_groups: activeGroups?.count ?? 0,
      total_contribution_volume_pesewas: volume?.total ?? 0,
      new_signups_this_week: newSignups?.count ?? 0,
    },
  });
});

// GET /admin/activity — recent activity feed
// Uses parallel queries instead of UNION ALL (D1 has complexity limits on large UNIONs)
dashboard.get('/activity', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);

  interface ActivityRow { id: string; type: string; actor_name: string; description: string; ts: string }

  // Run 5 simple queries in parallel (much more reliable than 7-way UNION ALL on D1)
  const [signups, groups, members, contributions, payouts] = await Promise.all([
    c.env.DB.prepare(
      `SELECT 'signup:' || id AS id, 'signup' AS type, name AS actor_name,
              name || ' joined CediSense' AS description, created_at AS ts
       FROM users WHERE created_at > datetime('now', '-30 days')
       ORDER BY created_at DESC LIMIT 10`
    ).all<ActivityRow>(),

    c.env.DB.prepare(
      `SELECT 'group:' || id AS id, 'group_created' AS type,
              (SELECT name FROM users WHERE id = sg.creator_id) AS actor_name,
              'Created group "' || name || '"' AS description, created_at AS ts
       FROM susu_groups sg WHERE created_at > datetime('now', '-30 days')
       ORDER BY created_at DESC LIMIT 10`
    ).all<ActivityRow>(),

    c.env.DB.prepare(
      `SELECT 'member:' || id AS id, 'member_joined' AS type,
              display_name AS actor_name,
              display_name || ' joined a group' AS description, joined_at AS ts
       FROM susu_members WHERE joined_at > datetime('now', '-30 days')
       ORDER BY joined_at DESC LIMIT 10`
    ).all<ActivityRow>(),

    c.env.DB.prepare(
      `SELECT 'contrib:' || sc.id AS id, 'contribution' AS type,
              sm.display_name AS actor_name,
              sm.display_name || ' made a contribution' AS description,
              sc.contributed_at AS ts
       FROM susu_contributions sc
       JOIN susu_members sm ON sc.member_id = sm.id
       WHERE sc.contributed_at > datetime('now', '-30 days')
       ORDER BY sc.contributed_at DESC LIMIT 10`
    ).all<ActivityRow>(),

    c.env.DB.prepare(
      `SELECT 'payout:' || sp.id AS id, 'payout' AS type,
              sm.display_name AS actor_name,
              sm.display_name || ' received a payout' AS description,
              sp.paid_at AS ts
       FROM susu_payouts sp
       JOIN susu_members sm ON sp.member_id = sm.id
       WHERE sp.paid_at > datetime('now', '-30 days')
       ORDER BY sp.paid_at DESC LIMIT 10`
    ).all<ActivityRow>(),
  ]);

  // Merge, sort by timestamp DESC, take top N
  const all = [
    ...signups.results,
    ...groups.results,
    ...members.results,
    ...contributions.results,
    ...payouts.results,
  ].sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));

  const items = all.slice(0, limit);

  return c.json({
    data: {
      items: items.map((r) => ({
        id: r.id,
        type: r.type,
        actor_name: r.actor_name ?? 'Unknown',
        description: r.description,
        timestamp: r.ts,
      })),
      cursor: null,
      has_more: all.length > limit,
    },
  });
});

export default dashboard;
