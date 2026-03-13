# CediSense — Subsystem 1: Project Scaffolding + Auth

**Date:** 2026-03-13
**Author:** Ozzy (Hodges & Co. Limited)
**Status:** Approved

---

## 1. Overview

This spec covers the first subsystem of CediSense: project scaffolding, authentication, onboarding wizard, and the app shell. Everything else (transactions, SMS parsing, dashboard, AI chat, budgets, goals) will be built as subsequent subsystems, each with their own spec → plan → build cycle.

## 2. Global Decisions (Apply to All Subsystems)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build approach | Subsystem-by-subsystem | Natural boundaries in the plan; deploy and test incrementally |
| Worker architecture | Single Hono Worker, modular routes | Simplicity now; extract via Service Bindings later if needed |
| Auth extensibility | Full (PIN now, WebAuthn/OTP/social later) | Fintech product needs room to grow auth methods |
| UI components | Tailwind + shadcn/ui | Accessible, themed, copy-paste ownership |
| Charts | Chart.js + react-chartjs-2 | Canvas perf on mid-range Android; smaller bundle for mobile data |
| Monetization | None at MVP | Focus on value and users first |
| PWA scope | Install-only (asset caching) | Offline-first is Phase 3; installable PWA is sufficient for MVP |
| Onboarding | 3-step guided wizard | Solve the empty dashboard problem; 60 seconds, every step skippable |

## 3. Project Structure

```
cedisense/
├── apps/
│   ├── web/                          ← React 18 + Vite + TypeScript
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/               ← shadcn/ui components (themed)
│   │   │   │   ├── layout/           ← Shell, BottomNav, TopBar, SideNav
│   │   │   │   └── onboarding/       ← Wizard steps
│   │   │   ├── pages/                ← Route pages
│   │   │   ├── hooks/                ← useAuth, useApi
│   │   │   ├── lib/                  ← API client, formatGHS, date utils
│   │   │   ├── contexts/             ← AuthContext, ThemeContext
│   │   │   ├── styles/               ← Tailwind config, Ghana theme tokens
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   ├── manifest.json         ← PWA manifest
│   │   │   ├── sw.js                 ← Service worker (asset cache only)
│   │   │   └── icons/                ← App icons (Ghana-themed)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          ← Hono on Cloudflare Workers
│       ├── src/
│       │   ├── index.ts              ← Hono app entry, mount route groups
│       │   ├── routes/
│       │   │   ├── auth.ts           ← /api/auth/*
│       │   │   ├── users.ts          ← /api/users/*
│       │   │   └── accounts.ts       ← /api/accounts/*
│       │   ├── middleware/
│       │   │   ├── auth.ts           ← JWT verification middleware
│       │   │   ├── cors.ts           ← CORS config
│       │   │   └── rate-limit.ts     ← KV-based rate limiting
│       │   ├── lib/
│       │   │   ├── db.ts             ← D1 query helpers (prepared statements only)
│       │   │   ├── jwt.ts            ← Token sign/verify/refresh
│       │   │   └── hash.ts           ← PIN hashing (PBKDF2 via Web Crypto)
│       │   └── types.ts              ← Hono env bindings type
│       ├── migrations/
│       │   ├── 0001_initial_schema.sql
│       │   └── 0002_seed_categories.sql
│       ├── wrangler.toml
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types.ts              ← User, Account, AuthMethod types
│       │   ├── schemas.ts            ← Zod validation schemas
│       │   ├── constants.ts          ← Providers, account types
│       │   └── format.ts             ← formatGHS(), parsePhone()
│       ├── tsconfig.json
│       └── package.json
│
├── turbo.json                        ← Build pipeline config
├── pnpm-workspace.yaml               ← Workspace definition
├── package.json                      ← Root scripts
├── .gitignore
└── .nvmrc                            ← Node 20 LTS
```

### Tooling

| Tool | Purpose |
|------|---------|
| pnpm | Package manager (workspaces) |
| Turborepo | Build orchestration (parallel builds) |
| TypeScript | Strict mode across all packages |
| Vite | Frontend bundler |
| Hono | Workers API router |
| Zod | Shared validation schemas |
| shadcn/ui | UI component library (copy-paste, themed) |
| Tailwind CSS | Utility-first styling |
| Chart.js + react-chartjs-2 | Dashboard charts (future subsystem) |

## 4. Database Schema (Subsystem 1)

Only tables needed for auth + onboarding. Transaction, budget, goal, AI, and SMS tables are deferred to their respective subsystems.

```sql
-- Migration 0001: Auth & Core Tables

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phone TEXT UNIQUE NOT NULL,              -- Normalized: 0XXXXXXXXX
  name TEXT NOT NULL,
  monthly_income_ghs REAL,                -- Set during onboarding wizard
  preferred_language TEXT DEFAULT 'en',
  onboarding_completed INTEGER DEFAULT 0, -- 0 = show wizard
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Auth Methods (extensible: pin now, webauthn/otp/social later)
CREATE TABLE auth_methods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                      -- 'pin' | 'webauthn' | 'otp' | 'google' | 'apple'
  credential TEXT NOT NULL,                -- PIN: JSON {hash, salt}
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Accounts (needed for onboarding step 2)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                      -- 'momo' | 'bank' | 'cash' | 'susu'
  provider TEXT,                           -- 'mtn' | 'vodafone' | 'airteltigo' | 'gcb' | etc.
  account_number TEXT,                     -- Masked: ****1234
  balance_ghs REAL DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_auth_methods_user ON auth_methods(user_id);
CREATE INDEX idx_accounts_user ON accounts(user_id);
```

