# Subsystem 2: Transactions, SMS Parsing & CSV Import — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transaction management with SMS/CSV import and auto-categorization to CediSense.

**Architecture:** Source-specific parsers (SMS, CSV) produce `RawTransaction[]`, fed through shared dedup + categorization (rules → AI) pipeline. Two-step import: parse/preview → confirm/persist with KV-backed sessions.

**Tech Stack:** Hono (API routes), D1 (storage), KV (import sessions), Workers AI / Granite Micro (categorization fallback), Zod (validation), Vitest (tests), React + Tailwind (frontend)

**Spec:** `docs/superpowers/specs/2026-03-13-transactions-import-design.md`

---

## Chunk 1: Foundation (Migration, Types, Schemas, Format)

### Task 1: Database Migration

**Files:**
- Create: `apps/api/migrations/0002_transactions.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Migration: 0002_transactions.sql
-- Subsystem 2: Categories, Transactions, SMS Patterns, Category Rules
-- Also migrates accounts.balance_ghs (REAL) → balance_pesewas (INTEGER)

-- ============================================================
-- 1. Migrate accounts.balance_ghs → balance_pesewas
-- ============================================================
-- Note: Keep balance_ghs column for backward compat during migration.
-- Application code will use balance_pesewas; balance_ghs is ignored after this point.
-- A future cleanup migration can drop it once verified safe.
ALTER TABLE accounts ADD COLUMN balance_pesewas INTEGER NOT NULL DEFAULT 0;
UPDATE accounts SET balance_pesewas = CAST(balance_ghs * 100 AS INTEGER);

-- ============================================================
-- 2. Categories table
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name
  ON categories(user_id, name) WHERE user_id IS NOT NULL;

-- System default categories (user_id = NULL)
INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, type, sort_order) VALUES
  ('cat_food',        NULL, 'Food & Groceries',   '🍲', '#F59E0B', 'expense', 1),
  ('cat_transport',   NULL, 'Transport',           '🚌', '#3B82F6', 'expense', 2),
  ('cat_utilities',   NULL, 'Utilities',           '💡', '#8B5CF6', 'expense', 3),
  ('cat_rent',        NULL, 'Rent & Housing',      '🏠', '#EC4899', 'expense', 4),
  ('cat_health',      NULL, 'Health',              '🏥', '#EF4444', 'expense', 5),
  ('cat_education',   NULL, 'Education',           '📚', '#06B6D4', 'expense', 6),
  ('cat_church',      NULL, 'Church/Tithe',        '⛪', '#D4A843', 'expense', 7),
  ('cat_family',      NULL, 'Family Support',      '👨‍👩‍👧', '#F97316', 'expense', 8),
  ('cat_momofees',    NULL, 'Mobile Money Fees',   '📱', '#6366F1', 'expense', 9),
  ('cat_shopping',    NULL, 'Shopping',            '🛍️', '#A855F7', 'expense', 10),
  ('cat_entertainment', NULL, 'Entertainment',     '🎬', '#14B8A6', 'expense', 11),
  ('cat_salary',      NULL, 'Salary',              '💰', '#22C55E', 'income', 12),
  ('cat_business',    NULL, 'Business Income',     '💼', '#10B981', 'income', 13),
  ('cat_remittance',  NULL, 'Remittance Received', '🌍', '#0EA5E9', 'income', 14),
  ('cat_momoin',      NULL, 'MoMo Transfer In',    '📲', '#FACC15', 'income', 15),
  ('cat_sidehustle',  NULL, 'Side Hustle',         '🔧', '#F472B6', 'income', 16),
  ('cat_interest',    NULL, 'Interest/Returns',    '📈', '#34D399', 'income', 17),
  ('cat_savings',     NULL, 'Savings/Susu',        '🏦', '#006B3F', 'transfer', 18);

-- ============================================================
-- 3. Transactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'transfer')),
  amount_pesewas INTEGER NOT NULL,
  fee_pesewas INTEGER DEFAULT 0,
  description TEXT,
  raw_text TEXT,
  counterparty TEXT,
  reference TEXT,
  source TEXT NOT NULL CHECK (source IN ('sms_import', 'csv_import', 'manual')),
  categorized_by TEXT CHECK (categorized_by IN ('ai', 'user', 'rule') OR categorized_by IS NULL),
  transaction_date TEXT NOT NULL,
  import_batch_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_txn_user_reference ON transactions(user_id, reference);

CREATE TRIGGER IF NOT EXISTS transactions_updated_at
  AFTER UPDATE ON transactions
  FOR EACH ROW
  BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

-- ============================================================
-- 4. SMS Patterns table (registry/analytics only — runtime patterns in TypeScript)
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_patterns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_regex TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'transfer')),
  field_mapping TEXT NOT NULL,
  sample_sms TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- 5. Category Rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'exact', 'regex')),
  match_field TEXT NOT NULL CHECK (match_field IN ('counterparty', 'description', 'provider')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rules_user_priority ON category_rules(user_id, priority DESC);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --local --file=migrations/0002_transactions.sql`
Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/0002_transactions.sql
git commit -m "feat: add migration for categories, transactions, sms_patterns, category_rules"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new type definitions**

Append to `packages/shared/src/types.ts`:

```typescript
// --- Subsystem 2: Transactions ---

export type TransactionType = 'credit' | 'debit' | 'transfer';
export type TransactionSource = 'sms_import' | 'csv_import' | 'manual';
export type CategorizedBy = 'ai' | 'user' | 'rule';
export type MatchType = 'contains' | 'exact' | 'regex';
export type MatchField = 'counterparty' | 'description' | 'provider';
export type CategoryType = 'income' | 'expense' | 'transfer';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  raw_text: string | null;
  counterparty: string | null;
  reference: string | null;
  source: TransactionSource;
  categorized_by: CategorizedBy | null;
  transaction_date: string;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawTransaction {
  amount_pesewas: number;
  fee_pesewas: number;
  type: TransactionType;
  counterparty: string | null;
  reference: string | null;
  balance_after_pesewas: number | null;
  transaction_date: string;
  description: string;
  raw_text: string;
  source: TransactionSource;
  provider: string;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  match_type: MatchType;
  match_field: MatchField;
  match_value: string;
  category_id: string;
  priority: number;
  created_at: string;
}

export interface CSVFormat {
  provider: string;
  label: string;
  delimiter: ',' | ';' | '\t';
  hasHeader: boolean;
  columnMap: {
    date: string | number;
    description: string | number;
    amount: string | number;
    debit?: string | number;
    credit?: string | number;
    reference?: string | number;
    balance?: string | number;
  };
  dateFormat: string;
}

export interface SMSPattern {
  id: string;
  provider: string;
  pattern_name: string;
  pattern_regex: string;
  transaction_type: TransactionType;
  field_mapping: string;
  sample_sms: string | null;
  is_active: 0 | 1;
  created_at: string;
}

export interface ImportResult {
  import_id: string;
  parsed: RawTransaction[];
  duplicates: Array<{
    transaction: RawTransaction;
    existing: Transaction;
  }>;
}
```

- [ ] **Step 2: Update ApiSuccess meta to include limit**

In `packages/shared/src/types.ts`, update the existing `ApiSuccess` interface:

```typescript
// Change meta from:
//   meta?: { total?: number; page?: number }
// To:
  meta?: { total?: number; page?: number; limit?: number }
```

- [ ] **Step 3: Update Account type — balance_ghs → balance_pesewas**

In `packages/shared/src/types.ts`, change `Account.balance_ghs: number` to `Account.balance_pesewas: number`.

- [ ] **Step 4: Run type check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: Type errors in files that reference `balance_ghs` (accounts routes, schemas, frontend). These are expected and fixed in the next steps.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add transaction types, update Account to pesewas"
```

---

### Task 3: Update Format Utilities

**Files:**
- Modify: `packages/shared/src/format.ts`
- Modify: `packages/shared/src/format.test.ts`

- [ ] **Step 1: Add pesewas conversion helper**

Add to `packages/shared/src/format.ts`:

```typescript
/** Convert GHS decimal (e.g., 12.50) to pesewas integer (1250) */
export function toPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}

/** Convert pesewas integer (1250) to GHS decimal (12.50) */
export function toGHS(pesewas: number): number {
  return pesewas / 100;
}

/** Format pesewas as ₵ string: formatPesewas(1250) → "₵12.50" */
export function formatPesewas(pesewas: number): string {
  return formatGHS(pesewas / 100);
}
```

- [ ] **Step 2: Add tests**

Add to `packages/shared/src/format.test.ts`:

```typescript
import { toPesewas, toGHS, formatPesewas } from './format';

