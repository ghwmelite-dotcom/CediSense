import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dashboardQuerySchema } from '@cedisense/shared';
import {
  lastDayOfMonth,
  currentMonth,
  allDaysInMonth,
  fetchAccounts,
  fetchSummary,
  fetchCategoryBreakdown,
  fetchRecentTransactions,
  assembleSummary,
} from '../lib/dashboard-queries.js';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /
dashboard.get('/', async (c) => {
  const userId = c.get('userId');

  const parsed = dashboardQuerySchema.safeParse({ month: c.req.query('month') });
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid month format. Use YYYY-MM.' } },
      400
    );
  }

  const now = currentMonth();
  const month = parsed.data.month ?? now;

  if (month > now) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Cannot view future months.' } },
      400
    );
  }

  const startDate = `${month}-01`;
  const endDate = lastDayOfMonth(month);

  // Run all 6 queries in parallel
  const [accounts, summaryRows, categoryRows, dailyResult, recentTransactions, uncatCountResult] =
    await Promise.all([
      fetchAccounts(c.env.DB, userId),
      fetchSummary(c.env.DB, userId, startDate, endDate),
      fetchCategoryBreakdown(c.env.DB, userId, startDate, endDate),

      // 4. Daily trend (expenses only) — dashboard-specific shape
      c.env.DB.prepare(
        `SELECT transaction_date, SUM(amount_pesewas) as total_pesewas
         FROM transactions
         WHERE user_id = ? AND type = 'debit'
           AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY transaction_date`
      ).bind(userId, startDate, endDate).all<{ transaction_date: string; total_pesewas: number }>(),

      fetchRecentTransactions(c.env.DB, userId),

      // 6. Uncategorized debit count — dashboard-specific
      c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE user_id = ? AND type = 'debit' AND category_id IS NULL
           AND transaction_date >= ? AND transaction_date <= ?`
      ).bind(userId, startDate, endDate).first<{ count: number }>(),
    ]);

  // -- Assemble accounts --
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_pesewas ?? 0), 0);

  // -- Assemble summary --
  const { totalIncome, totalExpenses, totalFees, transactionCount } = assembleSummary(summaryRows);

  // -- Assemble category breakdown --
  const categorizedTotal = categoryRows.reduce((sum, c) => sum + c.total_pesewas, 0);
  const uncategorizedAmount = totalExpenses - categorizedTotal;

  const categoryBreakdown = categoryRows.map((cat) => ({
    category_id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    total_pesewas: cat.total_pesewas,
    transaction_count: cat.transaction_count,
    percentage: totalExpenses > 0
      ? Math.round((cat.total_pesewas / totalExpenses) * 1000) / 10
      : 0,
  }));

  if (uncategorizedAmount > 0) {
    categoryBreakdown.push({
      category_id: 'uncategorized',
      name: 'Uncategorized',
      icon: '❓',
      color: '#888888',
      total_pesewas: uncategorizedAmount,
      transaction_count: uncatCountResult?.count ?? 0,
      percentage: totalExpenses > 0
        ? Math.round((uncategorizedAmount / totalExpenses) * 1000) / 10
        : 0,
    });
  }

  // -- Assemble daily trend (zero-fill missing days) --
  const dailyMap = new Map<string, number>();
  for (const row of (dailyResult.results ?? [])) {
    dailyMap.set(row.transaction_date, row.total_pesewas);
  }

  const dailyTrend = allDaysInMonth(month).map((date) => ({
    date,
    total_pesewas: dailyMap.get(date) ?? 0,
  }));

  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

  return c.json({
    data: {
      month,
      accounts: {
        total_balance_pesewas: totalBalance,
        items: accounts,
      },
      summary: {
        total_income_pesewas: totalIncome,
        total_expenses_pesewas: totalExpenses,
        total_fees_pesewas: totalFees,
        transaction_count: transactionCount,
      },
      category_breakdown: categoryBreakdown,
      daily_trend: dailyTrend,
      recent_transactions: recentTransactions,
    },
  });
});

export { dashboard };
