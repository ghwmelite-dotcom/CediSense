# Budgets & Savings Goals — Design Spec

## Overview

Add monthly per-category budgets and simple savings goals with manual contributions. Budgets track spending against limits with visual alerts (green/amber/red). Goals track progress toward target amounts with optional deadlines. Budget status is injected into the AI advisor's financial context for proactive advice.

## Scope

**In scope:**
- Monthly per-category budgets (one budget per category per user)
- Budget CRUD + current month spending calculation via transaction queries
- Visual status indicators: on_track (<80%), warning (80-100%), exceeded (>100%)
- Savings goals with name, target, optional deadline, manual contributions
- Goals CRUD + contribute endpoint
- Budget + goals summary in AI advisor context
- Dedicated pages at `/budgets` and `/goals` (existing placeholder routes)

**Out of scope:**
- Flexible budget periods (weekly, custom)
- Budget templates / auto-generation
- Account-linked goals or auto-deduct rules
- Dashboard widgets for budgets/goals (future enhancement)
- Push notifications for budget alerts
- Budget history tracking tables (query-time from transactions instead)

## Tech Stack

- **API:** Hono on Cloudflare Workers, D1 for storage
- **Validation:** Zod schemas in `@cedisense/shared`
- **Frontend:** React 18, Tailwind CSS, existing `AmountInput` component
- **AI Integration:** Extend `ai-context.ts` with budget/goals queries

---

## Database

### Migration: `0004_budgets_goals.sql`

```sql
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category_id)
);
CREATE INDEX idx_budgets_user ON budgets(user_id);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_pesewas INTEGER NOT NULL CHECK(target_pesewas > 0),
  current_pesewas INTEGER NOT NULL DEFAULT 0 CHECK(current_pesewas >= 0),
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_savings_goals_user ON savings_goals(user_id);
```

Key decisions:
- `UNIQUE(user_id, category_id)` on budgets — one budget per category per user
- No month column — budget amount persists across months, spending is computed per month from transactions
- `current_pesewas` on goals updated via contribution endpoint, capped at `target_pesewas`
- `deadline` is nullable `YYYY-MM-DD` string

---

## API Design — Budgets

### Middleware Registration

```typescript
app.use('/api/v1/budgets/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/budgets', budgets);
app.use('/api/v1/goals/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/goals', goals);
```

### `GET /api/v1/budgets`

List all budgets with current month spending. Response wrapped in `{ data: BudgetWithSpending[] }`.

```typescript
interface BudgetWithSpending {
  id: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  amount_pesewas: number;
  spent_pesewas: number;
  percentage: number;
  status: 'on_track' | 'warning' | 'exceeded';
  remaining_pesewas: number;
}
```

**SQL:**
```sql
SELECT b.id, b.category_id, b.amount_pesewas,
       c.name as category_name, COALESCE(c.icon, '📦') as category_icon,
       COALESCE(c.color, '#888888') as category_color,
       COALESCE(s.spent, 0) as spent_pesewas
FROM budgets b
JOIN categories c ON b.category_id = c.id
LEFT JOIN (
  SELECT category_id, SUM(amount_pesewas) as spent
  FROM transactions
  WHERE user_id = ? AND type = 'debit'
    AND transaction_date >= ? AND transaction_date <= ?
  GROUP BY category_id
) s ON b.category_id = s.category_id
WHERE b.user_id = ?
ORDER BY COALESCE(s.spent, 0) * 1.0 / b.amount_pesewas DESC
```

Server computes `percentage`, `status`, and `remaining_pesewas` from the query results:
- `percentage = (spent / amount) * 100`, rounded to 1 decimal
- `status = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'on_track'`
- `remaining_pesewas = amount - spent` (can be negative)

### `POST /api/v1/budgets`

Create a budget.

**Request:**
```typescript
{ category_id: string, amount_pesewas: number }
```

**Validation:**
- `category_id` must reference an existing category (system or user-owned)
- `amount_pesewas` must be a positive integer
- No existing budget for the same `(user_id, category_id)` — return 409 CONFLICT

**Response:** `{ data: Budget }` with status 201.

### `PUT /api/v1/budgets/:id`

Update budget amount.

**Request:**
```typescript
{ amount_pesewas: number }
```

**Validation:** ownership check, positive integer.

**Response:** `{ data: Budget }`

### `DELETE /api/v1/budgets/:id`

Delete a budget. Ownership check. Returns `204 No Content`.

---

## API Design — Savings Goals

### `GET /api/v1/goals`

List all savings goals with computed progress. Response: `{ data: SavingsGoalWithProgress[] }`.

```typescript
interface SavingsGoalWithProgress {
  id: string;
  name: string;
  target_pesewas: number;
  current_pesewas: number;
  deadline: string | null;
  percentage: number;
  days_remaining: number | null;
  is_complete: boolean;
  created_at: string;
}
```

