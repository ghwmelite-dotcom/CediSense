import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

const exportRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /export/transactions/csv
 * Query params: account_id, category_id, from, to (all optional)
 * Returns: text/csv with Content-Disposition header for download
 */
exportRoutes.get('/transactions/csv', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const categoryId = c.req.query('category_id');
  const from = c.req.query('from');
  const to = c.req.query('to');

  // Build query with parameterized filters (only ? placeholders appended, never raw values)
  let sql = `
    SELECT t.transaction_date, t.type, t.amount_pesewas, t.fee_pesewas,
           t.description, t.counterparty, t.reference, t.source,
           c.name AS category_name, a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (accountId) { sql += ' AND t.account_id = ?'; params.push(accountId); }
  if (categoryId) { sql += ' AND t.category_id = ?'; params.push(categoryId); }
  if (from) { sql += ' AND t.transaction_date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.transaction_date <= ?'; params.push(to); }

  sql += ' ORDER BY t.transaction_date DESC LIMIT 5000';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();

  // Build CSV with BOM for Excel compatibility
  const header = 'Date,Type,Amount (GHS),Fee (GHS),Description,Counterparty,Reference,Category,Account,Source';
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = (results ?? []).map((r: Record<string, unknown>) => {
    const amt = (((r.amount_pesewas as number) ?? 0) / 100).toFixed(2);
    const fee = (((r.fee_pesewas as number) ?? 0) / 100).toFixed(2);
    return [
      r.transaction_date, r.type, amt, fee,
      escape(r.description), escape(r.counterparty), escape(r.reference),
      escape(r.category_name), escape(r.account_name), r.source ?? 'manual',
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel correctly interprets special characters
  const csv = '\uFEFF' + [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cedisense-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

export { exportRoutes };
