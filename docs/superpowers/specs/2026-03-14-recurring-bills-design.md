# Recurring Transaction Detection & Bill Reminders — Design Spec

## Overview

Detect recurring transactions from spending history using flexible pattern matching, let users confirm/dismiss candidates, and show upcoming bill reminders on the dashboard. Confirmed recurring items track due dates and surface "due soon" / "overdue" indicators.

## Scope

**In scope:**
- On-demand scan algorithm: group by counterparty, compute intervals, classify frequency
- Flexible matching: case-insensitive counterparty, 20% amount tolerance, 2+ occurrences
- Candidate review flow: confirm or dismiss detected patterns
- Confirmed recurring transactions with frequency, expected amount, next due date
- Reminder configuration (days before due)
- Active/inactive toggle for pausing
- Dashboard "Upcoming Bills" card
- Dedicated `/recurring` management page

**Out of scope:**
- Background/scheduled scanning (scan is user-triggered only)
- Push notifications for due dates
- Auto-matching new transactions to recurring entries
- Linking recurring items to specific accounts

## Tech Stack

- **API:** Hono on Cloudflare Workers, D1
- **Detection:** Pure TypeScript algorithm, no AI
- **Frontend:** React 18, Tailwind CSS
- **Validation:** Zod schemas in `@cedisense/shared`

---

## Database

### Migration: `0005_recurring.sql`

```sql
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  expected_amount_pesewas INTEGER NOT NULL,
  amount_tolerance_percent INTEGER NOT NULL DEFAULT 20,
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'biweekly', 'monthly')),
  next_due_date TEXT NOT NULL,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_detected_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recurring_user ON recurring_transactions(user_id, is_active);

CREATE TABLE IF NOT EXISTS recurring_candidates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty TEXT NOT NULL,
  category_id TEXT,
  avg_amount_pesewas INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'biweekly', 'monthly')),
  occurrence_count INTEGER NOT NULL,
  last_occurrence_date TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_candidates_user ON recurring_candidates(user_id, dismissed);
```

Key decisions:
- `recurring_transactions`: confirmed items with reminder config, `is_active` toggle
- `recurring_candidates`: detected patterns awaiting user review, `dismissed` prevents reappearance
- `next_due_date`: computed from `last_occurrence_date` + `frequency` at confirmation time
- `amount_tolerance_percent`: stored per-item (default 20%), allows per-entry tuning later
- `category_id` on both tables: nullable, SET NULL on category delete

---

## Detection Algorithm

Pure function `detectRecurringPatterns(transactions, existingCounterparties, dismissedCounterparties)`:

**Input:** All debit transactions for the last 6 months, sets of already-confirmed and dismissed counterparties.

**Steps:**
1. Group transactions by `counterparty` (case-insensitive, trimmed)
2. For each group with 2+ transactions:
   a. Compute average amount across all transactions in the group
   b. Filter to transactions within 20% of the average (remove outliers)
   c. If filtered count < 2, skip
   d. Sort filtered transactions by date ASC
   e. Compute intervals (days) between consecutive transactions
   f. Compute median interval
   g. Classify frequency:
      - 5–9 days → `weekly`
      - 12–16 days → `biweekly`
      - 25–35 days → `monthly`
      - Outside all ranges → skip (irregular)
   h. Get the most common `category_id` from the group
3. Skip counterparties in `existingCounterparties` or `dismissedCounterparties` (case-insensitive)
4. Return array of `DetectedCandidate`

```typescript
interface DetectedCandidate {
  counterparty: string;
  category_id: string | null;
  avg_amount_pesewas: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  occurrence_count: number;
  last_occurrence_date: string;
}
```

**Next due date computation** (used when confirming a candidate):
```typescript
function computeNextDueDate(lastDate: string, frequency: string): string {
  const d = new Date(lastDate + 'T00:00:00');
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}
```

File: `apps/api/src/lib/recurring-detection.ts` — exported pure functions, fully testable.

