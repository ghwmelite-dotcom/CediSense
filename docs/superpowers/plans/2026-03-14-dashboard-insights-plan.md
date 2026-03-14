# Dashboard & Insights Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder DashboardPage with a data-driven analytics dashboard showing monthly financial summaries, spending trends, category breakdowns, and recent transactions.

**Architecture:** Single `GET /api/v1/dashboard?month=YYYY-MM` endpoint aggregates all data server-side via D1 SQL queries. Frontend renders with Recharts (area chart, donut chart) and custom React components. Month-by-month navigation with client-side caching. Drill-down to existing transaction feed via URL params.

**Tech Stack:** React 18, Recharts, Hono, Cloudflare D1, Vitest, Tailwind CSS, TypeScript strict

**Spec:** `docs/superpowers/specs/2026-03-14-dashboard-insights-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/src/routes/dashboard.ts` | Dashboard API endpoint — 5 D1 queries, aggregation, response assembly |
| `apps/api/src/routes/dashboard.test.ts` | Unit tests for dashboard aggregation logic |
| `apps/web/src/components/dashboard/MonthPicker.tsx` | Month navigation: ← March 2026 → |
| `apps/web/src/components/dashboard/BalanceCard.tsx` | Total balance + account pills |
| `apps/web/src/components/dashboard/SummaryCard.tsx` | Income vs expenses side-by-side |
| `apps/web/src/components/dashboard/SpendingTrendChart.tsx` | Recharts AreaChart — daily spending |
| `apps/web/src/components/dashboard/CategoryBreakdownCard.tsx` | Container: donut + ranked list |
| `apps/web/src/components/dashboard/CategoryDonut.tsx` | Recharts PieChart with inner radius |
| `apps/web/src/components/dashboard/CategoryRankedList.tsx` | Ranked category bars with drill-down |
| `apps/web/src/components/dashboard/RecentTransactions.tsx` | Last 5 transactions using TransactionRow |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `CategoryBreakdownItem`, `DashboardRecentTransaction`, `DashboardData` |
| `packages/shared/src/schemas.ts` | Add `dashboardQuerySchema` |
| `apps/api/src/index.ts` | Import and mount dashboard route with auth middleware |
| `apps/web/src/pages/DashboardPage.tsx` | Replace placeholder with real dashboard |
| `apps/web/src/pages/TransactionFeedPage.tsx` | Read initial filters from URL search params |
| `apps/web/package.json` | Add `recharts` dependency |

---

## Chunk 1: Shared Types + Dashboard API

### Task 1: Add shared types and schema

**Files:**
- Modify: `packages/shared/src/types.ts:183` (append after `ImportResult`)
- Modify: `packages/shared/src/schemas.ts:155` (append after last export)

- [ ] **Step 1: Add dashboard types to shared types**

In `packages/shared/src/types.ts`, append after the `ImportResult` interface (line ~183):

```typescript
// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface CategoryBreakdownItem {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  total_pesewas: number;
  transaction_count: number;
  percentage: number;
}

export interface DashboardRecentTransaction {
  id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  source: TransactionSource;
  transaction_date: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
}

export interface DashboardData {
  month: string;
  accounts: {
    total_balance_pesewas: number;
    items: Array<Pick<Account, 'id' | 'name' | 'type' | 'provider' | 'balance_pesewas'>>;
  };
  summary: {
    total_income_pesewas: number;
    total_expenses_pesewas: number;
    total_fees_pesewas: number;
    transaction_count: number;
  };
  category_breakdown: CategoryBreakdownItem[];
  daily_trend: Array<{
    date: string;
    total_pesewas: number;
  }>;
  recent_transactions: DashboardRecentTransaction[];
}
```

- [ ] **Step 2: Add dashboard query schema**

In `packages/shared/src/schemas.ts`, append after the `TransactionQueryInput` export (line ~155):

```typescript
// ─── Dashboard schema ────────────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format').optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add DashboardData types and dashboardQuerySchema"
```

---

### Task 2: Create dashboard API route

