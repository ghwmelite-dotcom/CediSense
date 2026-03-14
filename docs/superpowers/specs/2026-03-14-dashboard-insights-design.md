# Dashboard & Insights — Design Spec

## Overview

Replace the placeholder DashboardPage with a data-driven analytics dashboard showing monthly financial summaries, spending trends, and category breakdowns. All data is server-aggregated via a single API endpoint, with drill-down to the existing transaction feed.

## Scope

**In scope:**
- Total balance across all accounts
- Monthly income vs expenses summary
- Daily spending trend (area chart)
- Category breakdown (donut chart + ranked list)
- Recent transactions (last 5)
- Month-by-month navigation
- Drill-down to filtered transaction feed

**Out of scope:**
- Budgets and savings goals (future subsystems)
- AI-generated text insights (future subsystem)
- PDF/export of dashboard data

## Tech Stack

- **Charts:** Recharts (React-native, declarative, ~45KB gzipped)
- **API:** Single `GET /api/v1/dashboard?month=YYYY-MM` endpoint
- **Aggregation:** Server-side D1 SQL (SUM, GROUP BY)
- **Formatting:** Existing `formatPesewas()` from `packages/shared/src/format.ts`

---

## API Design

### Endpoint

`GET /api/v1/dashboard?month=2026-03`

- Requires authentication (same auth middleware as other routes)
- `month` parameter: `YYYY-MM` format, defaults to current month if omitted
- Validate month format, reject future months beyond current
- Returns `{ data: DashboardData }` wrapped in the standard `ApiSuccess<T>` envelope (same as all other endpoints)
- Error responses: `{ error: { code: 'VALIDATION_ERROR', message: '...' } }` with HTTP 400 for invalid month format or future months

### Response Shape

The response is wrapped in the standard `ApiSuccess<DashboardData>` envelope: `c.json({ data: dashboardData })`.

