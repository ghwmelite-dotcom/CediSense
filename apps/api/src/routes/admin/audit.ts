// apps/api/src/routes/admin/audit.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';

const audit = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /admin/audit-log
audit.get('/audit-log', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);
  const adminIdFilter = c.req.query('admin_id');
  const actionFilter = c.req.query('action');
  const targetTypeFilter = c.req.query('target_type');
  const fetchLimit = limit + 1;

  let where = 'WHERE 1=1';
  const binds: (string | number)[] = [];

  if (adminIdFilter) { where += ' AND a.admin_id = ?'; binds.push(adminIdFilter); }
  if (actionFilter) { where += ' AND a.action = ?'; binds.push(actionFilter); }
  if (targetTypeFilter) { where += ' AND a.target_type = ?'; binds.push(targetTypeFilter); }

  if (cursor) {
    try {
      const { ts, id } = JSON.parse(atob(cursor));
      where += ' AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?))';
      binds.push(ts, ts, id);
    } catch { /* invalid cursor */ }
  }

  binds.push(fetchLimit);

  const result = await c.env.DB.prepare(`
    SELECT a.*, u.name as admin_name
    FROM admin_audit_log a
    JOIN users u ON a.admin_id = u.id
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?
  `).bind(...binds).all();

  const rows = result.results;
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;

  const lastItem = items[items.length - 1] as any;
  const nextCursor = has_more && lastItem
    ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
    : null;

  return c.json({ data: { items, cursor: nextCursor, has_more } });
});

export default audit;
