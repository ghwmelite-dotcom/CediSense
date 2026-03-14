# Budgets & Savings Goals Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monthly per-category budgets with spending tracking, savings goals with manual contributions, and inject budget/goals data into the AI advisor's financial context.

**Architecture:** Two new D1 tables (budgets, savings_goals), two API route files with CRUD endpoints, budget spending computed from existing transaction data via subquery joins, AI context extended with budget/goals summary. Two new frontend pages replacing existing placeholders.

**Tech Stack:** Hono, Cloudflare D1, React 18, Tailwind CSS, TypeScript strict, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-budgets-goals-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/migrations/0004_budgets_goals.sql` | D1 migration for budgets + savings_goals tables |
| `apps/api/src/routes/budgets.ts` | Budget CRUD with spending computation |
| `apps/api/src/routes/goals.ts` | Goals CRUD + contribute endpoint |
| `apps/web/src/components/budgets/BudgetCard.tsx` | Single budget with progress bar + edit/delete |
| `apps/web/src/components/budgets/BudgetSummaryBar.tsx` | Aggregate budget progress |
| `apps/web/src/components/budgets/AddBudgetModal.tsx` | Category picker + amount input modal |
| `apps/web/src/components/goals/GoalCard.tsx` | Single goal with progress + contribute |
| `apps/web/src/components/goals/AddGoalModal.tsx` | Name + target + deadline modal |
| `apps/web/src/components/goals/CompletedSection.tsx` | Collapsible completed goals |
| `apps/web/src/pages/BudgetsPage.tsx` | Full budgets page |
| `apps/web/src/pages/GoalsPage.tsx` | Full goals page |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add Budget, SavingsGoal, BudgetWithSpending, SavingsGoalWithProgress types |
| `packages/shared/src/schemas.ts` | Add budget/goal validation schemas + inferred types |
| `apps/api/src/index.ts` | Mount budgets and goals routes |
| `apps/api/src/lib/ai-context.ts` | Add budget/goals to financial context |
| `apps/web/src/App.tsx` | Replace budget/goals placeholders |

---

## Chunk 1: Shared Types, Migration, API Routes

### Task 1: Add shared types and schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add budget and goal types**

Append to `packages/shared/src/types.ts`:

```typescript
// ─── Budget types ─────────────────────────────────────────────────────────────

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

// ─── Savings Goal types ───────────────────────────────────────────────────────

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

- [ ] **Step 2: Add validation schemas**

Append to `packages/shared/src/schemas.ts`:

```typescript
// ─── Budget schemas ───────────────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  category_id: z.string().min(1),
  amount_pesewas: z.number().int().positive(),
});

export const updateBudgetSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});

// ─── Goal schemas ─────────────────────────────────────────────────────────────

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_pesewas: z.number().int().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00'),
    'Deadline must be today or later'
  ).optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_pesewas: z.number().int().positive().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const contributeSchema = z.object({
  amount_pesewas: z.number().int().positive(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
```

- [ ] **Step 3: Verify and commit**

```bash
cd packages/shared && npx tsc --noEmit
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add Budget and SavingsGoal types and schemas"
```

---

### Task 2: Create D1 migration

**Files:**
- Create: `apps/api/migrations/0004_budgets_goals.sql`

- [ ] **Step 1: Create migration**

```sql
-- Budgets: monthly per-category spending limits
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

-- Savings goals with manual contributions
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

- [ ] **Step 2: Commit**

```bash
git add apps/api/migrations/0004_budgets_goals.sql
git commit -m "feat: add budgets and savings_goals D1 migration"
```

---

### Task 3: Create budgets API route

**Files:**
- Create: `apps/api/src/routes/budgets.ts`

- [ ] **Step 1: Create budgets.ts**

Create `apps/api/src/routes/budgets.ts` with:
- `GET /` — list budgets with current month spending via subquery JOIN. Bind order: `[userId, startDate, endDate, userId]`. Compute `percentage`, `status`, `remaining_pesewas` server-side.
- `POST /` — create budget. Validate category exists (`WHERE id = ? AND (user_id IS NULL OR user_id = ?) AND type = 'expense'`). Check no duplicate `(user_id, category_id)` — return 409 CONFLICT.
- `PUT /:id` — update amount. Ownership check. Set `updated_at = datetime('now')`.
- `DELETE /:id` — delete. Ownership check. Return 204.

Use `currentMonth()` and `lastDayOfMonth()` from `../lib/dashboard-queries.js` for date range.

Import patterns match existing routes: `Hono`, `Env`, `Variables`, `generateId`, Zod schemas from `@cedisense/shared`.

The GET query:
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

Server-side enrichment after query:
```typescript
const enriched = rows.map(row => {
  const spent = row.spent_pesewas as number;
  const amount = row.amount_pesewas as number;
  const percentage = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
  const status = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'on_track';
  return { ...row, percentage, status, remaining_pesewas: amount - spent };
});
```

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit
git add apps/api/src/routes/budgets.ts
git commit -m "feat: add budgets API route with spending computation"
```