**Files:**
- Create: `apps/api/src/routes/dashboard.ts`

This is the core task. The route handler performs 5 D1 queries, assembles the `DashboardData` response, and handles edge cases (empty months, uncategorized spending, zero-fill daily trend).

- [ ] **Step 1: Create the dashboard route file**

Create `apps/api/src/routes/dashboard.ts`:

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dashboardQuerySchema } from '@cedisense/shared';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Compute the last day of a given YYYY-MM month string.
 * Returns YYYY-MM-DD for the last day.
 */
export function lastDayOfMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  // Day 0 of next month = last day of this month
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

  // Validate month param
  const parsed = dashboardQuerySchema.safeParse({ month: c.req.query('month') });
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid month format. Use YYYY-MM.' } },
      400
    );
  }

  const month = parsed.data.month ?? currentMonth();

  // Reject future months
  if (month > currentMonth()) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Cannot view future months.' } },
      400
    );
  }

  const startDate = `${month}-01`;
  const endDate = lastDayOfMonth(month);

  // Run all 6 queries in parallel (including uncategorized count)
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

      // 6. Uncategorized debit count (for "Uncategorized" category entry)
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
    // 'transfer' excluded from income/expense totals but included in transactionCount
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

  // Add uncategorized entry if there are uncategorized expenses
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

  // -- Assemble response --
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/dashboard.ts
git commit -m "feat: add dashboard API route with 5 aggregation queries"
```

---

### Task 3: Mount dashboard route in API index

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add import and middleware registration**

In `apps/api/src/index.ts`:

1. Add import at the top (after line 12, the `importRoutes` import):
```typescript
import { dashboard } from './routes/dashboard.js';
```

2. Add middleware registration (after line 29, the `app.use('/api/v1/transactions/*', ...)` line):
```typescript
app.use('/api/v1/dashboard', authMiddleware, rateLimitMiddleware);
```
Note: NO wildcard `/*` — dashboard is a single GET on the sub-router root.

3. Add route mount (after line 37, the `app.route('/api/v1/transactions', transactions)` line):
```typescript
app.route('/api/v1/dashboard', dashboard);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: mount dashboard route with auth middleware"
```

---

### Task 4: Dashboard API tests

**Files:**
- Create: `apps/api/src/routes/dashboard.test.ts`

Test the pure helper functions (lastDayOfMonth, allDaysInMonth, currentMonth) and the aggregation logic. Since D1 is not available in unit tests, extract the aggregation helpers as testable pure functions.

- [ ] **Step 1: Create test file**

Create `apps/api/src/routes/dashboard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, allDaysInMonth } from './dashboard.js';

describe('Dashboard helpers', () => {
  describe('lastDayOfMonth', () => {
    it('returns correct last day for January (31 days)', () => {
      expect(lastDayOfMonth('2026-01')).toBe('2026-01-31');
    });

    it('returns correct last day for February non-leap year (28 days)', () => {
      expect(lastDayOfMonth('2025-02')).toBe('2025-02-28');
    });

    it('returns correct last day for February leap year (29 days)', () => {
      expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    });

    it('returns correct last day for April (30 days)', () => {
      expect(lastDayOfMonth('2026-04')).toBe('2026-04-30');
    });

    it('returns correct last day for December (31 days)', () => {
      expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
    });
  });

  describe('allDaysInMonth', () => {
    it('returns 31 days for March', () => {
      const days = allDaysInMonth('2026-03');
      expect(days).toHaveLength(31);
      expect(days[0]).toBe('2026-03-01');
      expect(days[30]).toBe('2026-03-31');
    });

    it('returns 28 days for Feb non-leap', () => {
      const days = allDaysInMonth('2025-02');
      expect(days).toHaveLength(28);
      expect(days[27]).toBe('2025-02-28');
    });

    it('returns 29 days for Feb leap year', () => {
      const days = allDaysInMonth('2024-02');
      expect(days).toHaveLength(29);
    });

    it('all dates are in YYYY-MM-DD format', () => {
      const days = allDaysInMonth('2026-03');
      for (const d of days) {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('category percentage computation', () => {
    it('computes correct percentages with rounding', () => {
      const totalExpenses = 30000; // 300 GHS
      const categoryTotals = [15000, 10000, 5000]; // 150, 100, 50

      const percentages = categoryTotals.map(
        (t) => Math.round((t / totalExpenses) * 1000) / 10
      );

      expect(percentages).toEqual([50.0, 33.3, 16.7]);
    });

    it('returns 0 for all when totalExpenses is 0', () => {
      const totalExpenses = 0;
      const result = totalExpenses > 0
        ? Math.round((5000 / totalExpenses) * 1000) / 10
        : 0;
      expect(result).toBe(0);
    });
  });

  describe('uncategorized computation', () => {
    it('computes uncategorized as remainder', () => {
      const totalExpenses = 50000;
      const categorizedTotal = 35000;
      const uncategorized = totalExpenses - categorizedTotal;

      expect(uncategorized).toBe(15000);
    });

    it('no uncategorized when fully categorized', () => {
      const totalExpenses = 50000;
      const categorizedTotal = 50000;
      const uncategorized = totalExpenses - categorizedTotal;

      expect(uncategorized).toBe(0);
    });
  });

  describe('daily trend zero-fill', () => {
    it('fills missing days with 0', () => {
      const dailyMap = new Map<string, number>([
        ['2026-03-01', 5000],
        ['2026-03-15', 10000],
      ]);

      const days = allDaysInMonth('2026-03');
      const trend = days.map((date) => ({
        date,
        total_pesewas: dailyMap.get(date) ?? 0,
      }));

      expect(trend).toHaveLength(31);
      expect(trend[0]).toEqual({ date: '2026-03-01', total_pesewas: 5000 });
      expect(trend[1]).toEqual({ date: '2026-03-02', total_pesewas: 0 });
      expect(trend[14]).toEqual({ date: '2026-03-15', total_pesewas: 10000 });
    });
  });

  describe('summary type mapping', () => {
    it('maps credit to income, debit to expenses, ignores transfer for totals', () => {
      const rows = [
        { type: 'credit', total: 100000, fees: 0, count: 5 },
        { type: 'debit', total: 60000, fees: 2000, count: 12 },
        { type: 'transfer', total: 30000, fees: 500, count: 3 },
      ];

      let totalIncome = 0;
      let totalExpenses = 0;
      let totalFees = 0;
      let transactionCount = 0;

      for (const row of rows) {
        transactionCount += row.count;
        totalFees += row.fees;
        if (row.type === 'credit') totalIncome += row.total;
        else if (row.type === 'debit') totalExpenses += row.total;
      }

      expect(totalIncome).toBe(100000);
      expect(totalExpenses).toBe(60000);
      expect(totalFees).toBe(2500);
      expect(transactionCount).toBe(20); // includes transfer count
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/api && npx vitest run src/routes/dashboard.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/dashboard.test.ts
git commit -m "test: add dashboard helper and aggregation logic tests"
```

---

## Chunk 2: Install Recharts + Frontend Components (Data Display)

### Task 5: Install recharts dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install recharts**

Run: `cd apps/web && pnpm add recharts`

- [ ] **Step 2: Verify it installed**

Run: `cd apps/web && pnpm ls recharts`
Expected: Shows recharts version

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add recharts dependency for dashboard charts"
```

---

### Task 6: MonthPicker component

**Files:**
- Create: `apps/web/src/components/dashboard/MonthPicker.tsx`

- [ ] **Step 1: Create MonthPicker**

Create `apps/web/src/components/dashboard/MonthPicker.tsx`:

```tsx
interface MonthPickerProps {
  month: string; // "2026-03"
  onMonthChange: (month: string) => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1, 1);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

export function MonthPicker({ month, onMonthChange }: MonthPickerProps) {
  const isCurrentMonth = month === getCurrentMonth();

  return (
    <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-white/5">
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, -1))}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-gold hover:bg-white/10 transition-colors"
        aria-label="Previous month"
      >
        ←
      </button>

      <span className="text-white text-lg font-semibold">
        {formatMonthLabel(month)}
      </span>

      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, 1))}
        disabled={isCurrentMonth}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
          isCurrentMonth
            ? 'text-muted cursor-not-allowed'
            : 'text-gold hover:bg-white/10'
        }`}
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/MonthPicker.tsx
git commit -m "feat: add MonthPicker component for dashboard navigation"
```

---

### Task 7: BalanceCard component

**Files:**
- Create: `apps/web/src/components/dashboard/BalanceCard.tsx`

- [ ] **Step 1: Create BalanceCard**

Create `apps/web/src/components/dashboard/BalanceCard.tsx`:

```tsx
import { formatPesewas } from '@cedisense/shared';
import type { AccountType } from '@cedisense/shared';

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  balance_pesewas: number;
}

interface BalanceCardProps {
  totalBalance: number; // pesewas
  accounts: AccountItem[];
}

export function BalanceCard({ totalBalance, accounts }: BalanceCardProps) {
  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide">Total Balance</p>
      <p className="text-3xl font-bold text-white mt-1">{formatPesewas(totalBalance)}</p>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-muted"
            >
              <span className="text-white font-medium">{acc.name}</span>
              <span>{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/BalanceCard.tsx
git commit -m "feat: add BalanceCard component with account pills"
```

---

### Task 8: SummaryCard component

**Files:**
- Create: `apps/web/src/components/dashboard/SummaryCard.tsx`

- [ ] **Step 1: Create SummaryCard**

Create `apps/web/src/components/dashboard/SummaryCard.tsx`:

```tsx
import { formatPesewas } from '@cedisense/shared';

interface SummaryCardProps {
  income: number;   // pesewas
  expenses: number; // pesewas
  fees: number;     // pesewas
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <div className="grid grid-cols-2 gap-4">
        {/* Income */}
        <div className="bg-income/10 rounded-lg p-3">
          <p className="text-sm text-muted uppercase tracking-wide">Income</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-income text-sm">↑</span>
            <span className="text-xl font-semibold text-income">{formatPesewas(income)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-expense/10 rounded-lg p-3">
          <p className="text-sm text-muted uppercase tracking-wide">Expenses</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-expense text-sm">↓</span>
            <span className="text-xl font-semibold text-expense">{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted text-xs mt-1">Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>

      {/* Net */}
      <div className="mt-3 pt-3 border-t border-white/5 text-center">
        <span className="text-sm text-muted">Net: </span>
        <span className={`text-sm font-semibold ${net >= 0 ? 'text-income' : 'text-expense'}`}>
          {net >= 0 ? '+' : '-'}{formatPesewas(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/SummaryCard.tsx
git commit -m "feat: add SummaryCard component with income/expenses/net"
```

---

### Task 9: SpendingTrendChart component

**Files:**
- Create: `apps/web/src/components/dashboard/SpendingTrendChart.tsx`

- [ ] **Step 1: Create SpendingTrendChart**

Create `apps/web/src/components/dashboard/SpendingTrendChart.tsx`:

```tsx
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatPesewas } from '@cedisense/shared';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

interface DailyPoint {
  date: string;
  total_pesewas: number;
}

interface SpendingTrendChartProps {
  data: DailyPoint[];
}

function formatDay(date: string): string {
  return String(parseInt(date.split('-')[2], 10));
}

function formatTooltipDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-ghana-surface border border-white/10 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-muted text-xs">{formatTooltipDate(label)}</p>
      <p className="text-white text-sm font-semibold">{formatPesewas(payload[0].value)}</p>
    </div>
  );
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide mb-3">Daily Spending</p>
      <div className="h-[200px] md:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A843" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#D4A843" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fill: '#888888', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatPesewas(v)}
              tick={{ fill: '#888888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total_pesewas"
              stroke="#D4A843"
              strokeWidth={2}
              fill="url(#goldGradient)"
              isAnimationActive={!prefersReducedMotion}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/SpendingTrendChart.tsx
git commit -m "feat: add SpendingTrendChart area chart component"
```

---

### Task 10: CategoryDonut component

**Files:**
- Create: `apps/web/src/components/dashboard/CategoryDonut.tsx`

- [ ] **Step 1: Create CategoryDonut**

Create `apps/web/src/components/dashboard/CategoryDonut.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

interface CategoryDonutProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
}

export function CategoryDonut({ data, totalExpenses }: CategoryDonutProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative w-[180px] h-[180px] md:w-[220px] md:h-[220px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total_pesewas"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={1}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={600}
          >
            {data.map((entry) => (
              <Cell key={entry.category_id} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-muted text-xs">Total</span>
        <span className="text-white text-sm font-bold">{formatPesewas(totalExpenses)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/CategoryDonut.tsx
git commit -m "feat: add CategoryDonut chart component"
```

---

### Task 11: CategoryRankedList component

**Files:**
- Create: `apps/web/src/components/dashboard/CategoryRankedList.tsx`

- [ ] **Step 1: Create CategoryRankedList**

Create `apps/web/src/components/dashboard/CategoryRankedList.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';

interface CategoryRankedListProps {
  data: CategoryBreakdownItem[];
  month: string; // for drill-down URL
}

export function CategoryRankedList({ data, month }: CategoryRankedListProps) {
  const navigate = useNavigate();

  // The largest category's percentage determines the "100% bar width"
  const maxPercentage = data.length > 0 ? data[0].percentage : 100;

  function lastDayOfMonth(m: string): string {
    const [year, mon] = m.split('-').map(Number);
    const d = new Date(year, mon, 0);
    return `${year}-${String(mon).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function handleCategoryTap(categoryId: string) {
    if (categoryId === 'uncategorized') return; // can't filter by null
    const from = `${month}-01`;
    const to = lastDayOfMonth(month);
    navigate(`/transactions?category_id=${categoryId}&from=${from}&to=${to}`);
  }

  return (
    <div className="space-y-2">
      {data.map((cat) => (
        <button
          key={cat.category_id}
          type="button"
          onClick={() => handleCategoryTap(cat.category_id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left ${
            cat.category_id === 'uncategorized' ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          {/* Icon */}
          <span className="text-lg flex-shrink-0 w-8 text-center">{cat.icon}</span>

          {/* Name + bar */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{cat.name}</p>
            <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${maxPercentage > 0 ? (cat.percentage / maxPercentage) * 100 : 0}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>
          </div>

          {/* Amount + percentage */}
          <div className="text-right shrink-0">
            <p className="text-white text-sm font-medium">{formatPesewas(cat.total_pesewas)}</p>
            <p className="text-muted text-xs">{cat.percentage.toFixed(1)}%</p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/CategoryRankedList.tsx
git commit -m "feat: add CategoryRankedList component with drill-down"
```

---

### Task 12: CategoryBreakdownCard component

**Files:**
- Create: `apps/web/src/components/dashboard/CategoryBreakdownCard.tsx`

- [ ] **Step 1: Create CategoryBreakdownCard**

Create `apps/web/src/components/dashboard/CategoryBreakdownCard.tsx`:

```tsx
import type { CategoryBreakdownItem } from '@cedisense/shared';
import { CategoryDonut } from './CategoryDonut';
import { CategoryRankedList } from './CategoryRankedList';

interface CategoryBreakdownCardProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
  month: string;
}

export function CategoryBreakdownCard({ data, totalExpenses, month }: CategoryBreakdownCardProps) {
  const hasData = data.length > 0 && totalExpenses > 0;

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide mb-4">Spending by Category</p>

      {hasData ? (
        <div className="md:flex md:gap-6">
          {/* Donut — centered on mobile, left on desktop */}
          <div className="flex-shrink-0 mb-4 md:mb-0">
            <CategoryDonut data={data} totalExpenses={totalExpenses} />
          </div>

          {/* Ranked list */}
          <div className="flex-1 min-w-0">
            <CategoryRankedList data={data} month={month} />
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted text-sm">No spending data</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/CategoryBreakdownCard.tsx
git commit -m "feat: add CategoryBreakdownCard container component"
```

---

### Task 13: RecentTransactions component

**Files:**
- Create: `apps/web/src/components/dashboard/RecentTransactions.tsx`

This component wraps the existing `TransactionRow` component. It needs to pass a `categories` array. Since the dashboard response includes `category_name`/`category_icon` denormalized on each transaction, we construct a minimal `Category[]` from the breakdown data, plus fetch full categories via a separate API call for the `TransactionRow` lookup.

- [ ] **Step 1: Create RecentTransactions**

Create `apps/web/src/components/dashboard/RecentTransactions.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import type { Category, Transaction } from '@cedisense/shared';
import type { DashboardRecentTransaction } from '@cedisense/shared';
import { TransactionRow } from '../transactions/TransactionRow';

interface RecentTransactionsProps {
  transactions: DashboardRecentTransaction[];
  categories: Category[];
}

/**
 * Map DashboardRecentTransaction to Transaction shape expected by TransactionRow.
 * Fields not present in the dashboard response are set to safe defaults.
 */
function toTransaction(drt: DashboardRecentTransaction): Transaction {
  return {
    ...drt,
    user_id: '',
    raw_text: null,
    categorized_by: null,
    import_batch_id: null,
    updated_at: drt.created_at,
  };
}

export function RecentTransactions({ transactions, categories }: RecentTransactionsProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted uppercase tracking-wide">Recent Transactions</p>
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="text-gold text-sm font-medium hover:text-gold/80 transition-colors"
        >
          See all →
        </button>
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-1">
          {transactions.map((txn) => (
            <TransactionRow
              key={txn.id}
              transaction={toTransaction(txn)}
              categories={categories}
              compact
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-muted text-sm">No transactions yet</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/RecentTransactions.tsx
git commit -m "feat: add RecentTransactions component reusing TransactionRow"
```

---

## Chunk 3: Dashboard Page Assembly + TransactionFeed URL Params

### Task 14: Replace DashboardPage placeholder

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx` (full rewrite)

- [ ] **Step 1: Rewrite DashboardPage**

Replace the entire contents of `apps/web/src/pages/DashboardPage.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { DashboardData, Category } from '@cedisense/shared';
import { MonthPicker } from '@/components/dashboard/MonthPicker';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { SpendingTrendChart } from '@/components/dashboard/SpendingTrendChart';
import { CategoryBreakdownCard } from '@/components/dashboard/CategoryBreakdownCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache: month → DashboardData
  const cache = useRef<Map<string, DashboardData>>(new Map());

  // Fetch categories once for TransactionRow
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(() => {/* non-fatal */});
  }, []);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async (m: string) => {
    const isCurrent = m === getCurrentMonth();

    // Use cache for non-current months
    if (!isCurrent && cache.current.has(m)) {
      setData(cache.current.get(m)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.get<DashboardData>(`/dashboard?month=${m}`);
      cache.current.set(m, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(month);
  }, [month, fetchDashboard]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="pb-24">
      <MonthPicker month={month} onMonthChange={setMonth} />

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Greeting */}
        <p className="text-muted text-sm">
          {greeting}, {user?.name?.split(' ')[0]}
        </p>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-36 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-[200px] rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-64 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(month)}
              className="text-gold text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard content */}
        {data && !loading && !error && (
          <>
            {/* Balance + Summary: side-by-side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BalanceCard
                totalBalance={data.accounts.total_balance_pesewas}
                accounts={data.accounts.items}
              />
              <SummaryCard
                income={data.summary.total_income_pesewas}
                expenses={data.summary.total_expenses_pesewas}
                fees={data.summary.total_fees_pesewas}
              />
            </div>

            <SpendingTrendChart data={data.daily_trend} />

            <CategoryBreakdownCard
              data={data.category_breakdown}
              totalExpenses={data.summary.total_expenses_pesewas}
              month={month}
            />

            <RecentTransactions
              transactions={data.recent_transactions}
              categories={categories}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx
git commit -m "feat: replace placeholder DashboardPage with real analytics dashboard"
```

---

### Task 15: Update TransactionFeedPage to read URL search params

**Files:**
- Modify: `apps/web/src/pages/TransactionFeedPage.tsx`

The dashboard drills down to `/transactions?category_id=X&from=YYYY-MM-01&to=YYYY-MM-DD`. Currently, the TransactionFeedPage initializes filters from empty strings. We need to seed from URL params.

- [ ] **Step 1: Add useSearchParams import and initialization**

In `apps/web/src/pages/TransactionFeedPage.tsx`:

1. Add `useSearchParams` to the react-router-dom import (line 2):
```typescript
import { useNavigate, useSearchParams } from 'react-router-dom';
```

2. Add `useSearchParams` call at the top of the component (after `const navigate = useNavigate();` on line 36):
```typescript
const [searchParams] = useSearchParams();
```

3. Update the filter state initializers (lines 51-53) to read from URL params:

Replace:
```typescript
const [accountFilter, setAccountFilter] = useState('');
const [categoryFilter, setCategoryFilter] = useState('');
const [search, setSearch] = useState('');
const [searchInput, setSearchInput] = useState('');
```

With:
```typescript
const [accountFilter, setAccountFilter] = useState(searchParams.get('account_id') ?? '');
const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category_id') ?? '');
const [search, setSearch] = useState('');
const [searchInput, setSearchInput] = useState('');
```

4. Add `from`/`to` filter state seeded from URL params (after the `searchInput` state):
```typescript
const [fromFilter, setFromFilter] = useState(searchParams.get('from') ?? '');
const [toFilter, setToFilter] = useState(searchParams.get('to') ?? '');
```

5. Update the `buildQuery` function to include `from`/`to`:

```typescript
const buildQuery = useCallback(
  (p: number) => {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(LIMIT));
    if (accountFilter) params.set('account_id', accountFilter);
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (search) params.set('search', search);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    return `/transactions?${params.toString()}`;
  },
  [accountFilter, categoryFilter, search, fromFilter, toFilter]
);
```

Note: `fromFilter` and `toFilter` are in React state so they can be cleared when the user changes filters via the UI. They're only pre-populated from URL params on initial mount.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/TransactionFeedPage.tsx
git commit -m "feat: read initial filters from URL params for dashboard drill-down"
```

---

## Chunk 4: Full Integration Verification

### Task 16: TypeScript compilation check (all packages)

- [ ] **Step 1: Run typecheck across all packages**

Run: `pnpm -r run typecheck` (or `cd packages/shared && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`)
Expected: 0 errors across all 3 packages

- [ ] **Step 2: Run all tests**

Run: `pnpm -r run test` (or run vitest in each package)
Expected: All existing tests pass + new dashboard tests pass

- [ ] **Step 3: Fix any issues and commit**

If there are TypeScript errors or test failures, fix them and commit:
```bash
git commit -m "fix: resolve TypeScript and test issues from dashboard integration"
```

---

### Task 17: Manual smoke test

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev` (or start API and web dev servers separately)

- [ ] **Step 2: Verify dashboard loads**

1. Login to the app
2. Navigate to `/` (dashboard)
3. Verify:
   - MonthPicker shows current month with working navigation
   - BalanceCard shows total balance + account pills
   - SummaryCard shows income/expenses/net (may be ₵0.00 if no data)
   - SpendingTrendChart renders (flat line if no data)
   - CategoryBreakdownCard shows "No spending data" or donut + list
   - RecentTransactions shows recent items or empty state

- [ ] **Step 3: Test drill-down**

1. If there are categories in the breakdown, tap one
2. Verify it navigates to `/transactions?category_id=X&from=...&to=...`
3. Verify the transaction feed shows filtered results

- [ ] **Step 4: Test month navigation**

1. Navigate to previous month
2. Verify data refreshes (skeleton → new data)
3. Navigate back — should be instant (cached)
4. Verify right arrow is disabled on current month

- [ ] **Step 5: Stop dev servers**

Stop both servers after verification.
