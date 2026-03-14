# Expense Splitting (Simple IOUs) — Design Spec

## Overview

Add a simple IOU tracking system. Users record who owes whom, with optional links to existing transactions. Settlement is manual (mark as paid). No multi-user accounts — purely personal tracking.

## Scope

**In scope:**
- IOU CRUD: create, list, settle, delete
- Direction: "owed to me" or "I owe"
- Optional link to an existing transaction
- Summary: total owed to me, total I owe, net
- Grouped by person
- Settle action (mark as paid with timestamp)
- Dedicated `/splits` page

**Out of scope:**
- Multi-user accounts or shared ledgers
- Group-based splitting
- Automatic detection of shared expenses
- Payment integration

---

## Database

### Migration: `0006_ious.sql`

```sql
CREATE TABLE IF NOT EXISTS ious (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  description TEXT,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  direction TEXT NOT NULL CHECK(direction IN ('owed_to_me', 'i_owe')),
  is_settled INTEGER NOT NULL DEFAULT 0,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ious_user ON ious(user_id, is_settled);
```

---

## API Design

### Middleware

```typescript
app.use('/api/v1/ious', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ious/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/ious', ious);
```

### `GET /api/v1/ious`

List all IOUs with summary. Query param: `?settled=false` (default) or `?settled=true` or `?settled=all`.

Response: `{ data: IOU[], meta: { total_owed_to_me: number, total_i_owe: number, net: number } }`

Sorted by: unsettled first (by created_at DESC), settled at bottom.

### `POST /api/v1/ious`

Create an IOU.

Request:
```typescript
{
  person_name: string,        // 1-100 chars
  amount_pesewas: number,     // positive integer
  direction: 'owed_to_me' | 'i_owe',
  description?: string,       // max 200 chars
  transaction_id?: string     // optional link to existing transaction
}
```

Validate transaction_id ownership if provided.

### `POST /api/v1/ious/:id/settle`

Mark an IOU as settled. Sets `is_settled = 1, settled_at = datetime('now')`. Returns updated IOU.

### `DELETE /api/v1/ious/:id`

Delete. Ownership check. Returns 204.

---

## Frontend — Splits Page

### Page Layout

```
SplitsPage (/splits)
├── SummaryCard     — "Owed to you: ₵150" / "You owe: ₵80" / "Net: +₵70"
├── PersonGroup[]   — grouped by person_name
│   ├── PersonHeader — name + total for person
│   └── IOURow[]     — individual IOUs with settle/delete
├── SettledSection  — collapsible settled IOUs
├── EmptyState
└── AddIOUModal
```

### SummaryCard
- Three amounts: owed_to_me (green), i_owe (red), net (green if positive, red if negative)

### PersonGroup
- Group unsettled IOUs by `person_name` (case-insensitive)
- Header: person name + net amount for that person
- Each IOURow: description, amount, direction badge, date, settle button

### AddIOUModal
- Person name input (with autocomplete from existing person names)
- Amount: AmountInput
- Direction: toggle "They owe me" / "I owe them"
- Description (optional)
- Link to transaction (optional dropdown of recent transactions)
- Save button

---

## Types

```typescript
export interface IOU {
  id: string;
  user_id: string;
  person_name: string;
  description: string | null;
  amount_pesewas: number;
  direction: 'owed_to_me' | 'i_owe';
  is_settled: boolean;
  transaction_id: string | null;
  settled_at: string | null;
  created_at: string;
}

export type IOUDirection = 'owed_to_me' | 'i_owe';
```

## Validation

```typescript
export const createIOUSchema = z.object({
  person_name: z.string().min(1).max(100),
  amount_pesewas: z.number().int().positive(),
  direction: z.enum(['owed_to_me', 'i_owe']),
  description: z.string().max(200).optional(),
  transaction_id: z.string().optional(),
});

export type CreateIOUInput = z.infer<typeof createIOUSchema>;
```

---

## File Structure

### New Files
- `apps/api/migrations/0006_ious.sql`
- `apps/api/src/routes/ious.ts`
- `apps/web/src/pages/SplitsPage.tsx`
- `apps/web/src/components/splits/IOUCard.tsx`
- `apps/web/src/components/splits/AddIOUModal.tsx`

### Modified Files
- `packages/shared/src/types.ts` — Add IOU types
- `packages/shared/src/schemas.ts` — Add createIOUSchema
- `apps/api/src/index.ts` — Mount ious route
- `apps/web/src/App.tsx` — Add `/splits` route