---

## API Design

### Middleware Registration

```typescript
// Both bare path and wildcard required
app.use('/api/v1/recurring', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/recurring/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/recurring', recurring);
```

### `POST /api/v1/recurring/scan`

Trigger detection and return new candidates.

**Response:** `{ data: RecurringCandidate[] }`

Server flow:
1. Fetch debit transactions for last 6 months: `WHERE user_id = ? AND type = 'debit' AND transaction_date >= ?`
2. Fetch confirmed counterparties: `SELECT LOWER(counterparty) FROM recurring_transactions WHERE user_id = ?`
3. Fetch dismissed counterparties: `SELECT LOWER(counterparty) FROM recurring_candidates WHERE user_id = ? AND dismissed = 1`
4. Run `detectRecurringPatterns(transactions, confirmed, dismissed)`
5. Upsert candidates: for each detected, INSERT OR REPLACE into `recurring_candidates` (match on `user_id + LOWER(counterparty)`)
6. Return all non-dismissed candidates

### `GET /api/v1/recurring/candidates`

List undismissed candidates.

**Response:** `{ data: RecurringCandidate[] }` sorted by `occurrence_count` DESC.

```sql
SELECT id, counterparty, category_id, avg_amount_pesewas, frequency,
       occurrence_count, last_occurrence_date
FROM recurring_candidates
WHERE user_id = ? AND dismissed = 0
ORDER BY occurrence_count DESC
```

### `POST /api/v1/recurring/candidates/:id/confirm`

Confirm a candidate as recurring.

**Request:**
```typescript
{ reminder_days_before?: number }  // default 3, range 0-14
```

Server flow:
1. Fetch candidate by ID + ownership check
2. Compute `next_due_date` from `last_occurrence_date` + `frequency`
3. INSERT into `recurring_transactions`
4. DELETE the candidate
5. Return created recurring transaction

### `POST /api/v1/recurring/candidates/:id/dismiss`

Dismiss a candidate. Sets `dismissed = 1`. Returns `204`.

### `GET /api/v1/recurring`

List confirmed recurring transactions with computed due status.

**Response:** `{ data: RecurringWithStatus[] }`

```typescript
interface RecurringWithStatus {
  id: string;
  counterparty: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  expected_amount_pesewas: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  next_due_date: string;
  reminder_days_before: number;
  days_until_due: number;
  status: 'upcoming' | 'due_soon' | 'overdue';
  is_active: boolean;
}
```

**SQL:**
```sql
SELECT r.id, r.counterparty, r.category_id, r.expected_amount_pesewas,
       r.frequency, r.next_due_date, r.reminder_days_before, r.is_active,
       c.name as category_name, COALESCE(c.icon, '📦') as category_icon
FROM recurring_transactions r
LEFT JOIN categories c ON r.category_id = c.id
WHERE r.user_id = ?
ORDER BY r.is_active DESC, r.next_due_date ASC
```

Server computes `days_until_due` and `status`:
- `days_until_due = Math.ceil((due_date - now) / 86400000)`
- `overdue`: `days_until_due < 0`
- `due_soon`: `days_until_due <= reminder_days_before`
- `upcoming`: otherwise

### `PUT /api/v1/recurring/:id`

Update recurring transaction.

**Request:**
```typescript
{
  expected_amount_pesewas?: number,
  frequency?: 'weekly' | 'biweekly' | 'monthly',
  reminder_days_before?: number,
  next_due_date?: string,
  is_active?: boolean
}
```

Ownership check. Sets `updated_at = datetime('now')`.

### `DELETE /api/v1/recurring/:id`

Delete. Ownership check. Returns `204`.

### `GET /api/v1/recurring/upcoming?limit=5`

Dashboard card endpoint. Returns next N due items (active only, due_soon + upcoming).

