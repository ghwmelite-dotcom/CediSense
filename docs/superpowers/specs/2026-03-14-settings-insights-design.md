# Settings Enhancement & Spending Insights — Design Spec

## Overview

Enhance the Settings page into a full management hub (profile, accounts, categories, rules) and build a dedicated Spending Insights page with month-over-month comparisons, category trends, and AI-generated monthly reports.

## Scope

**In scope:**
- Settings page: profile editing, account management, category management, rule management
- Insights API: `GET /api/v1/insights?month=YYYY-MM` with current + previous month comparison
- AI monthly report: `POST /api/v1/insights/report` with non-streaming AI summary
- Insights page with comparison cards, category trend chart, top changes, AI report
- Dashboard link to insights page

**Out of scope:**
- Data export (CSV download) — Phase 3
- Anomaly detection / real-time alerts — Phase 3
- Notification preferences — no push notifications yet
- Language/theme settings — Phase 3

## Tech Stack

- **API:** Hono on Cloudflare Workers, D1
- **Charts:** Recharts (already installed)
- **AI:** Workers AI Qwen3-30B for report generation (non-streaming)
- **Frontend:** React 18, Tailwind CSS, reuses existing components (MonthPicker, AmountInput, renderMarkdown)

---

## API Design — Insights

### Middleware Registration

```typescript
// IMPORTANT: Both bare path AND wildcard required — GET / needs the first, POST /report needs the second.
// This differs from the dashboard pattern (single handler, no wildcard). Do NOT collapse to one line.
app.use('/api/v1/insights', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/insights/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/insights', insights);
```

### `GET /api/v1/insights?month=YYYY-MM`

Returns current month + previous month data for comparison. Response: `{ data: InsightsData }`.

```typescript
interface MonthSummary {
  total_income_pesewas: number;
  total_expenses_pesewas: number;
  total_fees_pesewas: number;
  transaction_count: number;
}

interface CategoryTrend {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  current_pesewas: number;
  previous_pesewas: number;
  change_pesewas: number;
  change_percentage: number;  // ((current - previous) / previous) * 100, 0 if previous is 0
}

interface SpendingChange {
  category_name: string;
  icon: string;
  direction: 'up' | 'down' | 'new';
  change_percentage: number;
  current_pesewas: number;
  previous_pesewas: number;
}

interface InsightsData {
  current_month: string;
  previous_month: string;
  current: MonthSummary;
  previous: MonthSummary;
  category_trends: CategoryTrend[];
  top_changes: SpendingChange[];
}
```

**Server-side flow:**
1. Parse `month` param (default: current month), compute previous month
2. Fetch summaries for both months using `fetchSummary` + `assembleSummary` from `dashboard-queries.ts`
3. Fetch category breakdowns for both months using `fetchCategoryBreakdown` — note: this is **expenses only** (`type = 'debit'`), so category trends show expense category changes only
4. Merge categories: union of both months' category IDs, compute `change_pesewas` and `change_percentage`. Cap server-side to top 15 by combined spend to avoid large payloads.
5. Compute `top_changes`: sorted by absolute `change_percentage` DESC, top 5. Categories in current but not previous are `direction: 'new'`. Categories in previous but not current get `direction: 'down'` with `current_pesewas: 0` and `change_percentage: -100`.