**SQL:**
```sql
SELECT id, name, target_pesewas, current_pesewas, deadline, created_at
FROM savings_goals
WHERE user_id = ?
ORDER BY
  CASE WHEN current_pesewas >= target_pesewas THEN 1 ELSE 0 END ASC,
  current_pesewas * 1.0 / target_pesewas DESC
```

Sorted: incomplete goals first (by highest percentage), completed at bottom.

Server computes:
- `percentage = Math.min((current / target) * 100, 100)`, rounded to 1 decimal
- `days_remaining`: if deadline, compute `Math.ceil((deadline_date - now) / 86400000)`, null if no deadline
- `is_complete = current_pesewas >= target_pesewas`

### `POST /api/v1/goals`

Create a savings goal.

**Request:**
```typescript
{
  name: string,            // 1-100 chars
  target_pesewas: number,  // positive integer
  deadline?: string        // optional YYYY-MM-DD, must be today or later
}
```

**Response:** `{ data: SavingsGoal }` with status 201, `current_pesewas: 0`.

### `PUT /api/v1/goals/:id`

Update goal details.

**Request:**
```typescript
{
  name?: string,
  target_pesewas?: number,
  deadline?: string | null   // null to remove deadline
}
```

**Validation:** ownership check.

**Response:** `{ data: SavingsGoal }`

### `POST /api/v1/goals/:id/contribute`

Add a contribution to a goal.

**Request:**
```typescript
{ amount_pesewas: number }  // positive integer
```

**SQL (caps at target):**
```sql
UPDATE savings_goals
SET current_pesewas = MIN(current_pesewas + ?, target_pesewas),
    updated_at = datetime('now')
WHERE id = ? AND user_id = ?
```

**Validation:** ownership check, goal must not already be complete, amount must be positive.

**Response:** `{ data: SavingsGoal }` with updated `current_pesewas`.

### `DELETE /api/v1/goals/:id`

Delete a goal. Ownership check. Returns `204 No Content`.

---

## AI Context Integration

Extend `apps/api/src/lib/ai-context.ts` to include budget and goals data. After "Recent transactions" in the financial context string, append:

```
Budgets (this month):
- Food & Groceries: ₵420/₵500 (84.0%) ⚠️
- Transport: ₵350/₵400 (87.5%) ⚠️
- Airtime & Data: ₵80/₵150 (53.3%) ✓
Total: ₵850/₵1,050 budgeted (81.0%)

Savings Goals:
- New Phone: ₵1,200/₵2,500 (48.0%) — 45 days left
- Emergency Fund: ₵3,000/₵5,000 (60.0%) — no deadline
```

Status indicators: `✓` for on_track, `⚠️` for warning, `❌` for exceeded.

This requires two additional D1 queries in `buildFinancialContext`:
1. Budget query (same as GET /budgets but without full enrichment)
2. Goals query (simple SELECT from savings_goals)

---

## Frontend Design — Budgets Page

### Page Layout

```
BudgetsPage (/budgets)
├── PageHeader          — "Budgets" title + "Add Budget" button
├── BudgetSummaryBar    — total progress bar
├── BudgetCard[]        — sorted by % used DESC
└── EmptyState / AddBudgetModal
```

### PageHeader

- "Budgets" title (text-xl font-bold text-white)
- "Add Budget" button: text-sm text-gold font-medium
- Sticky top with ghana-dark/95 backdrop-blur

### BudgetSummaryBar

- ghana-surface card, rounded-xl, p-4
- Label: "Monthly Budget" text-sm text-muted
- Total: "₵850 / ₵1,050" text-white font-semibold
- Progress bar: h-2 rounded-full, color based on aggregate percentage
- Percentage on the right: text-sm

### BudgetCard

- ghana-surface card, rounded-xl, p-4, border-white/10
- Row 1: category icon (in colored circle) + category name + status badge
  - Badge: `on_track` = "✓" green bg, `warning` = "⚠️" amber/gold bg, `exceeded` = "!" red bg
- Row 2: progress bar (h-1.5 rounded-full)
  - Color: income green (<80%), gold (80-100%), expense red (>100%)
  - Width: capped at 100% visually
- Row 3: "₵420 / ₵500" text-sm, "₵80 remaining" or "₵20 over" text-xs text-muted
- Tappable: expands to show edit amount input + delete button

### AddBudgetModal

- Overlay modal or bottom sheet on mobile
- Category dropdown: only expense-type categories without existing budgets
- Amount input: reuse `AmountInput` component
- "Save" (gold) + "Cancel" (muted) buttons
- On save: `POST /api/v1/budgets`, close modal, refresh list

### Empty State

- Centered: 📊 icon
- "Set spending limits for your categories"
- "Create your first budget" gold CTA button

