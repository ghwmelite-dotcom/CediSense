# Subsystem 2: Transaction CRUD, SMS Parsing & CSV Import — Design Spec

**Date:** 2026-03-13
**Status:** Approved
**Depends on:** Subsystem 1 (Scaffolding + Auth)

---

## Overview

Subsystem 2 adds transaction management to CediSense — the core data layer that everything else (dashboard, budgets, AI chat) builds on. Users can enter transactions manually, bulk-import from SMS messages, or upload CSV bank statements. A categorization pipeline (rule-based + AI fallback) auto-assigns categories to imported transactions.

## Scope

**In scope:**
- Transaction CRUD (create, read, update, delete)
- SMS parsing engine — MTN MoMo, Vodafone Cash, AirtelTigo Money, 8 Ghanaian banks
- CSV import with provider-specific format definitions
- Category system with 18 Ghana-contextualized defaults + user custom categories
- Category rules engine (contains/exact/regex matching)
- AI auto-categorization via Granite Micro (Workers AI) as fallback
- Duplicate detection with user decision on flagged items
- Chronological transaction feed with filters

**Out of scope (deferred):**
- PDF statement parsing (future subsystem)
- Dashboard charts and spending insights (Subsystem 3)
- Budget and savings goals (Subsystem 5)
- MoMo API integration (Phase 3+)

---

## Architecture: Source-Specific Parsers + Shared Post-Processing

Each ingestion source has its own parser that produces a common `RawTransaction` shape. Shared post-processing handles deduplication and categorization.

```
SMS Parser  ─┐
CSV Parser  ─┼→ RawTransaction[] → Dedup → Categorize (rules → AI) → Review → Persist
Manual Form ─┘
```

Parsers are isolated and independently testable. Categorization and dedup logic is shared across all sources. Manual entry can skip dedup (no reference ID to check against).

---

## Database Schema

New migration: `0002_transactions.sql`

### `categories`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NULL (NULL = system default) FK → users |
| name | TEXT | NOT NULL |
| icon | TEXT | emoji |
| color | TEXT | hex color |
| type | TEXT | NOT NULL: `income` \| `expense` \| `transfer` |
| parent_id | TEXT | NULL, FK → categories (for future subcategories) |
| sort_order | INTEGER | DEFAULT 0 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

- UNIQUE constraint on `(user_id, name)` — prevents duplicate category names per user
- System defaults (user_id = NULL) seeded via INSERT statements

**18 System Default Categories:**

Expense: Food & Groceries, Transport, Utilities, Rent & Housing, Health, Education, Church/Tithe, Family Support, Mobile Money Fees, Shopping, Entertainment

Income: Salary, Business Income, Remittance Received, MoMo Transfer In, Side Hustle, Interest/Returns

Transfer: Savings/Susu

### `transactions`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NOT NULL, FK → users |
| account_id | TEXT | NOT NULL, FK → accounts |
| category_id | TEXT | NULL, FK → categories |
| type | TEXT | NOT NULL: `credit` \| `debit` \| `transfer` |
| amount_ghs | REAL | NOT NULL |
| fee_ghs | REAL | DEFAULT 0 |
| description | TEXT | |
| raw_text | TEXT | original SMS or CSV row |
| counterparty | TEXT | |
| reference | TEXT | MoMo transaction ID, bank ref |
| source | TEXT | NOT NULL: `sms_import` \| `csv_import` \| `manual` |
| categorized_by | TEXT | `ai` \| `user` \| `rule` \| NULL |
| transaction_date | TEXT | NOT NULL, ISO 8601 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

**Indexes:**
- `idx_txn_user_date` on `(user_id, transaction_date DESC)` — feed queries
- `idx_txn_user_category` on `(user_id, category_id)` — category filter
- `idx_txn_user_reference` on `(user_id, reference)` — dedup lookups

### `sms_patterns`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| provider | TEXT | NOT NULL (e.g., `mtn_momo`, `vodafone_cash`, `gcb_bank`) |
| pattern_name | TEXT | NOT NULL (e.g., `mtn_cash_out`) |
| pattern_regex | TEXT | NOT NULL |
| transaction_type | TEXT | NOT NULL: `credit` \| `debit` \| `transfer` |
| field_mapping | TEXT | NOT NULL, JSON mapping regex groups → fields |
| sample_sms | TEXT | example message for testing |
| is_active | INTEGER | DEFAULT 1 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

Seeded with patterns for all providers.

### `category_rules`

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NOT NULL, FK → users |
| match_type | TEXT | NOT NULL: `contains` \| `exact` \| `regex` |
| match_field | TEXT | NOT NULL: `counterparty` \| `description` |
| match_value | TEXT | NOT NULL |
| category_id | TEXT | NOT NULL, FK → categories |
| priority | INTEGER | DEFAULT 0 (higher = checked first) |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

**Index:** `idx_rules_user_priority` on `(user_id, priority DESC)`

---

## SMS Parsing Engine

