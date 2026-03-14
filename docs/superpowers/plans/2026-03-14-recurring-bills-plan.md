# Recurring Transaction Detection & Bill Reminders Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect recurring transactions from spending history, let users confirm/dismiss candidates, and show upcoming bill reminders on the dashboard.

**Architecture:** Pure TypeScript detection algorithm (no AI), two D1 tables (recurring_transactions + recurring_candidates), on-demand scan endpoint, candidate review flow, dashboard upcoming bills card. Detection is a testable pure function.

**Tech Stack:** Hono, D1, React 18, Tailwind CSS, TypeScript strict, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-recurring-bills-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/migrations/0005_recurring.sql` | D1 migration |
| `apps/api/src/lib/recurring-detection.ts` | Detection algorithm + computeNextDueDate (pure, testable) |
| `apps/api/src/lib/recurring-detection.test.ts` | Algorithm tests |
| `apps/api/src/routes/recurring.ts` | All recurring/candidate endpoints |
| `apps/web/src/components/recurring/CandidateCard.tsx` | Candidate confirm/dismiss card |
| `apps/web/src/components/recurring/RecurringCard.tsx` | Confirmed recurring item with status |
| `apps/web/src/components/recurring/UpcomingBillsCard.tsx` | Dashboard card for upcoming bills |
| `apps/web/src/pages/RecurringPage.tsx` | Full recurring management page |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add RecurringTransaction, RecurringCandidate, etc. |
| `packages/shared/src/schemas.ts` | Add confirmCandidateSchema, updateRecurringSchema |
| `apps/api/src/index.ts` | Mount recurring route |
| `apps/web/src/pages/DashboardPage.tsx` | Add UpcomingBillsCard |
| `apps/web/src/App.tsx` | Add `/recurring` route |

---

## Chunk 1: Shared Types, Migration, Detection Algorithm

### Task 1: Add shared types and schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add recurring types**

Append to `packages/shared/src/types.ts`:

```typescript
// ─── Recurring types ──────────────────────────────────────────────────────────

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly';
export type RecurringStatus = 'upcoming' | 'due_soon' | 'overdue';

export interface RecurringTransaction {
  id: string;
  user_id: string;
  counterparty: string;
  category_id: string | null;
  expected_amount_pesewas: number;
  amount_tolerance_percent: number;
  frequency: RecurringFrequency;
  next_due_date: string;
  reminder_days_before: number;
  is_active: boolean;
  last_detected_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringWithStatus extends RecurringTransaction {
  category_name: string | null;
  category_icon: string | null;
  days_until_due: number;
  status: RecurringStatus;
}

export interface RecurringCandidate {
  id: string;
  counterparty: string;
  category_id: string | null;
  avg_amount_pesewas: number;
  frequency: RecurringFrequency;
  occurrence_count: number;
  last_occurrence_date: string;
}
```

- [ ] **Step 2: Add schemas**

Append to `packages/shared/src/schemas.ts`:

```typescript
// ─── Recurring schemas ────────────────────────────────────────────────────────

export const confirmCandidateSchema = z.object({
  reminder_days_before: z.number().int().min(0).max(14).default(3),
});

export const updateRecurringSchema = z.object({
  expected_amount_pesewas: z.number().int().positive().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  reminder_days_before: z.number().int().min(0).max(14).optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => new Date(d + 'T00:00:00') >= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00'),
    'Due date must be today or later'
  ).optional(),
  is_active: z.boolean().optional(),
});

export type ConfirmCandidateInput = z.infer<typeof confirmCandidateSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
```

- [ ] **Step 3: Verify and commit**

```bash
cd packages/shared && npx tsc --noEmit
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add RecurringTransaction types and schemas"
```

---

### Task 2: Create D1 migration

**Files:**
- Create: `apps/api/migrations/0005_recurring.sql`

- [ ] **Step 1: Create migration** (exact SQL from spec)

- [ ] **Step 2: Commit**

```bash
git add apps/api/migrations/0005_recurring.sql
git commit -m "feat: add recurring_transactions and recurring_candidates D1 migration"
```

---

### Task 3: Create detection algorithm + tests

**Files:**
- Create: `apps/api/src/lib/recurring-detection.ts`
- Create: `apps/api/src/lib/recurring-detection.test.ts`

- [ ] **Step 1: Create recurring-detection.ts**

Export three pure functions:

**`detectRecurringPatterns(transactions, confirmedCounterparties, dismissedCounterparties)`**
- Input: array of `{ counterparty, amount_pesewas, category_id, transaction_date }`, two `Set<string>` of lowercase counterparties to skip
- Group by `counterparty.toLowerCase().trim()`
- For each group with 2+ items: compute avg amount, filter within 20% tolerance, compute intervals, find median, classify frequency (5-9=weekly, 12-16=biweekly, 25-35=monthly), get most common category_id
- Skip already-known counterparties
- Return `DetectedCandidate[]`

**`computeNextDueDate(lastDate, frequency)`**
- Forward-roll past today: `while (d <= today) advance(d, frequency)`
- Return YYYY-MM-DD

**`classifyFrequency(medianDays)`**
- Helper: returns frequency or null if irregular

- [ ] **Step 2: Create recurring-detection.test.ts**

Test cases:
- Monthly pattern: 3 transactions ~30 days apart → detected as monthly
- Weekly pattern: 4 transactions ~7 days apart → detected as weekly
- Irregular pattern: random intervals → not detected
- Amount outlier: one transaction far from average → filtered out, rest detected
- Skips confirmed counterparties
- Skips dismissed counterparties
- computeNextDueDate forward-rolls past today
- computeNextDueDate with monthly frequency
- classifyFrequency edge cases (5, 9, 12, 16, 25, 35 days)
- Group with only 1 transaction → not detected

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx vitest run src/lib/recurring-detection.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/recurring-detection.ts apps/api/src/lib/recurring-detection.test.ts
git commit -m "feat: add recurring detection algorithm with tests"
```