---

### Task 4: Create goals API route

**Files:**
- Create: `apps/api/src/routes/goals.ts`

- [ ] **Step 1: Create goals.ts**

Create `apps/api/src/routes/goals.ts` with:
- `GET /` — list goals using this SQL:
  ```sql
  SELECT id, name, target_pesewas, current_pesewas, deadline, created_at
  FROM savings_goals
  WHERE user_id = ?
  ORDER BY
    CASE WHEN current_pesewas >= target_pesewas THEN 1 ELSE 0 END ASC,
    current_pesewas * 1.0 / target_pesewas DESC
  ```
  Compute `percentage` (capped at 100), `days_remaining` (negative = overdue, null if no deadline), `is_complete`.
- `POST /` — create goal. Validate name, target, optional deadline.
- `PUT /:id` — update name/target/deadline. Ownership check. Set `updated_at`.
- `POST /:id/contribute` — add contribution. SQL: `SET current_pesewas = MIN(current_pesewas + ?, target_pesewas), updated_at = datetime('now')`. No pre-check for completeness (idempotent via MIN cap).
- `DELETE /:id` — delete. Ownership check. Return 204.

Server-side enrichment for GET:
```typescript
const enriched = rows.map(row => {
  const percentage = Math.min(
    Math.round((row.current_pesewas / row.target_pesewas) * 1000) / 10,
    100
  );
  let daysRemaining: number | null = null;
  if (row.deadline) {
    const deadlineDate = new Date(row.deadline + 'T23:59:59');
    daysRemaining = Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000);
  }
  return {
    ...row,
    percentage,
    days_remaining: daysRemaining,
    is_complete: row.current_pesewas >= row.target_pesewas,
  };
});
```

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit
git add apps/api/src/routes/goals.ts
git commit -m "feat: add savings goals API route with contribute endpoint"
```

---

### Task 5: Mount routes + update AI context

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/lib/ai-context.ts`

- [ ] **Step 1: Mount routes in index.ts**

Add imports:
```typescript
import { budgets } from './routes/budgets.js';
import { goals } from './routes/goals.js';
```

Add middleware (bare path + wildcard per spec):
```typescript
app.use('/api/v1/budgets', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/budgets/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals/*', authMiddleware, rateLimitMiddleware);
```

Add route mounts:
```typescript
app.route('/api/v1/budgets', budgets);
app.route('/api/v1/goals', goals);
```

- [ ] **Step 2: Update ai-context.ts**

In `buildFinancialContext`, update the `Promise.all` destructuring from:
```typescript
const [accounts, summaryRows, categories, recentTxns] = await Promise.all([...]);
```
To:
```typescript
const [accounts, summaryRows, categories, recentTxns, budgetResult, goalResult] = await Promise.all([...]);
```

Add these two queries to the end of the `Promise.all` array:

```typescript
// Budget data for AI context
db.prepare(
  `SELECT b.amount_pesewas, c.name as category_name, COALESCE(s.spent, 0) as spent_pesewas
   FROM budgets b
   JOIN categories c ON b.category_id = c.id
   LEFT JOIN (
     SELECT category_id, SUM(amount_pesewas) as spent
     FROM transactions WHERE user_id = ? AND type = 'debit'
       AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY category_id
   ) s ON b.category_id = s.category_id
   WHERE b.user_id = ?
   ORDER BY COALESCE(s.spent, 0) * 1.0 / b.amount_pesewas DESC`
).bind(userId, startDate, endDate, userId).all(),

// Goals data for AI context
db.prepare(
  'SELECT name, target_pesewas, current_pesewas, deadline FROM savings_goals WHERE user_id = ? ORDER BY current_pesewas * 1.0 / target_pesewas DESC'
).bind(userId).all(),
```

