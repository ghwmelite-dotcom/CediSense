/**
 * Shared dashboard query helpers and date utilities.
 * Used by the dashboard route and the AI context builder.
 */

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Type interfaces for query results
// ---------------------------------------------------------------------------

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  balance_pesewas: number;
}

export interface SummaryRow {
  type: string;
  total: number;
  fees: number;
  count: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  total_pesewas: number;
  transaction_count: number;
}

export interface RecentTransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  type: string;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  source: string | null;
  transaction_date: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  account_name: string | null;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Fetch all accounts for a user, ordered by is_primary then created_at.
 */
export async function fetchAccounts(db: D1Database, userId: string): Promise<AccountRow[]> {
  const result = await db
    .prepare(
      'SELECT id, name, type, provider, balance_pesewas FROM accounts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
    )
    .bind(userId)
    .all<AccountRow>();
  return result.results ?? [];
}

/**
 * Fetch transaction summary (grouped by type) for a given date range.
 */
export async function fetchSummary(
  db: D1Database,
  userId: string,
  startDate: string,
  endDate: string
): Promise<SummaryRow[]> {
  const result = await db
    .prepare(
      `SELECT type, SUM(amount_pesewas) as total, SUM(fee_pesewas) as fees, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ?
       GROUP BY type`
    )
    .bind(userId, startDate, endDate)
    .all<SummaryRow>();
  return result.results ?? [];
}

/**
 * Fetch expense category breakdown for a given date range.
 */
export async function fetchCategoryBreakdown(
  db: D1Database,
  userId: string,
  startDate: string,
  endDate: string
): Promise<CategoryRow[]> {
  const result = await db
    .prepare(
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
    )
    .bind(userId, startDate, endDate)
    .all<CategoryRow>();
  return result.results ?? [];
}

/**
 * Fetch the most recent transactions for a user (not month-filtered).
 */
export async function fetchRecentTransactions(
  db: D1Database,
  userId: string,
  limit = 5
): Promise<RecentTransactionRow[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.account_id, t.category_id, t.type, t.amount_pesewas,
              t.fee_pesewas, t.description, t.counterparty, t.reference,
              t.source, t.transaction_date, t.created_at,
              c.name as category_name, c.icon as category_icon, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = ?
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<RecentTransactionRow>();
  return result.results ?? [];
}

// ---------------------------------------------------------------------------
// Assembly helpers
// ---------------------------------------------------------------------------

export interface SummaryTotals {
  totalIncome: number;
  totalExpenses: number;
  totalFees: number;
  transactionCount: number;
}

/**
 * Pure function: maps SummaryRow[] into income/expense/fees/count totals.
 * credit → income, debit → expenses; all rows contribute to fees + count.
 */
export function assembleSummary(rows: SummaryRow[]): SummaryTotals {
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalFees = 0;
  let transactionCount = 0;

  for (const row of rows) {
    transactionCount += row.count;
    totalFees += row.fees ?? 0;
    if (row.type === 'credit') {
      totalIncome += row.total ?? 0;
    } else if (row.type === 'debit') {
      totalExpenses += row.total ?? 0;
    }
  }

  return { totalIncome, totalExpenses, totalFees, transactionCount };
}

export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