Lives in `packages/shared/src/sms/` — usable by both API (authoritative parsing) and frontend (instant preview).

### Core Interface

```typescript
interface RawTransaction {
  amount_ghs: number
  fee_ghs: number
  type: 'credit' | 'debit' | 'transfer'
  counterparty: string | null
  reference: string | null
  balance_after: number | null
  transaction_date: string        // ISO 8601
  description: string             // auto-generated from parsed fields
  raw_text: string                // original SMS
  source: 'sms_import' | 'csv_import' | 'manual'
  provider: string                // e.g., 'mtn_momo'
}
```

### Entry Point

```typescript
parseSMS(text: string): RawTransaction | null
```

Iterates registered patterns until one matches. Returns null if no pattern matches.

### Pattern Organization

- `packages/shared/src/sms/providers/mtn-momo.ts` — ~6 patterns (cash-out, transfer sent/received, payment, airtime, cash-in)
- `packages/shared/src/sms/providers/vodafone-cash.ts` — ~5 patterns (send, receive, payment, withdrawal, deposit)
- `packages/shared/src/sms/providers/airteltigo.ts` — ~4 patterns (transfer, receive, withdrawal, payment)
- `packages/shared/src/sms/providers/gcb.ts`, `ecobank.ts`, `fidelity.ts`, `stanbic.ts`, `absa.ts`, `calbank.ts`, `uba.ts`, `zenith.ts` — ~2 patterns each (credit alert, debit alert)
- `packages/shared/src/sms/registry.ts` — exports all patterns in priority order (MoMo providers first)

### Date Parsing

`parseGhanaDate(dateStr: string): string` — handles common formats:
- `DD/MM/YYYY`, `DD-MM-YYYY`
- `DD-Mon-YYYY` (e.g., `12-Mar-2026`)
- `YYYY-MM-DD`
- Falls back to current date if unparseable

### Bulk Import Flow

1. User pastes multiple SMS messages in textarea
2. Frontend calls `parseSMS()` on each for instant preview
3. User submits to `POST /api/v1/transactions/import/sms`
4. API re-parses server-side (never trusts client parsing)
5. Runs through dedup + categorization pipeline
6. Returns results with duplicate flags for user review
7. User confirms → `POST /api/v1/transactions/import/confirm`

---

## CSV Import

### Core Interface

```typescript
parseCSV(text: string, format: CSVFormat): RawTransaction[]
```

### CSVFormat Definition

```typescript
interface CSVFormat {
  provider: string
  label: string                   // e.g., 'GCB Bank Statement'
  delimiter: ',' | ';' | '\t'
  hasHeader: boolean
  columnMap: {
    date: string | number
    description: string | number
    amount: string | number       // single column (negative = debit)
    debit?: string | number       // or separate debit/credit columns
    credit?: string | number
    reference?: string | number
    balance?: string | number
  }
  dateFormat: string              // e.g., 'DD/MM/YYYY'
}
```

### Flow

1. User uploads `.csv` file — read client-side (no R2 needed, CSV is small text)
2. User selects bank/provider format from dropdown
3. Frontend parses and shows preview table
4. User confirms → `POST /api/v1/transactions/import/csv` with parsed data
5. Same dedup + categorization pipeline as SMS
6. User reviews and confirms

### Format Files

One format definition per provider in `packages/shared/src/csv/formats/`:
- MTN MoMo, Vodafone Cash, AirtelTigo
- GCB, Ecobank, Fidelity, Stanbic, Absa, CalBank, UBA, Zenith

---

## Categorization Pipeline

Runs server-side after parsing, before returning results to user.

### Step 1: Rule Matching

1. Fetch user's category rules ordered by `priority DESC`
2. For each uncategorized transaction, check rules against target field (`counterparty` or `description`)
3. Match types: `contains` (case-insensitive substring), `exact` (case-insensitive equality), `regex`
4. First matching rule wins → set `category_id`, `categorized_by = 'rule'`

### Step 2: AI Fallback (Granite Micro via Workers AI)

1. Collect all still-uncategorized transactions after rule matching
2. Batch into a single Workers AI call
3. Prompt includes: system category list + transaction description/counterparty/amount/type
4. Returns suggested `category_id` per transaction → set `categorized_by = 'ai'`
5. If AI call fails or times out → transactions remain uncategorized (non-blocking)

### Step 3: User Review

1. Import results returned to frontend with categories pre-filled
2. User can override any category before confirming
3. Manual overrides set `categorized_by = 'user'`
4. When user recategorizes, offer "Always categorize [counterparty] as [category]?" → auto-creates a rule

---

## API Endpoints

All under `/api/v1/`, protected by `authMiddleware`. Prepared statements only. Response envelope: `{ data: T, meta?: {...} }` or `{ error: { code, message, details? } }`.

### Transaction CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST | `/transactions` | Create single transaction (manual entry) |
| GET | `/transactions` | List with filters (see below) |
| GET | `/transactions/:id` | Single transaction detail |
| PUT | `/transactions/:id` | Update transaction |
| DELETE | `/transactions/:id` | Delete transaction |