**Previous month computation** (add to `apps/api/src/lib/dashboard-queries.ts` alongside existing date utilities):
```typescript
export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

### `POST /api/v1/insights/report`

Generate an AI monthly spending report (non-streaming).

**Request:**
```typescript
{ month?: string }  // YYYY-MM, defaults to current
```

**Validation:** `month` optional, same YYYY-MM regex as dashboard.

**Server-side flow:**
1. Fetch insights data (same queries as GET endpoint)
2. Build report prompt with financial context:
   ```
   Current month (March 2026): Income ₵3,500, Expenses ₵2,100, Net +₵1,400
   Previous month (February 2026): Income ₵3,200, Expenses ₵2,400, Net +₵800

   Category changes:
   - Food & Groceries: ₵650 → ₵520 (-20.0%)
   - Transport: ₵420 → ₵380 (-9.5%)
   - Family Support: ₵280 → ₵350 (+25.0%)
   ```
3. Call Workers AI (Qwen3-30B, non-streaming): `{ stream: false, max_tokens: 1024 }`
4. Return: `{ data: { report: string, month: string } }`

**System prompt for report:**
```
You are CediSense AI generating a monthly financial report for a Ghanaian user.
Write a concise 3-4 paragraph summary covering:
1. Overall spending vs income comparison to last month
2. Notable category changes (what went up/down significantly)
3. One specific, actionable savings tip based on the data
Use ₵ formatting. Be warm and encouraging. Reference specific numbers from the data provided.
Do not use headers or bullet points — write in flowing paragraphs.
```

**AI rate limiting:** Reuse the existing `ai-usage:{userId}:{date}` KV counter from the chat route. Increment on each report generation. This shares the 40/day soft limit across both chat and reports, preventing AI cost abuse.

**Future month guard:** Reject `month > currentMonth()` with 400 `VALIDATION_ERROR`, same as the dashboard endpoint.

**Error response:** `{ error: { code: 'AI_ERROR', message: 'Failed to generate report' } }` with 500.

---

## Settings Page — Frontend Design

### Page Layout

```
SettingsPage (/settings)
├── ProfileSection      — name, income, phone (read-only)
├── AccountsSection     — list accounts, add/edit/delete
├── CategoriesSection   — list custom categories, add/edit/delete
├── RulesSection        — list auto-categorization rules, add/edit/delete
└── LogoutButton        — red, bottom of page
```

All sections are collapsible ghana-surface cards. Uses existing API endpoints only — no new backend.

### ProfileSection

- Header: "Profile" + "Edit" toggle button
- Display mode: name, phone (read-only with lock icon), monthly income
- Edit mode: name text input, income AmountInput
- Save: `PUT /api/v1/users/me` → refresh
- Cancel: revert to display mode

### AccountsSection

- Header: "Accounts" + "Add" button
- List: each account shows name, type badge (MoMo/Bank/Cash/Susu), provider if set, balance
  - Type badge colors: MoMo = gold, Bank = ghana-green, Cash = muted, Susu = income
- Inline edit: tap card to expand → name input, balance AmountInput, save/delete buttons. Note: `type` and `provider` are immutable after creation (not in `updateAccountSchema`) — display them as read-only badges in edit mode.
- Add: expands inline form at top — name, type dropdown, provider (optional), balance AmountInput
- Delete: two-tap confirmation, blocked if last account
- API: `GET/POST/PUT/DELETE /api/v1/accounts`

### CategoriesSection

- Header: "Categories" + "Add" button
- List: only user-created categories (filter where `user_id !== null`)
- Each row: icon (emoji) + name + type badge (income/expense/transfer)
- Inline edit: icon input (text, 1 emoji), name input, save/delete
- Add: inline form — icon, name, type dropdown (income/expense/transfer), optional color hex
- Delete: two-tap confirmation
- API: `GET/POST/PUT/DELETE /api/v1/categories`

### RulesSection

- Header: "Auto-Categorization Rules" + "Add" button
- List: each rule shows "When {field} {match_type} '{value}' → {category_name}"
  - e.g., "When counterparty contains 'MTN' → Airtime & Data"
- Inline edit: field dropdown, type dropdown, value input, category dropdown, save/delete
- Add: inline form with same fields
- Category dropdown shows all categories (system + user)
- API: `GET/POST/PUT/DELETE /api/v1/category-rules`

### LogoutButton

- Full width at bottom: `bg-expense/10 text-expense rounded-xl py-3`
- Calls `logout()` from AuthContext

### Data Loading

- On mount: parallel fetch `users/me`, `accounts`, `categories`, `category-rules`
- Loading skeleton: 4 pulse cards
- Error: per-section error messages with retry

---

## Insights Page — Frontend Design

### Page Layout

```
InsightsPage (/insights)
├── PageHeader           — "Spending Insights" + MonthPicker
├── ComparisonCard       — current vs previous month
├── CategoryTrendsChart  — grouped bar chart
├── TopChangesCard       — ranked spending changes
├── AIReportSection      — generate + display AI report
└── EmptyState           — when no data
```

### PageHeader

- "Spending Insights" (text-xl font-bold text-white)
- Reuse `MonthPicker` component from dashboard
- Fetches insights on month change

### ComparisonCard

- ghana-surface card, rounded-xl, p-4
- Two columns: previous month (left, muted) and current month (right, white)
- Each column: month label, income amount, expenses amount, net amount
- Below columns: change indicators
  - Income change: "↑ 12.5%" (income green if up, expense red if down)
  - Expense change: "↑ 15.0%" (expense red if up — spending increase is bad, income green if down)
- Net change: green if net improved (higher than previous), red if worsened

### CategoryTrendsChart

- Recharts `BarChart` with horizontal layout
- Grouped bars per category: previous (muted, 40% opacity) + current (category color)
- Top 6 categories by current month spending
- Y-axis: category names with icons
- X-axis: ₵ amounts
- Tooltip: both month amounts + change %
- `ResponsiveContainer`, height 300px
- Respect `prefers-reduced-motion` for animations

### TopChangesCard

- ghana-surface card, rounded-xl, p-4
- Header: "Biggest Changes"
- Top 5 changes sorted by absolute change_percentage DESC
- Each row: icon + category name + direction arrow + percentage + amounts
  - Up: "↑" text-expense (spending increase), "₵650 vs ₵519"
  - Down: "↓" text-income (spending decrease), "₵380 vs ₵420"
  - New: "NEW" text-gold badge, "₵150 (new)"
- Empty state: "No changes to show" if only one month of data

### AIReportSection

- ghana-surface card, rounded-xl, p-4
- Header: "✨ Monthly Summary"
- States:
  - **Initial:** "Generate Report" gold button centered
  - **Loading:** skeleton with pulse animation
  - **Loaded:** rendered markdown (reuse `renderMarkdown` from `@/lib/markdown`)
  - **Error:** "Failed to generate report" with retry button
- Report is component state only (regenerate each visit, not persisted)
- Button calls `POST /api/v1/insights/report` with current month

### Dashboard Link

Add a "View Insights →" link in `DashboardPage.tsx` after the `RecentTransactions` component:
```tsx
<button onClick={() => navigate('/insights')} className="text-gold text-sm">
  View Insights →
