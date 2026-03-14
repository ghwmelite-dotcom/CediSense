# Settings Enhancement & Spending Insights Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Settings page into a full management hub and build a Spending Insights page with month-over-month comparisons and AI-generated monthly reports.

**Architecture:** Settings is purely frontend over existing APIs (users, accounts, categories, category-rules). Insights has one new API route with two endpoints (GET comparison data, POST AI report). AI report reuses Workers AI + shared KV usage counter.

**Tech Stack:** Hono, D1, Workers AI, React 18, Recharts, Tailwind CSS, TypeScript strict

**Spec:** `docs/superpowers/specs/2026-03-14-settings-insights-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/src/routes/insights.ts` | GET insights + POST report endpoints |
| `apps/web/src/components/settings/ProfileSection.tsx` | Profile editing |
| `apps/web/src/components/settings/AccountsSection.tsx` | Account management |
| `apps/web/src/components/settings/CategoriesSection.tsx` | Category management |
| `apps/web/src/components/settings/RulesSection.tsx` | Rule management |
| `apps/web/src/components/insights/ComparisonCard.tsx` | Month comparison |
| `apps/web/src/components/insights/CategoryTrendsChart.tsx` | Grouped bar chart |
| `apps/web/src/components/insights/TopChangesCard.tsx` | Biggest changes list |
| `apps/web/src/components/insights/AIReportSection.tsx` | AI report button + display |
| `apps/web/src/pages/InsightsPage.tsx` | Full insights page |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add InsightsData, MonthSummary, CategoryTrend, SpendingChange, InsightsReport |
| `packages/shared/src/schemas.ts` | Add insightsQuerySchema |
| `apps/api/src/lib/dashboard-queries.ts` | Add `previousMonth` utility |
| `apps/api/src/index.ts` | Mount insights route |
| `apps/web/src/pages/SettingsPage.tsx` | Full rewrite |
| `apps/web/src/pages/DashboardPage.tsx` | Add "View Insights" link |
| `apps/web/src/App.tsx` | Add `/insights` route |

---

## Chunk 1: Shared Types + Insights API

### Task 1: Add shared types, schema, and previousMonth utility

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `apps/api/src/lib/dashboard-queries.ts`

- [ ] **Step 1: Add insights types**

Append to `packages/shared/src/types.ts`:

```typescript
// ─── Insights types ───────────────────────────────────────────────────────────

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

- [ ] **Step 2: Add insights schema**

Append to `packages/shared/src/schemas.ts`:

```typescript
// ─── Insights schema ──────────────────────────────────────────────────────────

// Shared by both GET /insights and POST /insights/report
export const insightsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});

export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;
```

- [ ] **Step 3: Add previousMonth to dashboard-queries.ts**

Append to `apps/api/src/lib/dashboard-queries.ts`:

```typescript
export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Verify and commit**

```bash
cd packages/shared && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit
git add packages/shared/src/types.ts packages/shared/src/schemas.ts apps/api/src/lib/dashboard-queries.ts
git commit -m "feat: add InsightsData types, schema, and previousMonth utility"
```

---

### Task 2: Create insights API route

**Files:**
- Create: `apps/api/src/routes/insights.ts`

- [ ] **Step 1: Create insights.ts**

Create `apps/api/src/routes/insights.ts` with two endpoints:

**`GET /`** — Month-over-month comparison:
1. Validate month param with `insightsQuerySchema`, default to `currentMonth()`
2. Reject future months (`month > currentMonth()` → 400)
3. Compute `prevMonth` using `previousMonth(month)`
4. Fetch summaries and category breakdowns for both months using shared helpers from `dashboard-queries.ts`
5. Assemble summaries with `assembleSummary()`
6. Merge category breakdowns: create a map of all category IDs across both months, compute `change_pesewas` and `change_percentage`. If previous is 0 and current > 0: `direction: 'new'`, `change_percentage: 100`. If current is 0 and previous > 0: `direction: 'down'`, `change_percentage: -100`. Otherwise compute normally.
7. Cap `category_trends` to top 15 by `current_pesewas + previous_pesewas` DESC
8. Compute `top_changes`: sort by absolute `change_percentage` DESC, take top 5
9. Return `{ data: InsightsData }`