### Changes from Original Plan

- `pin_hash` removed from `users` → moved to `auth_methods.credential` as JSON `{hash, salt}`
- `email` removed from `users` → not needed for MVP; phone is the identifier
- `onboarding_completed` added to `users` → controls wizard display
- `auth_methods` table added → extensible auth without schema changes
- `ON DELETE CASCADE` on foreign keys → clean user deletion

## 5. Auth System

### Token Strategy

| Token | Storage | Lifetime | Format | Purpose |
|-------|---------|----------|--------|---------|
| Access Token | Memory only (React state) | 15 minutes | JWT (HMAC-SHA256) | API authorization via Bearer header |
| Refresh Token | httpOnly cookie (Secure, SameSite=Strict) | 30 days | Opaque (random bytes, stored in KV) | Silent token renewal |

### PIN Hashing

- Algorithm: PBKDF2-SHA256 via Web Crypto API (native to Workers, no bcrypt/Node.js compat needed)
- Iterations: 100,000
- Salt: 16 random bytes per user
- Stored as JSON in `auth_methods.credential`: `{"hash": "<base64>", "salt": "<base64>"}`

### Rate Limiting

- **Login attempts:** 5 failed PINs per phone number → 15 minute lockout
- **Implementation:** KV key `rate:login:{phone}` with value = attempt count, TTL = 900 seconds
- **On success:** Delete the KV key
- **General API:** 100 requests/minute per authenticated user (KV sliding window)

### Refresh Token Rotation

1. Client sends POST `/api/auth/refresh` (cookie attached automatically)
2. Server reads refresh token from cookie
3. Looks up token in KV — if missing/expired, return 401
4. **Deletes old token from KV** (single-use)
5. Generates new access token + new refresh token
6. Stores new refresh token in KV, sets new cookie
7. Returns new access token

If a deleted token is reused, it indicates potential compromise — future enhancement could revoke all tokens for that user.

## 6. API Endpoints

### Auth Routes (public)

```
POST   /api/auth/register
  Body: { phone, name, pin }
  Response: { accessToken, user: { id, name, phone } }
  Cookie: refreshToken (httpOnly, Secure, SameSite=Strict)

POST   /api/auth/login
  Body: { phone, pin }
  Response: { accessToken, user }
  Cookie: refreshToken

POST   /api/auth/refresh
  Body: (none — reads cookie)
  Response: { accessToken }
  Cookie: new refreshToken

POST   /api/auth/logout
  Body: (none)
  Response: 204
  Cookie: cleared
```

### User Routes (protected)

```
GET    /api/users/me
  Response: { id, name, phone, monthly_income_ghs, preferred_language, onboarding_completed }

PUT    /api/users/me
  Body: { name?, monthly_income_ghs?, preferred_language? }
  Response: updated user

PUT    /api/users/me/onboarding
  Body: { completed: true }
  Response: 204
```

### Account Routes (protected)

```
POST   /api/accounts
  Body: { name, type, provider?, account_number?, balance_ghs?, is_primary? }
  Response: account
  Note: If is_primary=true, unsets other primary accounts for this user

GET    /api/accounts
  Response: account[]

PUT    /api/accounts/:id
  Body: { name?, balance_ghs?, is_primary? }
  Response: updated account

DELETE /api/accounts/:id
  Response: 204
  Note: Prevents deleting last account
```

### Middleware Stack

Applied to all `/api/*` except `/api/auth/*`:

1. **CORS** — Allowlist: `cedisense.com`, `localhost:5173`
2. **JWT verification** — Extracts Bearer token, verifies signature, injects `userId` into Hono context
3. **Rate limiting** — 100 requests/minute per user via KV sliding window

## 7. Shared Validation Schemas (Zod)

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

const ghanaPhoneRegex = /^0[235]\d{8}$/;