</button>
```

### Responsive Layout

- **Mobile:** Single column, all cards full width
- **Desktop:** ComparisonCard full width, CategoryTrendsChart full width, TopChanges + AIReport side-by-side (2-col grid)
- Max width: max-w-screen-lg mx-auto (matches dashboard)

### Empty State

- When both months have zero transactions
- Centered: 📊 icon + "Not enough data for insights yet" + "Add some transactions first"

---

## Styling

### Colors (in addition to existing tokens)

| Element | Color | Token |
|---------|-------|-------|
| Income change (positive) | #4ADE80 | text-income |
| Expense change (increase) | #F87171 | text-expense |
| Expense change (decrease) | #4ADE80 | text-income |
| New category badge | #D4A843 | text-gold |
| Previous month bar | category color @ 40% | opacity-40 |
| Report button | #D4A843 | bg-gold |
| Account type: MoMo | #D4A843 | gold |
| Account type: Bank | #006B3F | ghana-green |
| Account type: Cash | #888888 | muted |
| Account type: Susu | #4ADE80 | income |

---

## Types (additions to packages/shared/src/types.ts)

```typescript
export interface MonthSummary {
  total_income_pesewas: number;
  total_expenses_pesewas: number;
  total_fees_pesewas: number;
  transaction_count: number;
}

export interface CategoryTrend {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  current_pesewas: number;
  previous_pesewas: number;
  change_pesewas: number;
  change_percentage: number;
}

export type ChangeDirection = 'up' | 'down' | 'new';

export interface SpendingChange {
  category_name: string;
  icon: string;
  direction: ChangeDirection;
  change_percentage: number;
  current_pesewas: number;
  previous_pesewas: number;
}

export interface InsightsData {
  current_month: string;
  previous_month: string;
  current: MonthSummary;
  previous: MonthSummary;
  category_trends: CategoryTrend[];
  top_changes: SpendingChange[];
}

export interface InsightsReport {
  report: string;
  month: string;
}
```

## Validation (additions to packages/shared/src/schemas.ts)

```typescript
// Shared by both GET /insights and POST /insights/report (same shape)
export const insightsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});

export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;
```

---

## File Structure

### New Files
- `apps/api/src/routes/insights.ts` — Insights + report endpoints
- `apps/web/src/pages/InsightsPage.tsx` — Full insights page
- `apps/web/src/components/insights/ComparisonCard.tsx`
- `apps/web/src/components/insights/CategoryTrendsChart.tsx`
- `apps/web/src/components/insights/TopChangesCard.tsx`
- `apps/web/src/components/insights/AIReportSection.tsx`
- `apps/web/src/components/settings/ProfileSection.tsx`
- `apps/web/src/components/settings/AccountsSection.tsx`
- `apps/web/src/components/settings/CategoriesSection.tsx`
- `apps/web/src/components/settings/RulesSection.tsx`

### Modified Files
- `packages/shared/src/types.ts` — Add InsightsData, MonthSummary, CategoryTrend, SpendingChange types
- `packages/shared/src/schemas.ts` — Add insightsQuerySchema
- `apps/api/src/lib/dashboard-queries.ts` — Add `previousMonth` utility
- `apps/api/src/index.ts` — Mount insights route
- `apps/web/src/pages/SettingsPage.tsx` — Full rewrite with management sections
- `apps/web/src/pages/DashboardPage.tsx` — Add "View Insights →" link
- `apps/web/src/App.tsx` — Add `/insights` route with `<Route path="/insights" element={<InsightsPage />} />`