**`POST /report`** — AI monthly report:
1. Validate body with `insightsQuerySchema`, default month to current
2. Reject future months
3. Increment daily AI usage counter in KV (reuse `ai-usage:{userId}:{date}` key, same 40/day soft limit as chat)
4. Fetch insights data (same queries as GET)
5. Build report prompt with both months' summaries + category changes
6. Call Workers AI `@cf/qwen/qwen3-30b-a3b-fp8` with `{ stream: false, max_tokens: 1024 }`
7. Return `{ data: { report: response, month } }`

System prompt for report:
```
You are CediSense AI generating a monthly financial report for a Ghanaian user.
Write a concise 3-4 paragraph summary covering:
1. Overall spending vs income comparison to last month
2. Notable category changes (what went up/down significantly)
3. One specific, actionable savings tip based on the data
Use ₵ formatting. Be warm and encouraging. Reference specific numbers from the data provided.
Do not use headers or bullet points — write in flowing paragraphs.
```

Use `formatGHS()` helper (same as ai-context.ts) to format pesewas for the prompt.

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit
git add apps/api/src/routes/insights.ts
git commit -m "feat: add insights API with comparison data and AI report"
```

---

### Task 3: Mount insights route

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add import, middleware, and route**

```typescript
import { insights } from './routes/insights.js';