---

## Frontend Design — Goals Page

### Page Layout

```
GoalsPage (/goals)
├── PageHeader          — "Savings Goals" title + "New Goal" button
├── GoalCard[]          — incomplete goals first
├── CompletedSection    — collapsible completed goals
└── EmptyState / AddGoalModal
```

### GoalCard

- ghana-surface card, rounded-xl, p-4, border-white/10
- Row 1: goal name (text-white font-medium) + deadline badge
  - Deadline: "45 days left" (text-xs text-muted) or "Overdue" (text-xs text-expense)
  - No deadline: no badge
- Row 2: progress bar (h-2 rounded-full, gold fill)
- Row 3: "₵1,200 / ₵2,500" left + "48.0%" right
- Row 4: "Contribute" button (small, gold outline: border-gold text-gold rounded-lg px-3 py-1.5)
- Tap "Contribute": inline amount input replaces the button, "Add" mini-button next to it
- Expand for edit (name, target, deadline) + delete

### CompletedSection

- Header: "Completed (2)" with chevron toggle, text-muted text-sm
- Collapsed by default
- Completed cards: muted styling (opacity-75), income green progress bar, checkmark icon
- No contribute button

### AddGoalModal

- Name text input (1-100 chars)
- Target amount: `AmountInput` component
- Deadline: HTML date input, min=today, optional
- "Save" + "Cancel" buttons

### Contribute Flow

1. Tap "Contribute" on goal card
2. Button replaced by inline: `AmountInput` (compact) + "Add" button
3. Submit → `POST /api/v1/goals/:id/contribute`
4. Optimistic update: progress bar and amounts update
5. If goal reaches target: brief celebration (checkmark + "Goal reached!" for 2 seconds, then card moves to completed)
6. Cancel: tap outside or press Escape to dismiss input

### Empty State

- Centered: 🎯 icon
- "Start saving towards your goals"
- "Create your first goal" gold CTA button

---

## Styling

### Colors

| Element | Color | Token |
|---------|-------|-------|
| Progress on_track | #4ADE80 | income |
| Progress warning | #D4A843 | gold |
| Progress exceeded | #F87171 | expense |
| Goal progress | #D4A843 | gold |
| Goal complete | #4ADE80 | income |
| Status badge on_track | income/20 bg | — |
| Status badge warning | gold/20 bg | — |
| Status badge exceeded | expense/20 bg | — |
| Overdue text | #F87171 | text-expense |

### Spacing

- Card gap: 16px (gap-4)
- Card padding: 16px (p-4)
- Card border-radius: 12px (rounded-xl)
- Progress bar height: h-1.5 (budgets), h-2 (goals)

---

## Types (additions to packages/shared/src/types.ts)

```typescript
export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount_pesewas: number;
  created_at: string;
  updated_at: string;
}

export type BudgetStatus = 'on_track' | 'warning' | 'exceeded';

export interface BudgetWithSpending extends Budget {
  category_name: string;
  category_icon: string;
  category_color: string;
  spent_pesewas: number;
  percentage: number;
  status: BudgetStatus;
  remaining_pesewas: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_pesewas: number;
  current_pesewas: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalWithProgress extends SavingsGoal {
  percentage: number;
  days_remaining: number | null;
  is_complete: boolean;
}
```

## Validation (additions to packages/shared/src/schemas.ts)

```typescript
export const createBudgetSchema = z.object({
  category_id: z.string().min(1),
  amount_pesewas: z.number().int().positive(),
});

export const updateBudgetSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_pesewas: z.number().int().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_pesewas: z.number().int().positive().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const contributeSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});
```

---

## File Structure

### New Files
- `apps/api/migrations/0004_budgets_goals.sql`
- `apps/api/src/routes/budgets.ts`
- `apps/api/src/routes/goals.ts`
- `apps/web/src/pages/BudgetsPage.tsx`
- `apps/web/src/pages/GoalsPage.tsx`
- `apps/web/src/components/budgets/BudgetCard.tsx`
- `apps/web/src/components/budgets/BudgetSummaryBar.tsx`
- `apps/web/src/components/budgets/AddBudgetModal.tsx`
- `apps/web/src/components/goals/GoalCard.tsx`
- `apps/web/src/components/goals/AddGoalModal.tsx`
- `apps/web/src/components/goals/CompletedSection.tsx`

### Modified Files
- `packages/shared/src/types.ts` — Add Budget, SavingsGoal types
- `packages/shared/src/schemas.ts` — Add budget/goal validation schemas
- `apps/api/src/index.ts` — Mount budgets and goals routes
- `apps/api/src/lib/ai-context.ts` — Add budget/goals to financial context
- `apps/web/src/App.tsx` — Replace budget/goals placeholders with real pages