Extract rows from D1 results:
```typescript
const budgetRows = (budgetResult.results ?? []) as Array<{ amount_pesewas: number; category_name: string; spent_pesewas: number }>;
const goalRows = (goalResult.results ?? []) as Array<{ name: string; target_pesewas: number; current_pesewas: number; deadline: string | null }>;
```

After the "Recent transactions" section, append budget and goals context:

```typescript
// Budget context
if (budgetRows.length > 0) {
  lines.push('');
  lines.push('Budgets (this month):');
  let totalBudgeted = 0;
  let totalBudgetSpent = 0;
  for (const b of budgetRows) {
    const spent = b.spent_pesewas as number;
    const amount = b.amount_pesewas as number;
    const pct = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const indicator = pct >= 100 ? '❌' : pct >= 80 ? '⚠️' : '✓';
    lines.push(`- ${b.category_name}: ${formatGHS(spent)}/${formatGHS(amount)} (${pct.toFixed(1)}%) ${indicator}`);
    totalBudgeted += amount;
    totalBudgetSpent += spent;
  }
  const totalPct = totalBudgeted > 0 ? Math.round((totalBudgetSpent / totalBudgeted) * 1000) / 10 : 0;
  lines.push(`Total: ${formatGHS(totalBudgetSpent)}/${formatGHS(totalBudgeted)} budgeted (${totalPct.toFixed(1)}%)`);
}

// Goals context
if (goalRows.length > 0) {
  lines.push('');
  lines.push('Savings Goals:');
  for (const g of goalRows) {
    const pct = Math.min(Math.round((g.current_pesewas as number / (g.target_pesewas as number)) * 1000) / 10, 100);
    let deadlineStr = 'no deadline';
    if (g.deadline) {
      const days = Math.ceil((new Date(g.deadline + 'T23:59:59').getTime() - Date.now()) / 86400000);
      deadlineStr = days < 0 ? 'overdue' : `${days} days left`;
    }
    lines.push(`- ${g.name}: ${formatGHS(g.current_pesewas as number)}/${formatGHS(g.target_pesewas as number)} (${pct.toFixed(1)}%) — ${deadlineStr}`);
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit && npx vitest run
git add apps/api/src/index.ts apps/api/src/lib/ai-context.ts
git commit -m "feat: mount budget/goal routes, add to AI context"
```

---

## Chunk 2: Frontend — Budget Components + Page

### Task 6: BudgetCard and BudgetSummaryBar

**Files:**
- Create: `apps/web/src/components/budgets/BudgetCard.tsx`
- Create: `apps/web/src/components/budgets/BudgetSummaryBar.tsx`

- [ ] **Step 1: Create BudgetCard.tsx**

Props: `budget: BudgetWithSpending`, `onUpdate: (id, amount) => void`, `onDelete: (id) => void`

Features:
- Category icon in colored circle + name + status badge
- Progress bar: income green (<80%), gold (80-100%), expense red (>100%), width capped at 100%
- "₵420 / ₵500" + "₵80 remaining" or "₵20 over"
- Expandable: amount input (reuse AmountInput) + delete button
- Status badge: `on_track` green, `warning` gold, `exceeded` red

- [ ] **Step 2: Create BudgetSummaryBar.tsx**

Props: `budgets: BudgetWithSpending[]`

Features:
- Compute aggregate: total budgeted, total spent
- "Monthly Budget" label + "₵850 / ₵1,050"
- Single progress bar with aggregate percentage coloring
- Percentage text on right

