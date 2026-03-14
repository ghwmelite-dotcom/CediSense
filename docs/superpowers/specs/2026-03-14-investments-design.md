# Investment Tracking — Design Spec

## Overview

Track T-Bills, mutual funds, fixed deposits, and other investments. User enters purchase details including rate. System computes expected returns for fixed-rate instruments. Manual value updates for variable-rate investments (mutual funds).

## Database: `0007_investments.sql`

```sql
CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('tbill', 'mutual_fund', 'fixed_deposit', 'other')),
  name TEXT NOT NULL,
  institution TEXT,
  amount_pesewas INTEGER NOT NULL CHECK(amount_pesewas > 0),
  rate_percent REAL,
  purchase_date TEXT NOT NULL,
  maturity_date TEXT,
  current_value_pesewas INTEGER,
  is_matured INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_investments_user ON investments(user_id, is_matured);
```

## API: `/api/v1/investments`

- `GET /` — list with computed returns. For T-Bills/fixed deposits: `expected_return = amount * (rate/100) * (days_held / 365)`. For mutual funds: `return = current_value - amount`. Return `InvestmentWithReturns[]`.
- `GET /summary` — totals: `total_invested`, `total_current_value`, `total_returns`, breakdown by type
- `POST /` — create. Validate type, amount, rate, dates.
- `PUT /:id` — update current_value, notes, maturity_date. Ownership check.
- `POST /:id/mature` — mark matured, set `is_matured = 1`, record final `current_value_pesewas`.
- `DELETE /:id` — ownership check, 204.

## Types

```typescript
export type InvestmentType = 'tbill' | 'mutual_fund' | 'fixed_deposit' | 'other';

export interface Investment {
  id: string; user_id: string; type: InvestmentType; name: string;
  institution: string | null; amount_pesewas: number; rate_percent: number | null;
  purchase_date: string; maturity_date: string | null;
  current_value_pesewas: number | null; is_matured: boolean;
  notes: string | null; created_at: string; updated_at: string;
}

export interface InvestmentWithReturns extends Investment {
  expected_return_pesewas: number;
  current_value_computed_pesewas: number;
  days_held: number;
  days_to_maturity: number | null;
}

export interface InvestmentSummary {
  total_invested_pesewas: number;
  total_current_value_pesewas: number;
  total_returns_pesewas: number;
  by_type: Array<{ type: InvestmentType; count: number; total_pesewas: number }>;
}
```

## Schemas

```typescript
export const createInvestmentSchema = z.object({
  type: z.enum(['tbill', 'mutual_fund', 'fixed_deposit', 'other']),
  name: z.string().min(1).max(100),
  institution: z.string().max(100).optional(),
  amount_pesewas: z.number().int().positive(),
  rate_percent: z.number().min(0).max(100).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  current_value_pesewas: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateInvestmentSchema = z.object({
  current_value_pesewas: z.number().int().positive().optional(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).optional(),
});
```

## Frontend: `/investments` page

- Summary card: total portfolio, total returns, return %
- Investment cards grouped by type tabs (T-Bills, Mutual Funds, Fixed Deposits, Other)
- Each card: name, institution, amount, rate, days to maturity, computed return
- Add Investment modal: type, name, institution, amount, rate, dates
- Mature action for approaching maturity
- Empty state

## Files

**New:** `0007_investments.sql`, `routes/investments.ts`, `pages/InvestmentsPage.tsx`, `components/investments/InvestmentCard.tsx`, `components/investments/AddInvestmentModal.tsx`, `components/investments/InvestmentSummaryCard.tsx`

**Modified:** `types.ts`, `schemas.ts`, `index.ts`, `App.tsx`
