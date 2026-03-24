import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  fetchSummary,
  fetchCategoryBreakdown,
  assembleSummary,
  currentMonth,
  lastDayOfMonth,
  previousMonth,
  type CategoryRow,
} from '../lib/dashboard-queries.js';

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

/**
 * GET /export/report/html?month=YYYY-MM
 * Returns: self-contained HTML document optimized for print-to-PDF.
 * Frontend fetches with Bearer token, creates Blob URL, opens in new tab.
 */
exportRoutes.get('/report/html', async (c) => {
  const userId = c.get('userId');
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'month param required (YYYY-MM)' } }, 400);
  }

  const now = currentMonth();
  if (month > now) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot export future months.' } }, 400);
  }

  const prevMonth = previousMonth(month);
  const curStart = `${month}-01`;
  const curEnd = lastDayOfMonth(month);
  const prevStart = `${prevMonth}-01`;
  const prevEnd = lastDayOfMonth(prevMonth);

  const [curSummaryRows, curCategoryRows, prevSummaryRows, prevCategoryRows] = await Promise.all([
    fetchSummary(c.env.DB, userId, curStart, curEnd),
    fetchCategoryBreakdown(c.env.DB, userId, curStart, curEnd),
    fetchSummary(c.env.DB, userId, prevStart, prevEnd),
    fetchCategoryBreakdown(c.env.DB, userId, prevStart, prevEnd),
  ]);

  const curSummary = assembleSummary(curSummaryRows);
  const prevSummary = assembleSummary(prevSummaryRows);
  const net = curSummary.totalIncome - curSummary.totalExpenses;

  // Build category map for trends
  const currentMap = new Map<string, CategoryRow>();
  const previousMap = new Map<string, CategoryRow>();
  for (const row of curCategoryRows) currentMap.set(row.id, row);
  for (const row of prevCategoryRows) previousMap.set(row.id, row);
  const allIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const fmtGHS = (pesewas: number) => `GHS ${(pesewas / 100).toFixed(2)}`;

  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });

  // Build category table rows
  let categoryRowsHtml = '';
  const sortedIds = [...allIds].sort((a, b) => {
    const aTotal = (currentMap.get(a)?.total_pesewas ?? 0) + (previousMap.get(a)?.total_pesewas ?? 0);
    const bTotal = (currentMap.get(b)?.total_pesewas ?? 0) + (previousMap.get(b)?.total_pesewas ?? 0);
    return bTotal - aTotal;
  }).slice(0, 10);

  for (const id of sortedIds) {
    const cur = currentMap.get(id);
    const prev = previousMap.get(id);
    const meta = cur ?? prev!;
    const curP = cur?.total_pesewas ?? 0;
    const prevP = prev?.total_pesewas ?? 0;
    const changePct = prevP > 0 ? Math.round(((curP - prevP) / prevP) * 1000) / 10 : (curP > 0 ? 100 : 0);
    const changeColor = changePct <= 0 ? '#22c55e' : '#ef4444';
    categoryRowsHtml += `<tr>
      <td>${meta.icon} ${meta.name}</td>
      <td>${fmtGHS(curP)}</td>
      <td>${fmtGHS(prevP)}</td>
      <td style="color:${changeColor}">${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%</td>
    </tr>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CediSense Report - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e; line-height: 1.5; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f8f8fa; font-weight: 600; border-bottom: 2px solid #e5e5e5; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    .total-row td { font-weight: 700; border-top: 2px solid #e5e5e5; }
    .text-credit { color: #22c55e; }
    .text-debit { color: #ef4444; }
    .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>CediSense Monthly Report</h1>
  <p class="subtitle">${monthLabel}</p>

  <h2>Summary</h2>
  <table>
    <thead><tr><th>Metric</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Income</td><td class="text-credit">${fmtGHS(curSummary.totalIncome)}</td></tr>
      <tr><td>Expenses</td><td class="text-debit">${fmtGHS(curSummary.totalExpenses)}</td></tr>
      <tr><td>Fees</td><td>${fmtGHS(curSummary.totalFees)}</td></tr>
      <tr class="total-row"><td>Net</td><td class="${net >= 0 ? 'text-credit' : 'text-debit'}">${net >= 0 ? '+' : '-'}${fmtGHS(Math.abs(net))}</td></tr>
      <tr><td>Transactions</td><td>${curSummary.transactionCount}</td></tr>
    </tbody>
  </table>

  <h2>Spending by Category</h2>
  <table>
    <thead><tr><th>Category</th><th>Current Month</th><th>Previous Month</th><th>Change</th></tr></thead>
    <tbody>${categoryRowsHtml}</tbody>
  </table>

  <p class="footer">Generated by CediSense &mdash; Built by Hodges &amp; Co.</p>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});

export { exportRoutes };