---

## Chunk 2: API Route + Mounting

### Task 4: Create recurring API route

**Files:**
- Create: `apps/api/src/routes/recurring.ts`

- [ ] **Step 1: Create recurring.ts**

Endpoints:
- `POST /scan` — fetch 6 months of debits, fetch confirmed/dismissed counterparties, run `detectRecurringPatterns`, upsert candidates with `ON CONFLICT ... DO UPDATE ... WHERE dismissed = 0`, return non-dismissed candidates
- `GET /candidates` — list undismissed, sorted by occurrence_count DESC
- `POST /candidates/:id/confirm` — validate with `confirmCandidateSchema`, fetch candidate + ownership check, `computeNextDueDate`, INSERT recurring_transaction, DELETE candidate, return created
- `POST /candidates/:id/dismiss` — set `dismissed = 1`, return 204
- `GET /` — list confirmed with category JOIN, compute `days_until_due` and `status` server-side. Status order: overdue (< 0), due_soon (>= 0 && <= reminder_days), upcoming (> reminder_days)
- `PUT /:id` — validate with `updateRecurringSchema`, ownership check, explicit SET clauses + `updated_at`
- `DELETE /:id` — ownership check, 204
- `GET /upcoming` — active only, sorted by next_due_date ASC, LIMIT from query param (default 5)

Six months ago date: `new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)`

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit
git add apps/api/src/routes/recurring.ts
git commit -m "feat: add recurring API route with scan, confirm, dismiss endpoints"
```

---

### Task 5: Mount recurring route

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Mount route**

Add import, bare+wildcard middleware, route mount (same pattern as budgets/goals).

- [ ] **Step 2: Verify and commit**

```bash
cd apps/api && npx tsc --noEmit && npx vitest run
git add apps/api/src/index.ts
git commit -m "feat: mount recurring route with auth middleware"
```

---

## Chunk 3: Frontend Components + Page

### Task 6: CandidateCard + RecurringCard + UpcomingBillsCard

**Files:**
- Create: `apps/web/src/components/recurring/CandidateCard.tsx`
- Create: `apps/web/src/components/recurring/RecurringCard.tsx`
- Create: `apps/web/src/components/recurring/UpcomingBillsCard.tsx`

- [ ] **Step 1: Create CandidateCard.tsx**

Props: `candidate: RecurringCandidate, onConfirm: (id) => void, onDismiss: (id) => void`

Counterparty + frequency badge + "~₵200/month" + "Seen N times" + Confirm gold button + Dismiss muted button.

- [ ] **Step 2: Create RecurringCard.tsx**

Props: `item: RecurringWithStatus, onUpdate: (id, data) => void, onDelete: (id) => void`

Counterparty + category icon + frequency badge + expected amount + status badge (overdue=expense, due_soon=gold, upcoming=muted). Expandable edit: amount, frequency, reminder_days, next_due_date, is_active toggle, delete.

- [ ] **Step 3: Create UpcomingBillsCard.tsx**

Props: `items: RecurringWithStatus[]`

Dashboard card: "Upcoming Bills" header. Compact rows: counterparty + amount + status badge. "View all →" link to `/recurring`. Only renders if items.length > 0.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/recurring/
git commit -m "feat: add CandidateCard, RecurringCard, UpcomingBillsCard components"
```

---

### Task 7: RecurringPage + App wiring + Dashboard integration

**Files:**
- Create: `apps/web/src/pages/RecurringPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create RecurringPage.tsx**

Full page at `/recurring`:
- On mount: parallel fetch `GET /recurring` + `GET /recurring/candidates`
- "Scan for Patterns" button → `POST /recurring/scan` → refresh candidates
- CandidatesSection (gold banner, CandidateCard list) — only when candidates exist
- ActiveSection: RecurringCard list for `is_active` items
- InactiveSection: collapsible, muted, for `!is_active` items
- Empty state: calendar icon + "Scan Now" button
- Handle confirm, dismiss, update, delete with refresh
- pb-24, loading skeletons

- [ ] **Step 2: Add route to App.tsx**

```tsx
import { RecurringPage } from '@/pages/RecurringPage';
// Add inside protected routes:
<Route path="/recurring" element={<RecurringPage />} />
```

- [ ] **Step 3: Add UpcomingBillsCard to DashboardPage**

Import `UpcomingBillsCard` and `RecurringWithStatus`. Fetch `api.get<RecurringWithStatus[]>('/recurring/upcoming?limit=5')` alongside existing dashboard fetch. Render between CategoryBreakdownCard and RecentTransactions (only if items exist).

- [ ] **Step 4: Verify and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/pages/RecurringPage.tsx apps/web/src/App.tsx apps/web/src/pages/DashboardPage.tsx
git commit -m "feat: add RecurringPage, wire routing, add dashboard upcoming bills"
```

---

## Chunk 4: Integration Verification

### Task 8: Full verification

- [ ] **Step 1: TypeScript check all packages**

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`

- [ ] **Step 3: Fix issues and commit**

- [ ] **Step 4: Push to GitHub**

Run: `git push origin master`
