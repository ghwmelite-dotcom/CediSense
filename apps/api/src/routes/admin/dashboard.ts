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
dashboard.get('/activity', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);
  const fetchLimit = limit + 1;

  let hasCursor = false;
  let cursorTs = '';
  if (cursor) {
    try {
      const parsed = JSON.parse(atob(cursor));
      cursorTs = parsed.ts;
      hasCursor = true;
    } catch { /* invalid cursor — treat as first page */ }
  }

  // UNION ALL across 7 source tables, 30-day window, sorted by timestamp DESC
  // Each sub-query conditionally appends a cursor filter on its timestamp column
  const query = `
    SELECT 'signup:' || id AS id, 'signup' AS type, name AS actor_name,
           name || ' joined CediSense' AS description, created_at AS ts
    FROM users WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'group_created:' || id AS id, 'group_created' AS type,
           (SELECT name FROM users WHERE id = sg.creator_id) AS actor_name,
           'Created group "' || name || '"' AS description, created_at AS ts
    FROM susu_groups sg WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'contribution:' || sc.id AS id, 'contribution' AS type,
           sm.display_name AS actor_name,
           sm.display_name || ' contributed to ' || (SELECT name FROM susu_groups WHERE id = sc.group_id) AS description,
           sc.contributed_at AS ts
    FROM susu_contributions sc
    JOIN susu_members sm ON sc.member_id = sm.id
    WHERE sc.contributed_at > datetime('now', '-30 days') ${hasCursor ? 'AND sc.contributed_at < ?' : ''}

    UNION ALL

    SELECT 'payout:' || sp.id AS id, 'payout' AS type,
           sm.display_name AS actor_name,
           sm.display_name || ' received payout from ' || (SELECT name FROM susu_groups WHERE id = sp.group_id) AS description,
           sp.paid_at AS ts
    FROM susu_payouts sp
    JOIN susu_members sm ON sp.member_id = sm.id
    WHERE sp.paid_at > datetime('now', '-30 days') ${hasCursor ? 'AND sp.paid_at < ?' : ''}

    UNION ALL

    SELECT 'member_joined:' || id AS id, 'member_joined' AS type,
           display_name AS actor_name,
           display_name || ' joined ' || (SELECT name FROM susu_groups WHERE id = sm2.group_id) AS description,
           joined_at AS ts
    FROM susu_members sm2 WHERE joined_at > datetime('now', '-30 days') ${hasCursor ? 'AND joined_at < ?' : ''}

    UNION ALL

    SELECT 'claim_filed:' || id AS id, 'claim_filed' AS type,
           (SELECT display_name FROM susu_members WHERE id = fc.claimant_member_id) AS actor_name,
           'Funeral claim filed in ' || (SELECT name FROM susu_groups WHERE id = fc.group_id) AS description,
           created_at AS ts
    FROM funeral_claims fc WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    UNION ALL

    SELECT 'claim_filed:w' || id AS id, 'claim_filed' AS type,
           (SELECT display_name FROM susu_members WHERE id = wc.claimant_member_id) AS actor_name,
           wc.claim_type || ' claim filed in ' || (SELECT name FROM susu_groups WHERE id = wc.group_id) AS description,
           created_at AS ts
    FROM welfare_claims wc WHERE created_at > datetime('now', '-30 days') ${hasCursor ? 'AND created_at < ?' : ''}

    ORDER BY ts DESC LIMIT ?
  `;

  // Build bind params — when cursor is present, each of the 7 sub-queries needs
  // one bind for the cursor timestamp, then the final LIMIT bind at the end.
  const subQueryCount = 7;
  const binds: (string | number)[] = [];
  if (hasCursor) {
    for (let i = 0; i < subQueryCount; i++) {
      binds.push(cursorTs);
    }
  }
  binds.push(fetchLimit);

  const result = await c.env.DB.prepare(query).bind(...binds).all<{
    id: string;
    type: string;
    actor_name: string;
    description: string;
    ts: string;
  }>();

  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor =
    has_more && lastItem ? btoa(JSON.stringify({ ts: lastItem.ts })) : null;

  return c.json({
    data: {
      items: items.map((r) => ({
        id: r.id,
        type: r.type,
        actor_name: r.actor_name ?? 'Unknown',
        description: r.description,
        timestamp: r.ts,
      })),
      cursor: nextCursor,
      has_more,
    },
  });
});

export default dashboard;