// Both bare path AND wildcard — GET / needs first, POST /report needs second
app.use('/api/v1/insights', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/insights/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/insights', insights);
```

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit && npx vitest run
git add apps/api/src/index.ts
git commit -m "feat: mount insights route with auth middleware"
```

---

## Chunk 2: Settings Page Rewrite

### Task 4: Settings section components

**Files:**
- Create: `apps/web/src/components/settings/ProfileSection.tsx`
- Create: `apps/web/src/components/settings/AccountsSection.tsx`
- Create: `apps/web/src/components/settings/CategoriesSection.tsx`
- Create: `apps/web/src/components/settings/RulesSection.tsx`

- [ ] **Step 1: Create ProfileSection.tsx**

Collapsible card. Display mode: name, phone (read-only badge), income. Edit mode: name input, income AmountInput. Save via `api.put('/users/me', { name, monthly_income_ghs })`. Props: `user: User, onUpdate: () => void`.

- [ ] **Step 2: Create AccountsSection.tsx**

Collapsible card. Lists accounts with type badges (MoMo=gold, Bank=ghana-green, Cash=muted, Susu=income). Expandable per-account edit (name + balance only, type/provider read-only). Add form at top with name, type dropdown, provider, balance. Delete with two-tap confirm, blocked if last account. Props: `accounts: Account[], onRefresh: () => void`.

- [ ] **Step 3: Create CategoriesSection.tsx**

Collapsible card. Filters to user-created categories (`user_id !== null`). Each row: icon + name + type badge. Inline edit: icon, name, save/delete. Add form: icon, name, type dropdown, color hex. Props: `categories: Category[], onRefresh: () => void`.

- [ ] **Step 4: Create RulesSection.tsx**

Collapsible card. Each rule: "When {field} {type} '{value}' → {category_name}". Inline edit with dropdowns + inputs. Add form with field dropdown, type dropdown, value input, category dropdown. Props: `rules: CategoryRule[], categories: Category[], onRefresh: () => void`.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/settings/
git commit -m "feat: add ProfileSection, AccountsSection, CategoriesSection, RulesSection"
```

---

### Task 5: Rewrite SettingsPage

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Rewrite SettingsPage**

Full rewrite replacing the current 32-line placeholder. On mount: parallel fetch `users/me`, `accounts`, `categories`, `category-rules`. Loading skeleton (4 pulse cards). Assemble all 4 sections + logout button at bottom. Refresh handler for each section that re-fetches relevant data.

- [ ] **Step 2: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/pages/SettingsPage.tsx
git commit -m "feat: rewrite SettingsPage with profile, accounts, categories, rules management"
```

---

## Chunk 3: Insights Frontend

### Task 6: Insights display components

**Files:**
- Create: `apps/web/src/components/insights/ComparisonCard.tsx`
- Create: `apps/web/src/components/insights/TopChangesCard.tsx`
- Create: `apps/web/src/components/insights/AIReportSection.tsx`

- [ ] **Step 1: Create ComparisonCard.tsx**

Props: `current: MonthSummary, previous: MonthSummary, currentMonth: string, previousMonth: string`

Two columns: previous (muted) vs current (white). Income, expenses, net for each. Change indicators below with direction-appropriate colors (income up = green, expense up = red, net improved = green).

- [ ] **Step 2: Create TopChangesCard.tsx**

Props: `changes: SpendingChange[]`

Ranked list of top 5. Each row: icon + name + direction arrow + percentage + amounts. Up = text-expense, Down = text-income, New = text-gold badge. Empty state if no changes.

- [ ] **Step 3: Create AIReportSection.tsx**

Props: `month: string, onGenerate: () => Promise<string>`

States: initial (button), loading (skeleton), loaded (renderMarkdown), error (retry). Gold "Generate Report" button. Rendered markdown via `renderMarkdown` from `@/lib/markdown`.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/insights/
git commit -m "feat: add ComparisonCard, TopChangesCard, AIReportSection components"
```

---

### Task 7: CategoryTrendsChart component

**Files:**
- Create: `apps/web/src/components/insights/CategoryTrendsChart.tsx`

- [ ] **Step 1: Create CategoryTrendsChart.tsx**

Props: `trends: CategoryTrend[]`

Recharts horizontal `BarChart` with grouped bars. Top 6 categories by current spending (client-side slice). Previous bar: category color at 40% opacity. Current bar: category color full. Y-axis: category names. X-axis: ₵ amounts. Tooltip with both months + change %. `ResponsiveContainer` height 300px. Use `usePrefersReducedMotion` for animation gating.

- [ ] **Step 2: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/insights/CategoryTrendsChart.tsx
git commit -m "feat: add CategoryTrendsChart with grouped bar comparison"
```

---

### Task 8: InsightsPage + App wiring

**Files:**
- Create: `apps/web/src/pages/InsightsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create InsightsPage.tsx**

Full page at `/insights`. On mount: fetch `api.get<InsightsData>('/insights?month=...')`. Reuse `MonthPicker` from dashboard. Assemble: ComparisonCard, CategoryTrendsChart, TopChangesCard, AIReportSection. AI report handler: `api.post<InsightsReport>('/insights/report', { month })`. Empty state when both months have zero transactions. Loading skeletons. Desktop: TopChanges + AIReport in 2-col grid. `pb-24` for bottom nav.

- [ ] **Step 2: Add route to App.tsx**

Add import:
```typescript
import { InsightsPage } from '@/pages/InsightsPage';
```

Add route inside the protected AppShell routes:
```tsx
<Route path="/insights" element={<InsightsPage />} />
```

- [ ] **Step 3: Add "View Insights" link to DashboardPage**

After the `RecentTransactions` component, add:
```tsx
<Link to="/insights" className="block text-center text-gold text-sm font-medium hover:text-gold/80 transition-colors mt-2">
  View Insights →
</Link>
```

Add `Link` to the react-router-dom import.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/pages/InsightsPage.tsx apps/web/src/App.tsx apps/web/src/pages/DashboardPage.tsx
git commit -m "feat: add InsightsPage, wire routing, add dashboard link"
```

---

## Chunk 4: Integration Verification

### Task 9: Full verification

- [ ] **Step 1: TypeScript check all packages**

Run: `cd packages/shared && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`

- [ ] **Step 3: Fix any issues and commit**
