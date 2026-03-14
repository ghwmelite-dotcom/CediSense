import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dashboardQuerySchema } from '@cedisense/shared';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Compute the last day of a given YYYY-MM month string.
 */
export function lastDayOfMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon, 0);
  return `${year}-${String(mon).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get current month as YYYY-MM.
 */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Generate all dates in a month as YYYY-MM-DD strings.
 */
export function allDaysInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

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
  const [accountsResult, summaryResult, categoryResult, dailyResult, recentResult, uncatCountResult] =
    await Promise.all([
      // 1. Accounts
      c.env.DB.prepare(
        'SELECT id, name, type, provider, balance_pesewas FROM accounts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
      ).bind(userId).all(),

      // 2. Summary (grouped by type)
      c.env.DB.prepare(
        `SELECT type, SUM(amount_pesewas) as total, SUM(fee_pesewas) as fees, COUNT(*) as count
         FROM transactions
         WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY type`
      ).bind(userId, startDate, endDate).all(),

      // 3. Category breakdown (expenses only, categorized)
      c.env.DB.prepare(
        `SELECT c.id, c.name,
                COALESCE(c.icon, '📦') as icon,
                COALESCE(c.color, '#888888') as color,
                SUM(t.amount_pesewas) as total_pesewas,
                COUNT(*) as transaction_count
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.type = 'debit'
           AND t.transaction_date >= ? AND t.transaction_date <= ?
         GROUP BY c.id
         ORDER BY total_pesewas DESC`
      ).bind(userId, startDate, endDate).all(),

      // 4. Daily trend (expenses only)
      c.env.DB.prepare(
        `SELECT transaction_date, SUM(amount_pesewas) as total_pesewas
         FROM transactions
         WHERE user_id = ? AND type = 'debit'
           AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY transaction_date`
      ).bind(userId, startDate, endDate).all(),

      // 5. Recent transactions (global, not month-filtered)
      c.env.DB.prepare(
        `SELECT t.id, t.account_id, t.category_id, t.type, t.amount_pesewas,
                t.fee_pesewas, t.description, t.counterparty, t.reference,
                t.source, t.transaction_date, t.created_at,
                c.name as category_name, c.icon as category_icon, a.name as account_name
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         LEFT JOIN accounts a ON t.account_id = a.id
         WHERE t.user_id = ?
         ORDER BY t.transaction_date DESC, t.created_at DESC
         LIMIT 5`
      ).bind(userId).all(),

      // 6. Uncategorized debit count
      c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE user_id = ? AND type = 'debit' AND category_id IS NULL
           AND transaction_date >= ? AND transaction_date <= ?`
      ).bind(userId, startDate, endDate).first<{ count: number }>(),
    ]);

  // -- Assemble accounts --
  const accountItems = (accountsResult.results ?? []) as Array<{
    id: string; name: string; type: string; provider: string | null; balance_pesewas: number;
  }>;
  const totalBalance = accountItems.reduce((sum, a) => sum + (a.balance_pesewas ?? 0), 0);

  // -- Assemble summary --
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalFees = 0;
  let transactionCount = 0;

  for (const row of (summaryResult.results ?? []) as Array<{ type: string; total: number; fees: number; count: number }>) {
    transactionCount += row.count;
    totalFees += row.fees ?? 0;
    if (row.type === 'credit') {
      totalIncome += row.total ?? 0;
    } else if (row.type === 'debit') {
      totalExpenses += row.total ?? 0;
    }
  }

  // -- Assemble category breakdown --
  const rawCategories = (categoryResult.results ?? []) as Array<{
    id: string; name: string; icon: string; color: string; total_pesewas: number; transaction_count: number;
  }>;

  const categorizedTotal = rawCategories.reduce((sum, c) => sum + c.total_pesewas, 0);
  const uncategorizedAmount = totalExpenses - categorizedTotal;

  const categoryBreakdown = rawCategories.map((cat) => ({
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
  for (const row of (dailyResult.results ?? []) as Array<{ transaction_date: string; total_pesewas: number }>) {
    dailyMap.set(row.transaction_date, row.total_pesewas);
  }

  const dailyTrend = allDaysInMonth(month).map((date) => ({
    date,
    total_pesewas: dailyMap.get(date) ?? 0,
  }));

  return c.json({
    data: {
      month,
      accounts: {
        total_balance_pesewas: totalBalance,
        items: accountItems,
      },
      summary: {
        total_income_pesewas: totalIncome,
        total_expenses_pesewas: totalExpenses,
        total_fees_pesewas: totalFees,
        transaction_count: transactionCount,
      },
      category_breakdown: categoryBreakdown,
      daily_trend: dailyTrend,
      recent_transactions: recentResult.results ?? [],
    },
  });
});

export { dashboard };