**GET `/transactions` query params:**
- `account_id` — filter by account
- `category_id` — filter by category
- `type` — `credit` \| `debit` \| `transfer`
- `from` / `to` — date range (ISO 8601)
- `search` — substring match on description/counterparty
- `page` / `limit` — pagination (default limit 50)
- Response includes `meta: { total, page, limit }`

### Import Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/transactions/import/sms` | Parse + dedup + categorize SMS messages |
| POST | `/transactions/import/csv` | Parse + dedup + categorize CSV rows |
| POST | `/transactions/import/confirm` | Persist confirmed transactions |

**Import request/response:**

`POST /transactions/import/sms` request:
```json
{ "messages": ["SMS text 1", "SMS text 2", ...] }
```

`POST /transactions/import/csv` request:
```json
{ "rows": [RawTransaction, ...] }
```

Import response (both endpoints):
```json
{
  "data": {
    "parsed": [RawTransaction, ...],
    "duplicates": [
      { "transaction": RawTransaction, "existing": Transaction }
    ]
  }
}
```

`POST /transactions/import/confirm` request:
```json
{
  "transactions": [RawTransaction, ...],
  "skipped_duplicates": ["reference1", "reference2"]
}
```

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | List system defaults + user custom |
| POST | `/categories` | Create custom category |
| PUT | `/categories/:id` | Update (user-owned only) |
| DELETE | `/categories/:id` | Delete (user-owned only, reassign txns to uncategorized) |

### Category Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/category-rules` | List user's rules |
| POST | `/category-rules` | Create rule |
| PUT | `/category-rules/:id` | Update rule |
| DELETE | `/category-rules/:id` | Delete rule |

---

## Frontend

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/transactions` | TransactionFeed | Chronological feed with filters |
| `/add` | AddTransaction | Manual entry form |
| `/transactions/import` | ImportFlow | SMS paste + CSV upload |

### Transaction Feed (`/transactions`)

- Filter bar: account selector, category selector, date range, search input
- Transactions grouped by date ("Today", "Yesterday", "March 11, 2026")
- Each row: category icon, description/counterparty, account badge, amount (green credit / red debit), fee if present
- Tap row → inline expand or bottom sheet with full details + edit/delete
- Infinite scroll (not paginated buttons — mobile-first)
- Empty state: illustration + "No transactions yet" with CTAs for "Add Manually" and "Import SMS"

### Manual Entry (`/add`)

- Fields: amount (₵), type toggle (income/expense/transfer), account selector, category selector, description, counterparty (optional), date (defaults to today)
- Numeric keypad-friendly amount input, auto-formats with `formatGHS()`
- After save → redirect to `/transactions` with success toast

### Import Flow (`/transactions/import`)

- Two tabs: "SMS Messages" and "CSV File"
- **SMS tab:** large textarea, "Parse" button → preview list with parsed fields, duplicate flags inline with "Skip" / "Import Anyway" toggle per item, editable category dropdown, "Confirm Import" button
- **CSV tab:** file input (`.csv` only), provider format dropdown, "Parse" button → same preview + confirm flow
- After confirm → redirect to `/transactions` with summary toast ("12 imported, 3 skipped")

### Category Management

- Accessible from Settings or inline when editing transaction category
- Modal/bottom sheet — not a standalone page
- List categories, add custom, edit/delete user-owned
- "Create rule" prompt on manual recategorization

### Shared Components

- `TransactionRow` — reusable row for feed and import preview
- `CategoryPicker` — dropdown/bottom sheet for category selection
- `AmountInput` — formatted GHS input with numeric keyboard hint
- `ImportPreview` — shared preview list for both SMS and CSV tabs

---

## Validation Schemas (Zod)

Added to `packages/shared/src/schemas.ts`:

- `createTransactionSchema` — amount (> 0), type, account_id, category_id?, description?, counterparty?, transaction_date
- `updateTransactionSchema` — partial of create + category_id
- `importSmsSchema` — { messages: string[] (min 1, max 500) }
- `importCsvSchema` — { rows: RawTransaction[] (min 1, max 2000) }
- `importConfirmSchema` — { transactions: RawTransaction[], skipped_duplicates: string[] }
- `createCategorySchema` — name (1-50 chars), icon?, color?, type
- `updateCategorySchema` — partial of create
- `createCategoryRuleSchema` — match_type, match_field, match_value, category_id, priority?

## Types

Added to `packages/shared/src/types.ts`:

- `Category`, `Transaction`, `RawTransaction`, `SMSPattern`, `CategoryRule`, `CSVFormat`
- `TransactionType = 'credit' | 'debit' | 'transfer'`
- `TransactionSource = 'sms_import' | 'csv_import' | 'manual'`
- `CategorizedBy = 'ai' | 'user' | 'rule'`
- `MatchType = 'contains' | 'exact' | 'regex'`
- `MatchField = 'counterparty' | 'description'`