```sql
SELECT r.*, c.name as category_name, COALESCE(c.icon, '📦') as category_icon
FROM recurring_transactions r
LEFT JOIN categories c ON r.category_id = c.id
WHERE r.user_id = ? AND r.is_active = 1
ORDER BY r.next_due_date ASC
LIMIT ?
```

Server filters to `status !== 'overdue'` or includes overdue at the top — show all active items sorted by urgency.

---

## Frontend Design — Recurring Page

### Page Layout

```
RecurringPage (/recurring)
├── PageHeader           — "Recurring & Bills" + "Scan" button
├── CandidatesSection    — detected patterns for review
├── ActiveSection        — confirmed recurring items
├── InactiveSection      — paused (collapsible)
└── EmptyState
```

### CandidatesSection

- Only shown when candidates exist
- Gold-tinted banner: "We found {N} possible recurring payments"
- Each CandidateCard:
  - Counterparty name + frequency badge (bg-white/10 rounded-full px-2 py-0.5 text-xs)
  - "~₵200/month" + "Seen 4 times"
  - "Confirm" gold button + "Dismiss" muted button
  - Confirm → creates recurring entry, removes candidate
  - Dismiss → sets dismissed flag, removes from list

### RecurringCard

- ghana-surface card, rounded-xl, p-4, border-white/10
- Row 1: counterparty + category icon + frequency badge
- Row 2: "₵200" expected amount + status badge
  - `overdue`: bg-expense/20 text-expense "Overdue"
  - `due_soon`: bg-gold/20 text-gold "Due in {N} days"
  - `upcoming`: text-muted "Due {date}"
- Expandable: edit amount, frequency, reminder days, next due date, active toggle, delete

### InactiveSection

- Collapsible "Paused ({count})" header
- Muted cards (opacity-75), no status badges
- Can reactivate from edit

### EmptyState

- Calendar icon + "No recurring transactions detected yet"
- "Scan Now" gold button

---

## Dashboard Card: Upcoming Bills

New component: `UpcomingBillsCard`

- Placed in DashboardPage between CategoryBreakdownCard and RecentTransactions
- Fetch: `api.get<RecurringWithStatus[]>('/recurring/upcoming?limit=5')`
- Only rendered when items exist (hidden if empty array)
- ghana-surface card, header "Upcoming Bills"
- Each row: counterparty + "₵200" + status badge (compact)
- "View all →" link to `/recurring`

---

## Types (additions to packages/shared/src/types.ts)

```typescript
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

## Validation (additions to packages/shared/src/schemas.ts)

```typescript
export const confirmCandidateSchema = z.object({
  reminder_days_before: z.number().int().min(0).max(14).default(3),
});

export const updateRecurringSchema = z.object({
  expected_amount_pesewas: z.number().int().positive().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  reminder_days_before: z.number().int().min(0).max(14).optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_active: z.boolean().optional(),
});

export type ConfirmCandidateInput = z.infer<typeof confirmCandidateSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
```

---

## File Structure

### New Files
- `apps/api/migrations/0005_recurring.sql`
- `apps/api/src/lib/recurring-detection.ts` — detection algorithm (pure, testable)
- `apps/api/src/lib/recurring-detection.test.ts` — algorithm tests
- `apps/api/src/routes/recurring.ts` — all recurring/candidate endpoints
- `apps/web/src/pages/RecurringPage.tsx`
- `apps/web/src/components/recurring/CandidateCard.tsx`
- `apps/web/src/components/recurring/RecurringCard.tsx`
- `apps/web/src/components/recurring/UpcomingBillsCard.tsx`

### Modified Files
- `packages/shared/src/types.ts` — Add RecurringTransaction, RecurringCandidate, etc.
- `packages/shared/src/schemas.ts` — Add confirmCandidateSchema, updateRecurringSchema
- `apps/api/src/index.ts` — Mount recurring route
- `apps/web/src/pages/DashboardPage.tsx` — Add UpcomingBillsCard
- `apps/web/src/App.tsx` — Add `/recurring` route