See the `DashboardData` type definition in the [Types section](#types-additions-to-packagessabornedsrctypests) below for the full shape. Key notes:

- `category_breakdown[].icon` and `category_breakdown[].color` are non-nullable strings — SQL uses `COALESCE(c.icon, '📦')` and `COALESCE(c.color, '#888888')` to provide defaults
- `category_breakdown` includes an "Uncategorized" entry for debit transactions with no category (computed as remainder)
- `summary` counts only `credit` as income and `debit` as expenses; `transfer` amounts are excluded from totals but included in `transaction_count`
- `recent_transactions` are NOT month-filtered — they show the user's 5 most recent transactions globally, because users want to see latest activity regardless of which historical month they are viewing

### SQL Queries

All queries scoped to `user_id` from auth context. Month range computed as `YYYY-MM-01` to last day of month.

1. **Accounts:**
   ```sql
   SELECT id, name, type, provider, balance_pesewas
   FROM accounts
   WHERE user_id = ?
   ORDER BY is_primary DESC, created_at ASC
   ```

2. **Summary:**
   ```sql
   SELECT type, SUM(amount_pesewas) as total, SUM(fee_pesewas) as fees, COUNT(*) as count
   FROM transactions
   WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ?
   GROUP BY type
   ```
   Map `credit` → income, `debit` → expenses. `transfer` type is excluded from income/expense totals but included in `transaction_count`. Sum fees across all types.

3. **Category breakdown:**
   ```sql
   SELECT c.id, c.name,
          COALESCE(c.icon, '📦') as icon,
          COALESCE(c.color, '#888888') as color,
          SUM(t.amount_pesewas) as total_pesewas,
          COUNT(*) as transaction_count
   FROM transactions t
   JOIN categories c ON t.category_id = c.id
   WHERE t.user_id = ? AND t.type = 'debit'
     AND t.transaction_date >= ? AND t.transaction_date <= ?
   GROUP BY c.id
   ORDER BY total_pesewas DESC
   ```
   Compute `percentage` server-side: `(category_total / grand_total) * 100`, rounded to 1 decimal.

   **Uncategorized transactions:** After querying categorized totals, compute the uncategorized amount as `total_expenses - SUM(categorized_totals)`. If > 0, append an "Uncategorized" entry with `category_id: 'uncategorized'`, `icon: '❓'`, `color: '#888888'`. This ensures the donut always sums to 100%.

4. **Daily trend:**
   ```sql
   SELECT transaction_date, SUM(amount_pesewas) as total_pesewas
   FROM transactions
   WHERE user_id = ? AND type = 'debit'
     AND transaction_date >= ? AND transaction_date <= ?
   GROUP BY transaction_date
   ```
   Server fills in missing days with `{ date, total_pesewas: 0 }` for all days in the month.

5. **Recent transactions:**
   ```sql
   SELECT t.id, t.account_id, t.category_id, t.type, t.amount_pesewas,
          t.fee_pesewas, t.description, t.counterparty, t.reference,
          t.source, t.transaction_date, t.created_at,
          c.name as category_name, c.icon as category_icon, a.name as account_name
   FROM transactions t
   LEFT JOIN categories c ON t.category_id = c.id
   LEFT JOIN accounts a ON t.account_id = a.id
   WHERE t.user_id = ?
   ORDER BY t.transaction_date DESC, t.created_at DESC
   LIMIT 5
   ```
   Note: Explicit column list instead of `SELECT t.*` to avoid sending `raw_text` (SMS body) to the frontend.
   Note: This query is NOT month-filtered — it returns the 5 most recent transactions globally.

### Middleware Registration

Register middleware WITHOUT wildcard for the root-level GET:
```typescript
app.use('/api/v1/dashboard', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/dashboard', dashboard);
```
No wildcard `/*` — the dashboard route is a single GET on `/` (the sub-router root).

### Drill-Down

No new endpoints. Tapping a category navigates to:
`/transactions?category_id=X&from=YYYY-MM-01&to=YYYY-MM-DD`

This reuses the existing transaction feed page. **Requires modification:** `TransactionFeedPage` must be updated to read initial filter state from URL search params (`useSearchParams`). Currently filters are initialized as empty strings — they need to be seeded from query params on mount.

---

## Frontend Design

### Page Layout (mobile-first, vertical scroll)

```
DashboardPage
├── MonthPicker          — sticky, ← March 2026 →
├── BalanceCard          — total balance + account pills
├── SummaryCard          — income vs expenses side-by-side
├── SpendingTrendChart   — Recharts AreaChart, daily spending
├── CategoryBreakdownCard
│   ├── CategoryDonut    — Recharts PieChart with inner radius
│   └── CategoryRankedList — all categories with bars
└── RecentTransactions   — last 5, reuses TransactionRow
```

### MonthPicker

- Sticky bar at top of dashboard content (below TopBar)
- Left arrow (←) and right arrow (→) flanking "March 2026" label
- Right arrow disabled when viewing current month (no future data)
- Arrows trigger new API fetch with updated `month` param
- Gold (#D4A843) arrow color on hover, muted (#888888) when disabled

### BalanceCard

- Large prominent total: ₵X,XXX.XX in white text
- Label: "Total Balance" above the amount
- Below: horizontal row of small pills, one per account
  - Each pill shows: account name + ₵amount
  - Pill background: subtle white/5 with border
- Background: ghana-surface (#1A1A2E) with border-white/10

### SummaryCard

- Two numbers side by side in equal-width columns
- Left: Income — ↑ arrow icon, amount in income green (#4ADE80), subtle green-tinted background
- Right: Expenses — ↓ arrow icon, amount in expense red (#F87171), subtle red-tinted background
- Below both: "Net: ₵X,XXX.XX" in smaller text (green if positive, red if negative)
- Sub-line: "Fees: ₵XX.XX" in muted text under expenses

### SpendingTrendChart

- Recharts `ResponsiveContainer` → `AreaChart`
- Area fill: gold (#D4A843) at 20% opacity
- Stroke: gold (#D4A843) at full opacity, 2px width
- X-axis: day numbers (1, 5, 10, 15, 20, 25, 30), tick color muted
- Y-axis: auto-scaled ₵ amounts, tick color muted
- Tooltip: shows full date ("14 Mar 2026") and formatted amount (₵X,XXX.XX)
- Chart height: 200px mobile, 250px desktop
- Grid lines: subtle white/5 horizontal only

### CategoryBreakdownCard

**Donut chart (top):**
- Recharts `PieChart` with `Pie` component, `innerRadius="50%"`, `outerRadius="80%"`
- Each slice uses the category's `color` from the database
- Center of donut: total expenses amount
- Diameter: 180px mobile, 220px desktop
- Animate slice drawing on data load

**Ranked list (below donut):**
- Each row: category icon (emoji) | category name | horizontal progress bar | amount | percentage
- Progress bar fill color matches the category's donut slice color
- Bar width proportional to percentage (largest category = 100% bar width)
- Rows sorted by amount descending (same order as API response)
- Each row tappable → navigates to filtered transaction feed
- Show all expense categories that have transactions, no limit

### RecentTransactions

- Reuses existing `TransactionRow` component
- Pass a `categories` array alongside transactions (fetch categories from the dashboard response's category_breakdown, mapping to the shape TransactionRow expects). Alternatively, make a separate `/categories` call on mount — simpler since TransactionRow already expects `Category[]`.
- Shows last 5 transactions (from API response, not month-filtered — see API Design section for rationale)
- "See all →" link at bottom navigates to `/transactions`
- Same expand-on-tap behavior as transaction feed

### Responsive Layout

**Mobile (<768px):**
- Single column, full-width cards
- Cards stacked vertically with 16px gap
- Chart heights: 200px
- Donut: 180px diameter
- Padding: 16px horizontal

**Desktop (≥768px):**
- BalanceCard and SummaryCard in a 2-column grid (side by side)
- SpendingTrendChart: full width, 250px height
- CategoryBreakdownCard: full width, donut and list side by side (donut left, list right)
- RecentTransactions: full width
- Max content width: 1024px, centered

### Loading States

- **Initial load / month change:** Skeleton cards with pulse animation
  - Balance skeleton: large rectangle + row of small pill rectangles
  - Summary skeleton: two side-by-side rectangles
  - Chart skeleton: rectangle with faint wave pattern
  - Category skeleton: circle + 4 bar rows
  - Transactions skeleton: 5 TransactionRow-shaped rectangles
- **Month change:** Show skeletons while fetching, fade-in new data

### Empty States

- **No transactions this month:** Area chart shows flat zero line, donut is empty circle with "No spending data" text, summary shows ₵0.00 for both
- **No accounts:** Should not happen post-onboarding, but show "Add your first account" prompt defensively

### Caching

- Cache fetched month data in component state (React `useRef` or `useState` map)
- Back-navigation to previously viewed months is instant (no re-fetch)
- Current month always re-fetches on mount (data may have changed)

---

## Styling

### Colors

| Element | Color | Token |
|---------|-------|-------|
| Card background | #1A1A2E | ghana-surface |
| Card border | white/10 | border-white/10 |
| Income amount | #4ADE80 | income |
| Expense amount | #F87171 | expense |
| Chart fill | #D4A843 @ 20% | gold/20 |
| Chart stroke | #D4A843 | gold |
| Muted text | #888888 | muted |
| Arrow hover | #D4A843 | gold |
| Arrow disabled | #888888 | muted |

### Animations

- **Card mount:** Fade-in with 8px upward translate, 150ms ease-out
- **Donut slices:** Animate drawing on data load (Recharts `isAnimationActive`)
- **Area chart:** Animate draw-in from left (Recharts built-in animation)
- **Month change:** Skeleton → fade-in for new data
- **All animations:** Respect `prefers-reduced-motion` media query — disable when set

### Typography

- Balance amount: text-3xl font-bold
- Income/expense amounts: text-xl font-semibold
- Card labels: text-sm text-muted uppercase tracking-wide
- Category names: text-sm
- Percentages: text-sm text-muted
- Month picker label: text-lg font-semibold

### Spacing

- Base-8 grid: 8px, 16px, 24px, 32px increments
- Card padding: 16px (p-4)
- Card gap: 16px (gap-4)
- Card border-radius: 12px (rounded-xl)

---

## Formatting

- All monetary amounts: `formatPesewas()` from `packages/shared/src/format.ts`
- Percentages: one decimal place ("34.2%")
- Month picker label: `new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })`
- Daily trend tooltip date: "14 Mar 2026" format
- Recent transaction dates: relative ("Today", "Yesterday") or short ("Mon 10 Mar")

---

## Types (additions to packages/shared/src/types.ts)

```typescript
export interface CategoryBreakdownItem {
  category_id: string;  // real ID or 'uncategorized' for the remainder
  name: string;
  icon: string;         // non-null, COALESCE'd to '📦' or '❓' for uncategorized
  color: string;        // non-null, COALESCE'd to '#888888'
  total_pesewas: number;
  transaction_count: number;
  percentage: number;   // e.g. 34.2
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
    transaction_count: number; // includes all types (credit, debit, transfer)
  };
  category_breakdown: CategoryBreakdownItem[]; // sorted by total_pesewas DESC, includes 'uncategorized' if applicable
  daily_trend: Array<{
    date: string;
    total_pesewas: number;
  }>;
  recent_transactions: DashboardRecentTransaction[]; // last 5 globally, NOT month-filtered
}
```

## Validation (additions to packages/shared/src/schemas.ts)

```typescript
export const dashboardQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});
```

---

## File Structure

### New Files
- `apps/api/src/routes/dashboard.ts` — Dashboard endpoint
- `apps/web/src/components/dashboard/MonthPicker.tsx`
- `apps/web/src/components/dashboard/BalanceCard.tsx`
- `apps/web/src/components/dashboard/SummaryCard.tsx`
- `apps/web/src/components/dashboard/SpendingTrendChart.tsx`
- `apps/web/src/components/dashboard/CategoryBreakdownCard.tsx`
- `apps/web/src/components/dashboard/CategoryDonut.tsx`
- `apps/web/src/components/dashboard/CategoryRankedList.tsx`
- `apps/web/src/components/dashboard/RecentTransactions.tsx`

### Modified Files
- `packages/shared/src/types.ts` — Add `DashboardData` type
- `packages/shared/src/schemas.ts` — Add `dashboardQuerySchema`
- `apps/api/src/index.ts` — Mount dashboard route (without wildcard middleware)
- `apps/web/src/pages/DashboardPage.tsx` — Replace placeholder with real dashboard
- `apps/web/src/pages/TransactionFeedPage.tsx` — Read initial filters from URL search params for drill-down support
- `apps/web/package.json` — Add `recharts` dependency

### Test Files
- `apps/api/src/routes/dashboard.test.ts`
- `apps/web/src/components/dashboard/__tests__/MonthPicker.test.tsx`
- (Additional component tests as needed)