describe('toPesewas', () => {
  it('converts GHS to pesewas', () => {
    expect(toPesewas(12.50)).toBe(1250);
    expect(toPesewas(0.01)).toBe(1);
    expect(toPesewas(1000)).toBe(100000);
    expect(toPesewas(0)).toBe(0);
  });

  it('rounds to nearest pesewa', () => {
    expect(toPesewas(12.345)).toBe(1235);
    expect(toPesewas(12.344)).toBe(1234);
  });
});

describe('toGHS', () => {
  it('converts pesewas to GHS', () => {
    expect(toGHS(1250)).toBe(12.50);
    expect(toGHS(1)).toBe(0.01);
    expect(toGHS(0)).toBe(0);
  });
});

describe('formatPesewas', () => {
  it('formats pesewas as cedi string', () => {
    expect(formatPesewas(1250)).toBe('₵12.50');
    expect(formatPesewas(100000)).toBe('₵1,000.00');
    expect(formatPesewas(1)).toBe('₵0.01');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd packages/shared && npx vitest run format.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/format.ts packages/shared/src/format.test.ts
git commit -m "feat: add pesewas conversion helpers"
```

---

### Task 4: Update Schemas + Fix balance_ghs References

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `apps/api/src/routes/accounts.ts`
- Modify: `apps/web/src/components/onboarding/AccountStep.tsx` (if references balance_ghs)

- [ ] **Step 1: Add transaction/category/import Zod schemas**

Append to `packages/shared/src/schemas.ts`:

```typescript
// --- Subsystem 2 Schemas ---

export const createTransactionSchema = z.object({
  amount_pesewas: z.number().int().positive('Amount must be positive'),
  fee_pesewas: z.number().int().min(0).default(0),
  type: z.enum(['credit', 'debit', 'transfer']),
  account_id: z.string().min(1),
  category_id: z.string().optional(),
  description: z.string().max(500).optional(),
  counterparty: z.string().max(200).optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Must be ISO 8601 date'),
});

export const updateTransactionSchema = z.object({
  category_id: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  counterparty: z.string().max(200).optional(),
  amount_pesewas: z.number().int().positive().optional(),
  fee_pesewas: z.number().int().min(0).optional(),
  type: z.enum(['credit', 'debit', 'transfer']).optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const importSmsSchema = z.object({
  messages: z.array(z.string().min(1)).min(1).max(500),
});

export const importCsvSchema = z.object({
  csv_text: z.string().min(1).max(2 * 1024 * 1024, 'CSV too large (max 2MB)'),
  format: z.string().min(1),
});

export const importConfirmSchema = z.object({
  import_id: z.string().min(1),
  account_id: z.string().min(1),
  confirmed_indices: z.array(z.number().int().min(0)),
  category_overrides: z.record(z.string(), z.string()).optional(),
  duplicate_decisions: z.record(z.string(), z.enum(['import', 'skip'])).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  type: z.enum(['income', 'expense', 'transfer']),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
});

export const createCategoryRuleSchema = z.object({
  match_type: z.enum(['contains', 'exact', 'regex']),
  match_field: z.enum(['counterparty', 'description', 'provider']),
  match_value: z.string().min(1).max(200),
  category_id: z.string().min(1),
  priority: z.number().int().min(0).default(0),
});

export const transactionQuerySchema = z.object({
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  type: z.enum(['credit', 'debit', 'transfer']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

- [ ] **Step 2: Update account schemas — balance_ghs → balance_pesewas**

In `packages/shared/src/schemas.ts`, update:
- `createAccountSchema`: rename `balance_ghs` to `balance_pesewas`, change to `z.number().int().min(0).default(0)`
- `updateAccountSchema`: rename `balance_ghs` to `balance_pesewas`, change to `z.number().int().min(0).optional()`

- [ ] **Step 3: Update accounts route — balance_ghs → balance_pesewas**

In `apps/api/src/routes/accounts.ts`, find-and-replace all references to `balance_ghs` with `balance_pesewas`. This includes:
- INSERT column name and binding
- UPDATE SET clause
- Any SELECT result usage

- [ ] **Step 4: Update any frontend references to balance_ghs**

Search `apps/web/src/` for `balance_ghs` and replace with `balance_pesewas`. Update any `formatGHS(account.balance_ghs)` calls to `formatPesewas(account.balance_pesewas)`.

- [ ] **Step 5: Update barrel export**

In `packages/shared/src/index.ts`, add exports for all new schemas.

- [ ] **Step 6: Run type check and tests**

Run: `cd packages/shared && npx vitest run && npx tsc --noEmit`
Run: `cd apps/api && npx tsc --noEmit`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/schemas.test.ts packages/shared/src/index.ts apps/api/src/routes/accounts.ts apps/web/src/
git commit -m "feat: add transaction schemas, migrate balance_ghs to balance_pesewas"
```

---

## Chunk 2: SMS Parsing Engine

### Task 5: Date Parser Utility

**Files:**
- Create: `packages/shared/src/sms/parse-date.ts`
- Create: `packages/shared/src/sms/parse-date.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/shared/src/sms/parse-date.test.ts
import { describe, it, expect } from 'vitest';
import { parseGhanaDate } from './parse-date';

describe('parseGhanaDate', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseGhanaDate('12/03/2026')).toBe('2026-03-12');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseGhanaDate('12-03-2026')).toBe('2026-03-12');
  });

  it('parses DD-Mon-YYYY', () => {
    expect(parseGhanaDate('12-Mar-2026')).toBe('2026-03-12');
    expect(parseGhanaDate('05-Jan-2026')).toBe('2026-01-05');
  });

  it('parses YYYY-MM-DD (ISO)', () => {
    expect(parseGhanaDate('2026-03-12')).toBe('2026-03-12');
  });

  it('parses DD/MM/YY (2-digit year)', () => {
    expect(parseGhanaDate('12/03/26')).toBe('2026-03-12');
  });

  it('returns fallback date for unparseable input', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(parseGhanaDate('not a date')).toBe(today);
    expect(parseGhanaDate('')).toBe(today);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd packages/shared && npx vitest run sms/parse-date.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// packages/shared/src/sms/parse-date.ts
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseGhanaDate(dateStr: string): string {
  const s = dateStr.trim();

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy4) return `${dmy4[3]}-${dmy4[2].padStart(2, '0')}-${dmy4[1].padStart(2, '0')}`;

  // DD/MM/YY
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2) return `20${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;

  // DD-Mon-YYYY
  const dmon = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (dmon) {
    const month = MONTHS[dmon[2].toLowerCase()];
    if (month) return `${dmon[3]}-${month}-${dmon[1].padStart(2, '0')}`;
  }

  // Fallback: today
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && npx vitest run sms/parse-date.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sms/
git commit -m "feat: add Ghana date parser for SMS/CSV imports"
```

---

### Task 6: SMS Parser Core + Registry

**Files:**
- Create: `packages/shared/src/sms/types.ts`
- Create: `packages/shared/src/sms/registry.ts`
- Create: `packages/shared/src/sms/index.ts`
- Create: `packages/shared/src/sms/parse-amount.ts`
- Create: `packages/shared/src/sms/parse-amount.test.ts`

- [ ] **Step 1: Define SMS pattern types**

```typescript
// packages/shared/src/sms/types.ts
import type { TransactionType } from '../types';

export interface SMSPatternDef {
  provider: string;
  name: string;
  regex: RegExp;
  type: TransactionType;
  extract: (match: RegExpMatchArray) => {
    amount_ghs: number;
    fee_ghs: number;
    counterparty: string | null;
    reference: string | null;
    balance_after_ghs: number | null;
    date_str: string | null;
    description: string;
  };
}
```

- [ ] **Step 2: Create amount parser**

```typescript
// packages/shared/src/sms/parse-amount.ts
/** Parse "1,234.56" or "1234.56" or "1234" to number */
export function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
```

- [ ] **Step 3: Test amount parser**

```typescript
// packages/shared/src/sms/parse-amount.test.ts
import { describe, it, expect } from 'vitest';
import { parseAmount } from './parse-amount';

describe('parseAmount', () => {
  it('parses plain number', () => expect(parseAmount('1234.56')).toBe(1234.56));
  it('parses with commas', () => expect(parseAmount('1,234.56')).toBe(1234.56));
  it('parses integer', () => expect(parseAmount('500')).toBe(500));
  it('returns 0 for invalid', () => expect(parseAmount('abc')).toBe(0));
});
```

- [ ] **Step 4: Create registry and parseSMS entry point**

Uses explicit array construction (no side-effect imports) to avoid fragile module loading and duplicate registration in tests.

```typescript
// packages/shared/src/sms/registry.ts
import type { SMSPatternDef } from './types';
import { mtnMomoPatterns } from './providers/mtn-momo';
import { vodafoneCashPatterns } from './providers/vodafone-cash';
import { airteltigoPatterns } from './providers/airteltigo';
import { gcbPatterns } from './providers/gcb';
import { ecobankPatterns } from './providers/ecobank';
import { fidelityPatterns } from './providers/fidelity';
import { stanbicPatterns } from './providers/stanbic';
import { absaPatterns } from './providers/absa';
import { calbankPatterns } from './providers/calbank';
import { ubaPatterns } from './providers/uba';
import { zenithPatterns } from './providers/zenith';

// Priority order: MoMo providers first (dominant), then banks
export const ALL_PATTERNS: SMSPatternDef[] = [
  ...mtnMomoPatterns,
  ...vodafoneCashPatterns,
  ...airteltigoPatterns,
  ...gcbPatterns,
  ...ecobankPatterns,
  ...fidelityPatterns,
  ...stanbicPatterns,
  ...absaPatterns,
  ...calbankPatterns,
  ...ubaPatterns,
  ...zenithPatterns,
];
```

**Note:** This file will not compile until all provider files exist. Create stub files for each provider first (empty arrays), then fill in real patterns in Tasks 7-9. Create stubs now:

For each provider file that doesn't exist yet, create a stub:
```typescript
// packages/shared/src/sms/providers/<provider>.ts  (stub)
import type { SMSPatternDef } from '../types';
export const <provider>Patterns: SMSPatternDef[] = [];
```

Stub files needed: `mtn-momo.ts`, `vodafone-cash.ts`, `airteltigo.ts`, `gcb.ts`, `ecobank.ts`, `fidelity.ts`, `stanbic.ts`, `absa.ts`, `calbank.ts`, `uba.ts`, `zenith.ts`.

```typescript
// packages/shared/src/sms/index.ts
import type { RawTransaction } from '../types';
import { toPesewas } from '../format';
import { parseGhanaDate } from './parse-date';
import { ALL_PATTERNS } from './registry';

export { parseGhanaDate } from './parse-date';
export { parseAmount } from './parse-amount';
export { ALL_PATTERNS } from './registry';

export function parseSMS(text: string): RawTransaction | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of ALL_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    const extracted = pattern.extract(match);
    return {
      amount_pesewas: toPesewas(extracted.amount_ghs),
      fee_pesewas: toPesewas(extracted.fee_ghs),
      type: pattern.type,
      counterparty: extracted.counterparty,
      reference: extracted.reference,
      balance_after_pesewas: extracted.balance_after_ghs != null
        ? toPesewas(extracted.balance_after_ghs)
        : null,
      transaction_date: extracted.date_str
        ? parseGhanaDate(extracted.date_str)
        : new Date().toISOString().slice(0, 10),
      description: extracted.description,
      raw_text: trimmed,
      source: 'sms_import',
      provider: pattern.provider,
    };
  }

  return null;
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/shared && npx vitest run sms/parse-amount.test.ts`
Expected: Pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/sms/
git commit -m "feat: add SMS parser core, registry, amount parser"
```

---

### Task 7: MTN MoMo SMS Patterns

**Files:**
- Create: `packages/shared/src/sms/providers/mtn-momo.ts`
- Create: `packages/shared/src/sms/providers/mtn-momo.test.ts`

- [ ] **Step 1: Write failing tests with real-world SMS samples**

```typescript
// packages/shared/src/sms/providers/mtn-momo.test.ts
import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('MTN MoMo SMS parsing', () => {
  it('parses cash-out', () => {
    const sms = 'You have cashed out GHS 200.00 from your MoMo account. Fee charged: GHS 1.50. Reference: 1234567890. Balance: GHS 450.00. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(20000);
    expect(result!.fee_pesewas).toBe(150);
    expect(result!.type).toBe('debit');
    expect(result!.reference).toBe('1234567890');
    expect(result!.balance_after_pesewas).toBe(45000);
    expect(result!.provider).toBe('mtn_momo');
  });

  it('parses transfer sent', () => {
    const sms = 'You have sent GHS 50.00 to KWAME ASANTE (024XXXXXXX). Reference: 9876543210. Fee: GHS 0.50. Balance: GHS 399.50. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(5000);
    expect(result!.type).toBe('debit');
    expect(result!.counterparty).toBe('KWAME ASANTE');
  });

  it('parses transfer received', () => {
    const sms = 'You have received GHS 100.00 from AMA MENSAH (025XXXXXXX). Reference: 5678901234. Balance: GHS 549.50. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(10000);
    expect(result!.type).toBe('credit');
    expect(result!.counterparty).toBe('AMA MENSAH');
    expect(result!.fee_pesewas).toBe(0);
  });

  it('parses merchant payment', () => {
    const sms = 'You have paid GHS 35.00 to SHOPRITE ACCRA MALL. Reference: 1122334455. Fee: GHS 0.00. Balance: GHS 514.50. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(3500);
    expect(result!.type).toBe('debit');
    expect(result!.counterparty).toBe('SHOPRITE ACCRA MALL');
  });

  it('parses airtime purchase', () => {
    const sms = 'You have bought GHS 10.00 airtime. Reference: 6677889900. Balance: GHS 504.50. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(1000);
    expect(result!.type).toBe('debit');
  });

  it('parses cash-in', () => {
    const sms = 'You have received GHS 500.00 cash deposit. Reference: 4455667788. Balance: GHS 1,004.50. Date: 12/03/2026.';
    const result = parseSMS(sms);
    expect(result).not.toBeNull();
    expect(result!.amount_pesewas).toBe(50000);
    expect(result!.type).toBe('credit');
  });

  it('returns null for non-MoMo SMS', () => {
    expect(parseSMS('Hello, how are you?')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd packages/shared && npx vitest run sms/providers/mtn-momo.test.ts`
Expected: FAIL — provider module not found.

- [ ] **Step 3: Implement MTN MoMo patterns**

```typescript
// packages/shared/src/sms/providers/mtn-momo.ts
import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'mtn_momo';

export const mtnMomoPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'mtn_cash_out',
    regex: /You have cashed out GHS ([\d,]+\.\d{2}).*?Fee charged: GHS ([\d,]+\.\d{2}).*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[2]),
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `MoMo cash-out GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_transfer_sent',
    regex: /You have sent GHS ([\d,]+\.\d{2}) to ([A-Z\s]+?)\s*\(\d{3}[X\d]+\).*?Reference: (\w+).*?Fee: GHS ([\d,]+\.\d{2}).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `MoMo transfer to ${m[2].trim()}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_transfer_received',
    regex: /You have received GHS ([\d,]+\.\d{2}) from ([A-Z\s]+?)\s*\(\d{3}[X\d]+\).*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `MoMo received from ${m[2].trim()}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_payment',
    regex: /You have paid GHS ([\d,]+\.\d{2}) to ([A-Z\s\d]+?)\.?\s*Reference: (\w+).*?Fee: GHS ([\d,]+\.\d{2}).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `MoMo payment to ${m[2].trim()}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_airtime',
    regex: /You have bought GHS ([\d,]+\.\d{2}) airtime.*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[2],
      balance_after_ghs: parseAmount(m[3]),
      date_str: m[4],
      description: `Airtime purchase GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_cash_in',
    regex: /You have received GHS ([\d,]+\.\d{2}) cash deposit.*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d\/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[2],
      balance_after_ghs: parseAmount(m[3]),
      date_str: m[4],
      description: `MoMo cash deposit GHS ${m[1]}`,
    }),
  },
];
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && npx vitest run sms/providers/mtn-momo.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sms/providers/mtn-momo.ts packages/shared/src/sms/providers/mtn-momo.test.ts
git commit -m "feat: add MTN MoMo SMS parsing patterns"
```

---

### Task 8: Vodafone Cash + AirtelTigo SMS Patterns

**Files:**
- Create: `packages/shared/src/sms/providers/vodafone-cash.ts`
- Create: `packages/shared/src/sms/providers/vodafone-cash.test.ts`
- Create: `packages/shared/src/sms/providers/airteltigo.ts`
- Create: `packages/shared/src/sms/providers/airteltigo.test.ts`

Follow the same pattern as Task 7. Each provider file:
1. Defines `SMSPatternDef[]` with regex + extract functions
2. Calls `registerPatterns()`
3. Has a test file with sample SMS messages

- [ ] **Step 1: Write Vodafone Cash tests with sample SMS messages**

Vodafone Cash patterns (~5): send money, receive money, payment, withdrawal, deposit. Use realistic Vodafone Cash SMS formats. Follow the same test structure as MTN MoMo.

- [ ] **Step 2: Implement Vodafone Cash patterns**

- [ ] **Step 3: Run Vodafone tests**

Run: `cd packages/shared && npx vitest run sms/providers/vodafone-cash.test.ts`

- [ ] **Step 4: Write AirtelTigo tests with sample SMS messages**

AirtelTigo patterns (~4): transfer, receive, withdrawal, payment.

- [ ] **Step 5: Implement AirtelTigo patterns**

- [ ] **Step 6: Run AirtelTigo tests**

Run: `cd packages/shared && npx vitest run sms/providers/airteltigo.test.ts`

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/sms/providers/
git commit -m "feat: add Vodafone Cash and AirtelTigo SMS patterns"
```

---

### Task 9: Bank SMS Patterns (8 Banks)

**Files:**
- Create: `packages/shared/src/sms/providers/gcb.ts` (and test)
- Create: `packages/shared/src/sms/providers/ecobank.ts` (and test)
- Create: `packages/shared/src/sms/providers/fidelity.ts` (and test)
- Create: `packages/shared/src/sms/providers/stanbic.ts` (and test)
- Create: `packages/shared/src/sms/providers/absa.ts` (and test)
- Create: `packages/shared/src/sms/providers/calbank.ts` (and test)
- Create: `packages/shared/src/sms/providers/uba.ts` (and test)
- Create: `packages/shared/src/sms/providers/zenith.ts` (and test)

Each bank has ~2 patterns (credit alert, debit alert). Bank SMS is simpler than MoMo.

- [ ] **Step 1: Write tests for all 8 banks** — 2 test cases each (credit + debit alert)
- [ ] **Step 2: Implement all 8 bank pattern files**
- [ ] **Step 3: Run all bank tests**

Run: `cd packages/shared && npx vitest run sms/providers/`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/sms/providers/
git commit -m "feat: add SMS patterns for 8 Ghanaian banks"
```

---

## Chunk 3: CSV Parser + Categorization Pipeline

### Task 10: CSV Parser

**Files:**
- Create: `packages/shared/src/csv/index.ts`
- Create: `packages/shared/src/csv/formats.ts`
- Create: `packages/shared/src/csv/index.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/shared/src/csv/index.test.ts
import { describe, it, expect } from 'vitest';
import { parseCSV, getCSVFormats } from './index';

describe('parseCSV', () => {
  it('parses GCB bank CSV with header', () => {
    const csv = `Date,Description,Debit,Credit,Reference,Balance
12/03/2026,ATM WITHDRAWAL,200.00,,TXN001,1800.00
12/03/2026,SALARY CREDIT,,5000.00,TXN002,6800.00`;

    const result = parseCSV(csv, 'gcb_bank');
    expect(result).toHaveLength(2);
    expect(result[0].amount_pesewas).toBe(20000);
    expect(result[0].type).toBe('debit');
    expect(result[0].reference).toBe('TXN001');
    expect(result[1].amount_pesewas).toBe(500000);
    expect(result[1].type).toBe('credit');
  });

  it('parses MTN MoMo CSV with single amount column', () => {
    const csv = `Date,Description,Amount,Reference,Balance
12/03/2026,TRANSFER TO KWAME,-50.00,REF123,450.00
12/03/2026,RECEIVED FROM AMA,100.00,REF456,550.00`;

    const result = parseCSV(csv, 'mtn_momo');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('debit');
    expect(result[0].amount_pesewas).toBe(5000);
    expect(result[1].type).toBe('credit');
    expect(result[1].amount_pesewas).toBe(10000);
  });

  it('throws on unknown format', () => {
    expect(() => parseCSV('data', 'unknown_bank')).toThrow('Unknown CSV format');
  });

  it('returns empty array for empty CSV', () => {
    expect(parseCSV('', 'gcb_bank')).toEqual([]);
  });
});

describe('getCSVFormats', () => {
  it('returns all available formats', () => {
    const formats = getCSVFormats();
    expect(formats.length).toBeGreaterThanOrEqual(11);
    expect(formats.find(f => f.provider === 'gcb_bank')).toBeDefined();
  });
});
```

- [ ] **Step 2: Define CSV format configurations**

```typescript
// packages/shared/src/csv/formats.ts
import type { CSVFormat } from '../types';

export const CSV_FORMATS: CSVFormat[] = [
  {
    provider: 'mtn_momo',
    label: 'MTN MoMo Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'vodafone_cash',
    label: 'Vodafone Cash Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'airteltigo',
    label: 'AirtelTigo Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount', reference: 'Ref', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'gcb_bank',
    label: 'GCB Bank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', debit: 'Debit', credit: 'Credit', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'ecobank',
    label: 'Ecobank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Narration', debit: 'Debit', credit: 'Credit', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD-Mon-YYYY',
  },
  {
    provider: 'fidelity_bank',
    label: 'Fidelity Bank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Trans Date', description: 'Description', debit: 'Debit', credit: 'Credit', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'stanbic_bank',
    label: 'Stanbic Bank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', debit: 'Debit', credit: 'Credit', reference: 'Reference No', balance: 'Balance' },
    dateFormat: 'YYYY-MM-DD',
  },
  {
    provider: 'absa_bank',
    label: 'Absa Bank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', amount: 'Amount', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'calbank',
    label: 'CalBank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Value Date', description: 'Narration', debit: 'Debit', credit: 'Credit', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'uba_bank',
    label: 'UBA Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Description', debit: 'Debit', credit: 'Credit', reference: 'Ref', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
  {
    provider: 'zenith_bank',
    label: 'Zenith Bank Statement',
    delimiter: ',',
    hasHeader: true,
    columnMap: { date: 'Date', description: 'Remarks', debit: 'Debit', credit: 'Credit', reference: 'Reference', balance: 'Balance' },
    dateFormat: 'DD/MM/YYYY',
  },
];
```

- [ ] **Step 3: Implement CSV parser**

```typescript
// packages/shared/src/csv/index.ts
import type { RawTransaction, CSVFormat } from '../types';
import { toPesewas } from '../format';
import { parseGhanaDate } from '../sms/parse-date';
import { CSV_FORMATS } from './formats';

export { CSV_FORMATS } from './formats';

export function getCSVFormats(): CSVFormat[] {
  return CSV_FORMATS;
}

export function parseCSV(csvText: string, formatId: string): RawTransaction[] {
  const format = CSV_FORMATS.find(f => f.provider === formatId);
  if (!format) throw new Error(`Unknown CSV format: ${formatId}`);

  const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let headers: string[] | null = null;
  const dataStart = format.hasHeader ? 1 : 0;
  if (format.hasHeader && lines.length > 0) {
    headers = parseLine(lines[0], format.delimiter);
  }

  const results: RawTransaction[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const cols = parseLine(lines[i], format.delimiter);
    const row = resolveColumns(cols, headers, format.columnMap);

    const dateStr = row.date || '';
    const description = row.description || '';
    const reference = row.reference || null;
    const balance = row.balance ? parseFloat(row.balance.replace(/,/g, '')) : null;

    let amount_ghs: number;
    let type: 'credit' | 'debit';

    if (format.columnMap.debit !== undefined && format.columnMap.credit !== undefined) {
      const debit = row.debit ? parseFloat(row.debit.replace(/,/g, '')) : 0;
      const credit = row.credit ? parseFloat(row.credit.replace(/,/g, '')) : 0;
      if (credit > 0) {
        amount_ghs = credit;
        type = 'credit';
      } else {
        amount_ghs = debit;
        type = 'debit';
      }
    } else {
      const raw = parseFloat((row.amount || '0').replace(/,/g, ''));
      amount_ghs = Math.abs(raw);
      type = raw < 0 ? 'debit' : 'credit';
    }

    if (amount_ghs <= 0) continue;

    results.push({
      amount_pesewas: toPesewas(amount_ghs),
      fee_pesewas: 0,
      type,
      counterparty: null,
      reference,
      balance_after_pesewas: balance != null ? toPesewas(balance) : null,
      transaction_date: parseGhanaDate(dateStr),
      description,
      raw_text: lines[i],
      source: 'csv_import',
      provider: format.provider,
    });
  }

  return results;
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function resolveColumns(
  cols: string[],
  headers: string[] | null,
  columnMap: CSVFormat['columnMap'],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const [field, key] of Object.entries(columnMap)) {
    if (key === undefined) continue;
    let idx: number;
    if (typeof key === 'number') {
      idx = key;
    } else if (headers) {
      idx = headers.findIndex(h => h.toLowerCase() === (key as string).toLowerCase());
    } else {
      continue;
    }
    if (idx >= 0 && idx < cols.length) {
      row[field] = cols[idx];
    }
  }
  return row;
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && npx vitest run csv/index.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/csv/
git commit -m "feat: add CSV parser with format definitions for 11 providers"
```

---

### Task 11: Deduplication Service

**Files:**
- Create: `apps/api/src/lib/dedup.ts`
- Create: `apps/api/src/lib/dedup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/lib/dedup.test.ts
import { describe, it, expect } from 'vitest';
import { findDuplicates } from './dedup';
import type { RawTransaction, Transaction } from '@cedisense/shared';

const makeRaw = (overrides: Partial<RawTransaction> = {}): RawTransaction => ({
  amount_pesewas: 5000,
  fee_pesewas: 0,
  type: 'debit',
  counterparty: 'KWAME',
  reference: 'REF123',
  balance_after_pesewas: null,
  transaction_date: '2026-03-12',
  description: 'Test',
  raw_text: 'test sms',
  source: 'sms_import',
  provider: 'mtn_momo',
  ...overrides,
});

const makeExisting = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn1',
  user_id: 'user1',
  account_id: 'acc1',
  category_id: null,
  type: 'debit',
  amount_pesewas: 5000,
  fee_pesewas: 0,
  description: 'Test',
  raw_text: null,
  counterparty: 'KWAME',
  reference: 'REF123',
  source: 'sms_import',
  categorized_by: null,
  transaction_date: '2026-03-12',
  import_batch_id: null,
  created_at: '2026-03-12T00:00:00',
  updated_at: '2026-03-12T00:00:00',
  ...overrides,
});

describe('findDuplicates', () => {
  it('matches by reference', () => {
    const incoming = [makeRaw({ reference: 'REF123' })];
    const existing = [makeExisting({ reference: 'REF123' })];
    const { clean, duplicates } = findDuplicates(incoming, existing);
    expect(clean).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].existing.reference).toBe('REF123');
  });

  it('matches by fuzzy key when reference is null', () => {
    const incoming = [makeRaw({ reference: null })];
    const existing = [makeExisting({ reference: null })];
    const { clean, duplicates } = findDuplicates(incoming, existing);
    expect(duplicates).toHaveLength(1);
  });

  it('passes through non-duplicates', () => {
    const incoming = [makeRaw({ reference: 'NEW_REF' })];
    const existing = [makeExisting({ reference: 'OLD_REF' })];
    const { clean, duplicates } = findDuplicates(incoming, existing);
    expect(clean).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// apps/api/src/lib/dedup.ts
import type { RawTransaction, Transaction } from '@cedisense/shared';

interface DedupResult {
  clean: RawTransaction[];
  duplicates: Array<{ transaction: RawTransaction; existing: Transaction }>;
}

export function findDuplicates(
  incoming: RawTransaction[],
  existing: Transaction[],
): DedupResult {
  // Build lookup sets from existing transactions
  const refSet = new Set<string>();
  const fuzzySet = new Set<string>();
  const refMap = new Map<string, Transaction>();
  const fuzzyMap = new Map<string, Transaction>();

  for (const txn of existing) {
    if (txn.reference) {
      refSet.add(txn.reference);
      refMap.set(txn.reference, txn);
    }
    const fuzzyKey = `${txn.amount_pesewas}|${txn.transaction_date}|${txn.counterparty || ''}`;
    fuzzySet.add(fuzzyKey);
    fuzzyMap.set(fuzzyKey, txn);
  }

  const clean: RawTransaction[] = [];
  const duplicates: DedupResult['duplicates'] = [];

  for (const raw of incoming) {
    // Primary: match by reference
    if (raw.reference && refSet.has(raw.reference)) {
      duplicates.push({ transaction: raw, existing: refMap.get(raw.reference)! });
      continue;
    }

    // Fuzzy: match by amount + date + counterparty
    if (!raw.reference) {
      const fuzzyKey = `${raw.amount_pesewas}|${raw.transaction_date}|${raw.counterparty || ''}`;
      if (fuzzySet.has(fuzzyKey)) {
        duplicates.push({ transaction: raw, existing: fuzzyMap.get(fuzzyKey)! });
        continue;
      }
    }

    clean.push(raw);
  }

  return { clean, duplicates };
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx vitest run lib/dedup.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/dedup.ts apps/api/src/lib/dedup.test.ts
git commit -m "feat: add transaction deduplication service"
```

---

### Task 12: Categorization Pipeline

**Files:**
- Create: `apps/api/src/lib/categorize.ts`
- Create: `apps/api/src/lib/categorize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/lib/categorize.test.ts
import { describe, it, expect } from 'vitest';
import { applyRules } from './categorize';
import type { RawTransaction, CategoryRule } from '@cedisense/shared';

const makeRaw = (overrides: Partial<RawTransaction> = {}): RawTransaction => ({
  amount_pesewas: 5000,
  fee_pesewas: 0,
  type: 'debit',
  counterparty: 'SHOPRITE ACCRA',
  reference: null,
  balance_after_pesewas: null,
  transaction_date: '2026-03-12',
  description: 'MoMo payment to SHOPRITE ACCRA',
  raw_text: 'test',
  source: 'sms_import',
  provider: 'mtn_momo',
  ...overrides,
});

describe('applyRules', () => {
  const rules: CategoryRule[] = [
    {
      id: 'r1', user_id: 'u1', match_type: 'contains', match_field: 'counterparty',
      match_value: 'SHOPRITE', category_id: 'cat_food', priority: 10, created_at: '',
    },
    {
      id: 'r2', user_id: 'u1', match_type: 'exact', match_field: 'description',
      match_value: 'airtime purchase ghs 10.00', category_id: 'cat_utilities', priority: 5, created_at: '',
    },
  ];

  it('matches contains rule on counterparty', () => {
    const txns = [makeRaw()];
    const result = applyRules(txns, rules);
    expect(result[0].category_id).toBe('cat_food');
    expect(result[0].categorized_by).toBe('rule');
  });

  it('matches exact rule on description (case-insensitive)', () => {
    const txns = [makeRaw({ counterparty: null, description: 'Airtime purchase GHS 10.00' })];
    const result = applyRules(txns, rules);
    expect(result[0].category_id).toBe('cat_utilities');
  });

  it('leaves uncategorized when no rule matches', () => {
    const txns = [makeRaw({ counterparty: 'UNKNOWN VENDOR', description: 'random' })];
    const result = applyRules(txns, rules);
    expect(result[0].category_id).toBeNull();
    expect(result[0].categorized_by).toBeNull();
  });

  it('higher priority rule wins', () => {
    const rules2: CategoryRule[] = [
      { ...rules[0], priority: 1 },
      {
        id: 'r3', user_id: 'u1', match_type: 'contains', match_field: 'counterparty',
        match_value: 'SHOPRITE', category_id: 'cat_shopping', priority: 20, created_at: '',
      },
    ];
    const txns = [makeRaw()];
    const result = applyRules(txns, rules2);
    expect(result[0].category_id).toBe('cat_shopping');
  });
});
```

- [ ] **Step 2: Implement rule matching and AI categorization**

```typescript
// apps/api/src/lib/categorize.ts
import type { RawTransaction, CategoryRule, CategorizedBy } from '@cedisense/shared';

export interface CategorizedTransaction extends RawTransaction {
  category_id: string | null;
  categorized_by: CategorizedBy | null;
}

export function applyRules(
  transactions: RawTransaction[],
  rules: CategoryRule[],
): CategorizedTransaction[] {
  // Sort rules by priority descending
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  return transactions.map(txn => {
    for (const rule of sorted) {
      const fieldValue = getFieldValue(txn, rule.match_field);
      if (fieldValue === null) continue;

      if (matchesRule(fieldValue, rule)) {
        return { ...txn, category_id: rule.category_id, categorized_by: 'rule' as const };
      }
    }
    return { ...txn, category_id: null, categorized_by: null };
  });
}

function getFieldValue(txn: RawTransaction, field: string): string | null {
  switch (field) {
    case 'counterparty': return txn.counterparty;
    case 'description': return txn.description;
    case 'provider': return txn.provider;
    default: return null;
  }
}

function matchesRule(value: string, rule: CategoryRule): boolean {
  const lower = value.toLowerCase();
  const matchLower = rule.match_value.toLowerCase();

  switch (rule.match_type) {
    case 'contains':
      return lower.includes(matchLower);
    case 'exact':
      return lower === matchLower;
    case 'regex':
      try { return new RegExp(rule.match_value, 'i').test(value); }
      catch { return false; }
    default:
      return false;
  }
}

/**
 * AI fallback categorization via Workers AI (Granite Micro).
 * Called for transactions still uncategorized after rule matching.
 * Non-blocking: returns uncategorized on failure.
 */
export async function categorizeWithAI(
  transactions: CategorizedTransaction[],
  systemCategories: Array<{ id: string; name: string; type: string }>,
  ai: Ai,
): Promise<CategorizedTransaction[]> {
  const uncategorized = transactions.filter(t => t.category_id === null);
  if (uncategorized.length === 0) return transactions;

  // Cap at 50 per batch
  const batch = uncategorized.slice(0, 50);
  const categoryList = systemCategories.map(c => `${c.name} (${c.type})`).join(', ');

  const prompt = `You are a transaction categorizer for a Ghanaian personal finance app.
Given these categories: ${categoryList}

Categorize each transaction below. Return ONLY a JSON array of category names, one per transaction. Each name must exactly match one of the categories above.

Transactions:
${batch.map((t, i) => `${i + 1}. ${t.description || ''} | ${t.counterparty || 'N/A'} | ${t.type} | ${t.amount_pesewas / 100} GHS`).join('\n')}

Response (JSON array only):`;

  try {
    const response = await ai.run('@cf/ibm-granite/granite-4.0-h-micro' as Parameters<Ai['run']>[0], {
      prompt,
      max_tokens: 500,
    });

    const text = typeof response === 'string' ? response : (response as { response?: string }).response || '';
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return transactions;

    const names: string[] = JSON.parse(jsonMatch[0]);
    const categoryMap = new Map(systemCategories.map(c => [c.name.toLowerCase(), c.id]));

    // Apply AI results
    const resultMap = new Map<RawTransaction, CategorizedTransaction>();
    batch.forEach((txn, i) => {
      if (i < names.length) {
        const catId = categoryMap.get(names[i]?.toLowerCase());
        if (catId) {
          resultMap.set(txn, { ...txn, category_id: catId, categorized_by: 'ai' as const });
        }
      }
    });

    return transactions.map(t => resultMap.get(t) || t);
  } catch {
    // Non-blocking: return as-is on failure
    return transactions;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx vitest run lib/categorize.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/categorize.ts apps/api/src/lib/categorize.test.ts
git commit -m "feat: add categorization pipeline (rules + AI fallback)"
```

---

## Chunk 4: API Routes

### Task 13: Categories API Routes

**Files:**
- Create: `apps/api/src/routes/categories.ts`

- [ ] **Step 1: Implement categories CRUD**

```typescript
// apps/api/src/routes/categories.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { generateId } from '../lib/db';
import { createCategorySchema, updateCategorySchema } from '@cedisense/shared';

const categories = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET / — list system defaults + user custom
categories.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY sort_order ASC'
  ).bind(userId).all();
  return c.json({ data: rows.results });
});

// POST / — create custom category
categories.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO categories (id, user_id, name, icon, color, type) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, parsed.data.name, parsed.data.icon || null, parsed.data.color || null, parsed.data.type).run();

  const category = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ data: category }, 201);
});

// PUT /:id — update user-owned only
categories.put('/:id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?'
  ).bind(categoryId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Category not found or not editable' } }, 404);
  }

  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.name !== undefined) { setClauses.push('name = ?'); values.push(parsed.data.name); }
  if (parsed.data.icon !== undefined) { setClauses.push('icon = ?'); values.push(parsed.data.icon); }
  if (parsed.data.color !== undefined) { setClauses.push('color = ?'); values.push(parsed.data.color); }
  if (parsed.data.type !== undefined) { setClauses.push('type = ?'); values.push(parsed.data.type); }

  if (setClauses.length === 0) {
    return c.json({ data: existing });
  }

  values.push(categoryId);
  await c.env.DB.prepare(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).first();
  return c.json({ data: updated });
});

// DELETE /:id — delete user-owned, reassign txns to uncategorized
categories.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?'
  ).bind(categoryId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Category not found or not deletable' } }, 404);
  }

  // Reassign transactions to uncategorized (NULL)
  await c.env.DB.prepare(
    'UPDATE transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?'
  ).bind(categoryId, userId).run();

  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();
  return c.body(null, 204);
});

export default categories;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/categories.ts
git commit -m "feat: add categories API routes"
```

---

### Task 14: Category Rules API Routes

**Files:**
- Create: `apps/api/src/routes/category-rules.ts`

- [ ] **Step 1: Implement category rules CRUD**

```typescript
// apps/api/src/routes/category-rules.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { generateId } from '../lib/db';
import { createCategoryRuleSchema } from '@cedisense/shared';

const categoryRules = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET / — list user's rules
categoryRules.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE user_id = ? ORDER BY priority DESC'
  ).bind(userId).all();
  return c.json({ data: rows.results });
});

// POST / — create rule
categoryRules.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createCategoryRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  // Verify category is valid (system or user-owned)
  const category = await c.env.DB.prepare(
    'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
  ).bind(parsed.data.category_id, userId).first();
  if (!category) {
    return c.json({ error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO category_rules (id, user_id, match_type, match_field, match_value, category_id, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, parsed.data.match_type, parsed.data.match_field, parsed.data.match_value, parsed.data.category_id, parsed.data.priority).run();

  const rule = await c.env.DB.prepare('SELECT * FROM category_rules WHERE id = ?').bind(id).first();
  return c.json({ data: rule }, 201);
});

// PUT /:id — update
categoryRules.put('/:id', async (c) => {
  const userId = c.get('userId');
  const ruleId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE id = ? AND user_id = ?'
  ).bind(ruleId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }, 404);
  }

  const body = await c.req.json();
  const parsed = createCategoryRuleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.match_type !== undefined) { setClauses.push('match_type = ?'); values.push(parsed.data.match_type); }
  if (parsed.data.match_field !== undefined) { setClauses.push('match_field = ?'); values.push(parsed.data.match_field); }
  if (parsed.data.match_value !== undefined) { setClauses.push('match_value = ?'); values.push(parsed.data.match_value); }
  if (parsed.data.category_id !== undefined) {
    // Verify category is valid (system or user-owned)
    const category = await c.env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
    ).bind(parsed.data.category_id, userId).first();
    if (!category) {
      return c.json({ error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, 400);
    }
    setClauses.push('category_id = ?'); values.push(parsed.data.category_id);
  }
  if (parsed.data.priority !== undefined) { setClauses.push('priority = ?'); values.push(parsed.data.priority); }

  if (setClauses.length === 0) return c.json({ data: existing });

  values.push(ruleId);
  await c.env.DB.prepare(
    `UPDATE category_rules SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM category_rules WHERE id = ?').bind(ruleId).first();
  return c.json({ data: updated });
});

// DELETE /:id
categoryRules.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const ruleId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE id = ? AND user_id = ?'
  ).bind(ruleId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM category_rules WHERE id = ?').bind(ruleId).run();
  return c.body(null, 204);
});

export default categoryRules;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/category-rules.ts
git commit -m "feat: add category rules API routes"
```

---

### Task 15: Transactions CRUD API Routes

**Files:**
- Create: `apps/api/src/routes/transactions.ts`

- [ ] **Step 1: Implement transaction CRUD**

```typescript
// apps/api/src/routes/transactions.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { generateId } from '../lib/db';
import { createTransactionSchema, updateTransactionSchema, transactionQuerySchema } from '@cedisense/shared';

const transactions = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST / — create single transaction (manual entry)
transactions.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  // Verify account ownership
  const account = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(parsed.data.account_id, userId).first();
  if (!account) {
    return c.json({ error: { code: 'INVALID_ACCOUNT', message: 'Account not found' } }, 400);
  }

  // Verify category if provided
  if (parsed.data.category_id) {
    const category = await c.env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
    ).bind(parsed.data.category_id, userId).first();
    if (!category) {
      return c.json({ error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, 400);
    }
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_pesewas, fee_pesewas, description, counterparty, transaction_date, source, categorized_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`
  ).bind(
    id, userId, parsed.data.account_id, parsed.data.category_id || null,
    parsed.data.type, parsed.data.amount_pesewas, parsed.data.fee_pesewas,
    parsed.data.description || null, parsed.data.counterparty || null,
    parsed.data.transaction_date,
    parsed.data.category_id ? 'user' : null,
  ).run();

  const txn = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(id).first();
  return c.json({ data: txn }, 201);
});

// GET / — list with filters + pagination
transactions.get('/', async (c) => {
  const userId = c.get('userId');
  const query = transactionQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: query.error.flatten() } }, 400);
  }

  const { account_id, category_id, type, from, to, search, page, limit } = query.data;

  let where = 'WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (account_id) { where += ' AND account_id = ?'; params.push(account_id); }
  if (category_id) { where += ' AND category_id = ?'; params.push(category_id); }
  if (type) { where += ' AND type = ?'; params.push(type); }
  if (from) { where += ' AND transaction_date >= ?'; params.push(from); }
  if (to) { where += ' AND transaction_date <= ?'; params.push(to); }
  if (search) {
    // Escape LIKE wildcards in user input
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    where += " AND (description LIKE ? ESCAPE '\\' OR counterparty LIKE ? ESCAPE '\\')";
    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  // Count total
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM transactions ${where}`
  ).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Fetch page
  const offset = (page - 1) * limit;
  const rows = await c.env.DB.prepare(
    `SELECT * FROM transactions ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    data: rows.results,
    meta: { total, page, limit },
  });
});

// GET /:id — single transaction
transactions.get('/:id', async (c) => {
  const userId = c.get('userId');
  const txnId = c.req.param('id');
  const txn = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(txnId, userId).first();
  if (!txn) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404);
  }
  return c.json({ data: txn });
});

// PUT /:id — update
transactions.put('/:id', async (c) => {
  const userId = c.get('userId');
  const txnId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(txnId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404);
  }

  const body = await c.req.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  // Verify category if changed
  if (parsed.data.category_id !== undefined && parsed.data.category_id !== null) {
    const category = await c.env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
    ).bind(parsed.data.category_id, userId).first();
    if (!category) {
      return c.json({ error: { code: 'INVALID_CATEGORY', message: 'Category not found' } }, 400);
    }
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  // Explicit per-field checks (no dynamic key construction)
  if (parsed.data.category_id !== undefined) {
    setClauses.push('category_id = ?', 'categorized_by = ?');
    values.push(parsed.data.category_id, 'user');
  }
  if (parsed.data.description !== undefined) { setClauses.push('description = ?'); values.push(parsed.data.description); }
  if (parsed.data.counterparty !== undefined) { setClauses.push('counterparty = ?'); values.push(parsed.data.counterparty); }
  if (parsed.data.amount_pesewas !== undefined) { setClauses.push('amount_pesewas = ?'); values.push(parsed.data.amount_pesewas); }
  if (parsed.data.fee_pesewas !== undefined) { setClauses.push('fee_pesewas = ?'); values.push(parsed.data.fee_pesewas); }
  if (parsed.data.type !== undefined) { setClauses.push('type = ?'); values.push(parsed.data.type); }
  if (parsed.data.transaction_date !== undefined) { setClauses.push('transaction_date = ?'); values.push(parsed.data.transaction_date); }

  if (setClauses.length === 0) return c.json({ data: existing });

  values.push(txnId);
  await c.env.DB.prepare(
    `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(txnId).first();
  return c.json({ data: updated });
});

// DELETE /:id
transactions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const txnId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(txnId, userId).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(txnId).run();
  return c.body(null, 204);
});

export default transactions;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/transactions.ts
git commit -m "feat: add transactions CRUD API routes"
```

---

### Task 16: Import API Routes

**Files:**
- Create: `apps/api/src/routes/import.ts`

- [ ] **Step 1: Implement import endpoints**

```typescript
// apps/api/src/routes/import.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { generateId } from '../lib/db';
import { importSmsSchema, importCsvSchema, importConfirmSchema } from '@cedisense/shared';
import { parseSMS } from '@cedisense/shared/sms';
import { parseCSV } from '@cedisense/shared/csv';
import { findDuplicates } from '../lib/dedup';
import { applyRules, categorizeWithAI, type CategorizedTransaction } from '../lib/categorize';
import type { RawTransaction, Transaction, CategoryRule } from '@cedisense/shared';

const importRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /sms — parse + dedup + categorize SMS messages
importRoutes.post('/sms', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importSmsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  // Parse all messages server-side
  const rawTransactions: RawTransaction[] = [];
  for (const msg of parsed.data.messages) {
    const result = parseSMS(msg);
    if (result) rawTransactions.push(result);
  }

  if (rawTransactions.length === 0) {
    return c.json({ error: { code: 'NO_PARSEABLE', message: 'No messages could be parsed' } }, 400);
  }

  const result = await processImport(c.env, userId, rawTransactions);
  return c.json({ data: result });
});

// POST /csv — parse + dedup + categorize CSV
importRoutes.post('/csv', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importCsvSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  let rawTransactions: RawTransaction[];
  try {
    rawTransactions = parseCSV(parsed.data.csv_text, parsed.data.format);
  } catch (e) {
    return c.json({ error: { code: 'PARSE_ERROR', message: (e as Error).message } }, 400);
  }

  if (rawTransactions.length === 0) {
    return c.json({ error: { code: 'NO_PARSEABLE', message: 'No transactions found in CSV' } }, 400);
  }

  const result = await processImport(c.env, userId, rawTransactions);
  return c.json({ data: result });
});

// POST /confirm — persist confirmed transactions
importRoutes.post('/confirm', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } }, 400);
  }

  // Retrieve import session from KV
  const kvKey = `import:${userId}:${parsed.data.import_id}`;
  const sessionData = await c.env.KV.get(kvKey, 'json') as {
    parsed: RawTransaction[];
    categorized: Array<RawTransaction & { category_id: string | null; categorized_by: string | null }>;
  } | null;

  if (!sessionData) {
    return c.json({ error: { code: 'IMPORT_EXPIRED', message: 'Import session expired. Please re-import.' } }, 400);
  }

  // Verify account ownership
  const account = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(parsed.data.account_id, userId).first<{ id: string }>();

  if (!account) {
    return c.json({ error: { code: 'INVALID_ACCOUNT', message: 'Account not found' } }, 400);
  }

  const { account_id, confirmed_indices, category_overrides, duplicate_decisions } = parsed.data;
  const batchId = generateId();

  // Collect transactions to insert
  const toInsert: Array<RawTransaction & { category_id: string | null; categorized_by: string | null }> = [];

  for (const idx of confirmed_indices) {
    if (idx < sessionData.categorized.length) {
      const txn = { ...sessionData.categorized[idx] };
      // Apply category overrides
      if (category_overrides && category_overrides[String(idx)]) {
        txn.category_id = category_overrides[String(idx)];
        txn.categorized_by = 'user';
      }
      toInsert.push(txn);
    }
  }

  // Handle duplicate decisions (import those marked as 'import')
  if (duplicate_decisions) {
    for (const [idxStr, decision] of Object.entries(duplicate_decisions)) {
      if (decision === 'import') {
        const idx = parseInt(idxStr, 10);
        if (idx < sessionData.categorized.length) {
          const txn = { ...sessionData.categorized[idx] };
          if (category_overrides && category_overrides[idxStr]) {
            txn.category_id = category_overrides[idxStr];
            txn.categorized_by = 'user';
          }
          toInsert.push(txn);
        }
      }
    }
  }

  // Batch insert
  const stmts = toInsert.map(txn => {
    const id = generateId();
    return c.env.DB.prepare(
      `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_pesewas, fee_pesewas, description, raw_text, counterparty, reference, source, categorized_by, transaction_date, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, userId, account_id, txn.category_id,
      txn.type, txn.amount_pesewas, txn.fee_pesewas,
      txn.description, txn.raw_text, txn.counterparty,
      txn.reference, txn.source, txn.categorized_by,
      txn.transaction_date, batchId,
    );
  });

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts);
  }

  // Clean up KV session
  await c.env.KV.delete(kvKey);

  return c.json({
    data: { imported: toInsert.length, batch_id: batchId },
  });
});

// Shared import processing logic — uses properly typed Hono context
async function processImport(
  env: Env,
  userId: string,
  rawTransactions: RawTransaction[],
): Promise<{
  import_id: string;
  parsed: CategorizedTransaction[];
  duplicates: Array<{ transaction: RawTransaction; existing: Transaction }>;
}> {
  // Fetch existing transactions for dedup
  const existingRows = await env.DB.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC LIMIT 5000'
  ).bind(userId).all();
  const existingTxns = (existingRows.results || []) as unknown as Transaction[];

  // Dedup
  const { clean, duplicates } = findDuplicates(rawTransactions, existingTxns);

  // Fetch user's category rules
  const rulesRows = await env.DB.prepare(
    'SELECT * FROM category_rules WHERE user_id = ? ORDER BY priority DESC'
  ).bind(userId).all();
  const rules = (rulesRows.results || []) as unknown as CategoryRule[];

  // Apply rules
  let categorized = applyRules(clean, rules);

  // AI fallback
  const categoriesRows = await env.DB.prepare(
    'SELECT id, name, type FROM categories WHERE user_id IS NULL'
  ).all();
  const systemCategories = (categoriesRows.results || []) as unknown as Array<{ id: string; name: string; type: string }>;

  categorized = await categorizeWithAI(categorized, systemCategories, env.AI);

  // Also categorize duplicates (for display)
  const allCategorized = [...categorized, ...applyRules(duplicates.map(d => d.transaction), rules)];

  // Store in KV with 15-minute TTL
  const importId = generateId();
  const kvKey = `import:${userId}:${importId}`;
  await env.KV.put(kvKey, JSON.stringify({
    parsed: rawTransactions,
    categorized: allCategorized,
  }), { expirationTtl: 900 });

  return {
    import_id: importId,
    parsed: categorized,
    duplicates: duplicates.map(d => ({
      transaction: d.transaction,
      existing: d.existing,
    })),
  };
}

export default importRoutes;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/import.ts
git commit -m "feat: add import API routes (SMS, CSV, confirm)"
```

---

### Task 17: Mount New Routes in index.ts

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add route imports and middleware**

Add to `apps/api/src/index.ts`:

```typescript
import categories from './routes/categories';
import categoryRules from './routes/category-rules';
import transactions from './routes/transactions';
import importRoutes from './routes/import';

// Add middleware for new routes (after existing middleware declarations)
app.use('/api/v1/categories/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/category-rules/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/transactions/*', authMiddleware, rateLimitMiddleware);

// Mount routes (after existing route declarations)
// IMPORTANT: import routes MUST be mounted BEFORE transactions router,
// otherwise /transactions/:id will catch /transactions/import as a param.
app.route('/api/v1/categories', categories);
app.route('/api/v1/category-rules', categoryRules);
app.route('/api/v1/transactions/import', importRoutes);
app.route('/api/v1/transactions', transactions);
```

- [ ] **Step 2: Verify type check passes**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: mount transaction, category, and import routes"
```

---

## Chunk 5: Frontend

### Task 18: Shared UI Components

**Files:**
- Create: `apps/web/src/components/transactions/TransactionRow.tsx`
- Create: `apps/web/src/components/transactions/CategoryPicker.tsx`
- Create: `apps/web/src/components/transactions/AmountInput.tsx`
- Create: `apps/web/src/components/transactions/ImportPreview.tsx`

- [ ] **Step 1: Create TransactionRow**

A reusable row component displaying: category icon, description/counterparty, account badge, formatted amount (green credit / red debit), fee if present. Used in both feed and import preview.

Props: `{ transaction: Transaction | RawTransaction; category?: Category; onClick?: () => void }`

- [ ] **Step 2: Create CategoryPicker**

A dropdown/bottom sheet for selecting a category. Fetches categories from API (or accepts as prop). Groups by type (income/expense/transfer). Shows icon + name.

Props: `{ value: string | null; onChange: (categoryId: string | null) => void; categories: Category[] }`

- [ ] **Step 3: Create AmountInput**

Numeric input that formats as GHS. Uses `inputMode="decimal"` for mobile keyboard. Stores value as pesewas internally.

Props: `{ value: number; onChange: (pesewas: number) => void; label?: string }`

- [ ] **Step 4: Create ImportPreview**

Shared preview list used by both SMS and CSV import tabs. Shows parsed transactions with editable category, duplicate flags with skip/import toggle.

Props: `{ parsed: RawTransaction[]; duplicates: ImportResult['duplicates']; categories: Category[]; onCategoryChange: (index: number, categoryId: string) => void; onDuplicateDecision: (index: number, decision: 'import' | 'skip') => void }`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/transactions/
git commit -m "feat: add TransactionRow, CategoryPicker, AmountInput components"
```

---

### Task 19: Transaction Feed Page

**Files:**
- Create: `apps/web/src/pages/TransactionFeedPage.tsx`

- [ ] **Step 1: Implement feed page**

Features:
- Filter bar (account, category, date range, search)
- Fetch transactions via `GET /api/v1/transactions` with query params
- Group by date ("Today", "Yesterday", "March 11, 2026")
- Render using `TransactionRow` component
- Infinite scroll using page/limit params
- Tap row → expand inline with edit/delete actions
- Empty state with CTAs for "Add Manually" and "Import SMS"
- Use `formatPesewas()` for amounts

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/TransactionFeedPage.tsx
git commit -m "feat: add transaction feed page with filters and infinite scroll"
```

---

### Task 20: Add Transaction Page

**Files:**
- Create: `apps/web/src/pages/AddTransactionPage.tsx`

- [ ] **Step 1: Implement manual entry form**

Features:
- AmountInput (₵, pesewas-based)
- Type toggle: income / expense / transfer (segmented control)
- Account selector (fetch from `GET /api/v1/accounts`)
- CategoryPicker
- Description text input
- Counterparty text input (optional)
- Date input (defaults to today)
- Submit → `POST /api/v1/transactions`
- On success → navigate to `/transactions` with success toast

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/AddTransactionPage.tsx
git commit -m "feat: add manual transaction entry page"
```

---

### Task 21: Import Page

**Files:**
- Create: `apps/web/src/pages/ImportPage.tsx`

- [ ] **Step 1: Implement import flow with two tabs**

**SMS Tab:**
- Large textarea for pasting messages
- "Parse" button → calls `POST /api/v1/transactions/import/sms`
- Preview list using `TransactionRow` + `CategoryPicker` per row
- Duplicate flags with "Skip" / "Import Anyway" toggle
- "Confirm Import" button → `POST /api/v1/transactions/import/confirm`
- Success toast with count → redirect to `/transactions`

**CSV Tab:**
- File input (accept=".csv")
- Provider format dropdown (fetch formats from shared package)
- "Parse" button → read file, call `POST /api/v1/transactions/import/csv`
- Same preview + confirm flow as SMS

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/ImportPage.tsx
git commit -m "feat: add import page with SMS and CSV tabs"
```

---

### Task 22: Wire Up Routes + Update Exports

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update App.tsx routing**

Replace placeholder routes for `/transactions`, `/add`, and add `/transactions/import`:

```typescript
import TransactionFeedPage from './pages/TransactionFeedPage';
import AddTransactionPage from './pages/AddTransactionPage';
import ImportPage from './pages/ImportPage';

// In the protected AppShell routes:
<Route path="/transactions" element={<TransactionFeedPage />} />
<Route path="/add" element={<AddTransactionPage />} />
<Route path="/transactions/import" element={<ImportPage />} />
```

- [ ] **Step 2: Update shared barrel exports**

In `packages/shared/src/index.ts`, add exports for:
- All new types from `types.ts` (Category, Transaction, RawTransaction, SMSPattern, CategoryRule, CSVFormat, ImportResult, and all union types)
- All new schemas from `schemas.ts`
- `formatPesewas`, `toPesewas`, `toGHS` from `format.ts`
- `parseSMS`, `parseGhanaDate`, `ALL_PATTERNS` from `sms/index.ts`
- `parseCSV`, `getCSVFormats`, `CSV_FORMATS` from `csv/index.ts`

```typescript
// Add to packages/shared/src/index.ts:
export * from './sms/index';
export * from './csv/index';
```

- [ ] **Step 3: Run full type check**

Run: `cd packages/shared && npx tsc --noEmit`
Run: `cd apps/api && npx tsc --noEmit`
Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx packages/shared/src/index.ts
git commit -m "feat: wire up transaction routes, update shared exports"
```

---

### Task 23: End-to-End Verification

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev` (or `turbo dev`)

- [ ] **Step 2: Apply migration**

Run: `cd apps/api && npx wrangler d1 execute cedisense-db --local --file=migrations/0002_transactions.sql`

- [ ] **Step 3: Verify API endpoints**

Test each endpoint manually via browser/curl:
- `GET /api/v1/categories` — should return 18 system defaults
- `POST /api/v1/transactions` — create a manual transaction
- `GET /api/v1/transactions` — should list the transaction
- `POST /api/v1/transactions/import/sms` — test with a sample MTN MoMo SMS

- [ ] **Step 4: Verify frontend pages**

- Navigate to `/transactions` — should show empty state or the manual transaction
- Navigate to `/add` — fill form, submit, verify it appears in feed
- Navigate to `/transactions/import` — paste sample SMS, verify parsing and confirm flow

- [ ] **Step 5: Run all tests**

Run: `pnpm test` (or `turbo test`)
Expected: All tests pass.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