export const registerSchema = z.object({
  phone: z.string().regex(ghanaPhoneRegex, 'Invalid Ghana phone number'),
  name: z.string().min(2).max(100),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const loginSchema = z.object({
  phone: z.string().regex(ghanaPhoneRegex),
  pin: z.string().regex(/^\d{4}$/),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  monthly_income_ghs: z.number().min(0).optional(),
  preferred_language: z.enum(['en', 'tw', 'ee', 'dag']).optional(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['momo', 'bank', 'cash', 'susu']),
  provider: z.string().max(50).optional(),
  account_number: z.string().max(20).optional(),
  balance_ghs: z.number().min(0).default(0),
  is_primary: z.boolean().default(false),
});
```

## 8. Frontend Architecture (Subsystem 1)

### App Shell

- **Mobile (< 768px):** Bottom navigation with 5 items — Home, Transactions, Add (+, elevated), AI Chat, More
- **Tablet/Desktop (>= 768px):** Persistent sidebar, collapsible to icons between 768-1024px
- **Top bar (mobile):** CediSense ₵ logo + user avatar/initials

### Route Guards (3-state)

1. No access token → redirect to `/login`
2. Token present but `onboarding_completed = 0` → redirect to `/onboarding`
3. Token + onboarded → allow protected routes

### AuthContext

- On mount: check for access token in memory
- If expired: attempt silent refresh via `POST /api/auth/refresh` (cookie auto-attached)
- If refresh fails: clear state, redirect to `/login`
- Provides: `user`, `isAuthenticated`, `isLoading`, `login()`, `register()`, `logout()`

### Routes (Subsystem 1)

| Route | Component | Auth | Notes |
|-------|-----------|------|-------|
| `/login` | LoginPage | Public | Phone + PIN form |
| `/register` | RegisterPage | Public | Phone + Name + PIN form |
| `/onboarding` | OnboardingWizard | Protected | 3-step wizard, only if not completed |
| `/` | DashboardPage | Protected | Placeholder — built in subsystem 3 |
| `/transactions` | TransactionsPage | Protected | Placeholder — built in subsystem 2 |
| `/budgets` | BudgetsPage | Protected | Placeholder |
| `/ai-chat` | AIChatPage | Protected | Placeholder |
| `/settings` | SettingsPage | Protected | Profile edit, logout |

### Onboarding Wizard

**3 steps, each skippable:**

1. **Your Income** — Amount input with quick-select chips (₵1,000 / ₵2,500 / ₵5,000 / ₵10,000). Calls `PUT /api/users/me` with `monthly_income_ghs`.
2. **Your Main Account** — Select account type (MTN MoMo, Vodafone Cash, AirtelTigo, GCB, Ecobank, Fidelity, Stanbic, Cash). Calls `POST /api/accounts` with `is_primary: true`.
3. **First Transaction** — Choose "Paste MoMo SMS" or "Enter Manually." Both options set `onboarding_completed = 1` via `PUT /api/users/me/onboarding`. SMS paste → SMS import flow (future subsystem). Manual → transaction form (future subsystem). At MVP, both lead to the dashboard with a "Coming in next update" note or a simplified manual entry form.

**Resume behaviour:** Each step persists via its own API call. If user drops off at step 2, on next login the wizard checks: has income? → skip step 1. Has account? → skip step 2. `onboarding_completed = 0` → show remaining steps.

## 9. Ghana Theme

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--gold` | `#D4A843` | Primary accent, CTAs, active nav items |
| `--green` | `#006B3F` | Secondary accent, success states, buttons |
| `--black` | `#1A1A1A` | Background base |
| `--dark` | `#111111` | Content area background |
| `--surface` | `#1A1A2E` | Cards, nav, elevated surfaces |
| `--white` | `#FFFFFF` | Primary text on dark |
| `--muted` | `#888888` | Secondary text |
| `--income` | `#4ADE80` | Income amounts (green) |
| `--expense` | `#F87171` | Expense amounts (red) |

### Typography

- Font: Inter (clean, readable on mobile, good GHS ₵ rendering)
- Scale: 12/13/14/16/18/24/28px
- GHS format: `₵1,234.56` — cedi sign prefix, comma thousands, 2 decimal places

## 10. Wrangler Configuration

```toml
# apps/api/wrangler.toml
name = "cedisense-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "cedisense-db"
database_id = "<your-d1-id>"

[[kv_namespaces]]
binding = "KV"
id = "<your-kv-id>"

[[r2_buckets]]
binding = "R2"
bucket_name = "cedisense-uploads"
```

## 11. Security Checklist

- [x] PIN hashing: PBKDF2-SHA256, 100K iterations, random salt (Web Crypto)
- [x] Access token: memory only, never localStorage (XSS-safe)
- [x] Refresh token: httpOnly cookie, Secure, SameSite=Strict (CSRF-safe)
- [x] Refresh rotation: single-use tokens, old token invalidated on refresh
- [x] Rate limiting: 5 failed PINs → 15min lockout per phone
- [x] API rate limiting: 100 req/min per user
- [x] Phone normalization: validate Ghana format, strip spaces/dashes
- [x] Input validation: Zod schemas on both client and server
- [x] SQL: prepared statements only, never string concatenation
- [x] CORS: explicit allowlist, not wildcard
- [x] No secrets in JWT payload: only userId, phone, name

## 12. Out of Scope (Deferred to Later Subsystems)

- Transaction CRUD, SMS parsing, CSV/PDF import → Subsystem 2
- Dashboard charts, spending insights → Subsystem 3
- AI chat advisor, Workers AI integration → Subsystem 4
- Budgets & savings goals → Subsystem 5
- Categories table & seeding → Subsystem 2 (needed alongside transactions)
- Monetization tiers, Paystack → Post-MVP
- Offline data sync → Phase 3
- Multi-language support → Phase 3