- [ ] **Step 3: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/budgets/BudgetCard.tsx apps/web/src/components/budgets/BudgetSummaryBar.tsx
git commit -m "feat: add BudgetCard and BudgetSummaryBar components"
```

---

### Task 7: AddBudgetModal + BudgetsPage

**Files:**
- Create: `apps/web/src/components/budgets/AddBudgetModal.tsx`
- Create: `apps/web/src/pages/BudgetsPage.tsx`

- [ ] **Step 1: Create AddBudgetModal.tsx**

Props: `open: boolean`, `onClose: () => void`, `onSave: (categoryId, amount) => void`, `categories: Category[]`, `existingBudgetCategoryIds: string[]`

Features:
- Category dropdown filtered to expense-type categories without existing budgets
- AmountInput for the monthly limit
- Save (gold) + Cancel buttons
- Validates selection + amount > 0

- [ ] **Step 2: Create BudgetsPage.tsx**

Full page at `/budgets`:
- Fetch budgets via `api.get<BudgetWithSpending[]>('/budgets')` on mount
- Fetch categories via `api.get<Category[]>('/categories')` for modal
- PageHeader: "Budgets" + "Add Budget" button
- BudgetSummaryBar (aggregate)
- BudgetCard list sorted by percentage DESC
- Empty state when no budgets
- AddBudgetModal triggered by header button
- Handle create (POST), update (PUT), delete (DELETE) with optimistic refresh

- [ ] **Step 3: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/budgets/AddBudgetModal.tsx apps/web/src/pages/BudgetsPage.tsx
git commit -m "feat: add AddBudgetModal and BudgetsPage"
```

---

## Chunk 3: Frontend — Goal Components + Page

### Task 8: GoalCard, AddGoalModal, CompletedSection

**Files:**
- Create: `apps/web/src/components/goals/GoalCard.tsx`
- Create: `apps/web/src/components/goals/AddGoalModal.tsx`
- Create: `apps/web/src/components/goals/CompletedSection.tsx`

- [ ] **Step 1: Create GoalCard.tsx**

Props: `goal: SavingsGoalWithProgress`, `onContribute: (id, amount) => void`, `onUpdate: (id, data) => void`, `onDelete: (id) => void`

Features:
- Name + deadline badge ("45 days left" / "Overdue" in text-expense / no badge)
- Gold progress bar (h-2)
- "₵1,200 / ₵2,500" + "48.0%"
- "Contribute" button → inline AmountInput + "Add" button
- Expandable edit: name, target, deadline + delete

- [ ] **Step 2: Create AddGoalModal.tsx**

Props: `open: boolean`, `onClose: () => void`, `onSave: (name, target, deadline?) => void`

Features:
- Name text input
- AmountInput for target
- Date input for optional deadline (min=today)
- Save + Cancel buttons

- [ ] **Step 3: Create CompletedSection.tsx**

Props: `goals: SavingsGoalWithProgress[]`

Features:
- Collapsible header: "Completed (N)" with chevron
- Collapsed by default
- Completed goal cards with muted styling (opacity-75), income green bar, checkmark
- No contribute button

- [ ] **Step 4: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/goals/GoalCard.tsx apps/web/src/components/goals/AddGoalModal.tsx apps/web/src/components/goals/CompletedSection.tsx
git commit -m "feat: add GoalCard, AddGoalModal, CompletedSection components"
```

---

### Task 9: GoalsPage

**Files:**
- Create: `apps/web/src/pages/GoalsPage.tsx`

- [ ] **Step 1: Create GoalsPage.tsx**

Full page at `/goals`:
- Fetch goals via `api.get<SavingsGoalWithProgress[]>('/goals')` on mount
- PageHeader: "Savings Goals" + "New Goal" button
- Split goals into incomplete and completed
- GoalCard list for incomplete goals
- CompletedSection for completed goals
- Empty state when no goals
- AddGoalModal triggered by header button
- Handle create (POST), contribute (POST /:id/contribute), update (PUT), delete (DELETE)
- On contribute reaching target: brief "Goal reached!" celebration (2s)

- [ ] **Step 2: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/pages/GoalsPage.tsx
git commit -m "feat: add GoalsPage with contribute and goal management"
```

---

## Chunk 4: App Wiring + Integration

### Task 10: Wire pages into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add imports and replace placeholders**

Add imports:
```typescript
import { BudgetsPage } from '@/pages/BudgetsPage';
import { GoalsPage } from '@/pages/GoalsPage';
```

Replace:
```tsx
<Route path="/budgets" element={<Placeholder name="Budgets" />} />
<Route path="/goals" element={<Placeholder name="Goals" />} />
```
With:
```tsx
<Route path="/budgets" element={<BudgetsPage />} />
<Route path="/goals" element={<GoalsPage />} />
```

- [ ] **Step 2: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/App.tsx
git commit -m "feat: wire BudgetsPage and GoalsPage into app routing"
```

---

### Task 11: Integration verification

- [ ] **Step 1: TypeScript check all packages**

Run: `cd packages/shared && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Fix any issues and commit**
