# CediSense Subsystem 1: Scaffolding + Auth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the CediSense monorepo, Cloudflare Workers API with Hono, React/Vite frontend with Ghana-themed shadcn/ui, phone+PIN authentication with JWT, and a 3-step onboarding wizard.

**Architecture:** pnpm monorepo with Turborepo. `apps/web` (React/Vite on Cloudflare Pages) and `apps/api` (Hono Worker on Cloudflare Workers) share types/schemas via `packages/shared`. Single Worker handles all API routes under `/api/v1/`. Auth uses short-lived JWTs (memory) + refresh tokens (httpOnly cookie, KV-backed with SHA-256 hashing).

**Tech Stack:** TypeScript (strict), React 18, Vite, Hono, Cloudflare Workers/D1/KV/R2, Tailwind CSS, shadcn/ui, Zod, Vitest, Web Crypto API (PBKDF2)

**Spec:** `docs/superpowers/specs/2026-03-13-scaffolding-auth-design.md`

---

## Chunk 1: Monorepo Scaffolding & Shared Package

### Task 1: Initialize Monorepo Root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.nvmrc`
- Modify: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "cedisense",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 4: Create `.nvmrc`**

```
20
```

- [ ] **Step 5: Update `.gitignore`**

```gitignore
node_modules/
dist/
.wrangler/
.superpowers/
.dev.vars
*.local
.turbo/
```

- [ ] **Step 6: Run `pnpm install` to bootstrap**

Run: `pnpm install`
Expected: lockfile created, turbo installed

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .nvmrc .gitignore pnpm-lock.yaml
git commit -m "feat: initialize pnpm + turborepo monorepo"
```

---

### Task 2: Create Shared Package (`packages/shared`)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/format.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@cedisense/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts`**

```typescript
// User types
export interface User {
  id: string;
  phone: string;
  name: string;
  monthly_income_ghs: number | null;
  preferred_language: 'en' | 'tw' | 'ee' | 'dag';
  onboarding_completed: 0 | 1;
  created_at: string;
  updated_at: string;
}

// Publicly safe user (returned from auth endpoints)
export type PublicUser = Pick<User, 'id' | 'name' | 'phone'>;

// Auth method types
export type AuthMethodType = 'pin' | 'webauthn' | 'otp' | 'google' | 'apple';

export interface AuthMethod {
  id: string;
  user_id: string;
  type: AuthMethodType;
  credential: string; // JSON string
  is_primary: 0 | 1;
  created_at: string;
}

// PIN credential stored as JSON in auth_methods.credential
export interface PinCredential {
  hash: string; // base64
  salt: string; // base64
}

// Account types
export type AccountType = 'momo' | 'bank' | 'cash' | 'susu';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  account_number: string | null;
  balance_ghs: number;
  is_primary: 0 | 1;
  created_at: string;
}

// API response envelope
export interface ApiSuccess<T> {
  data: T;
  meta?: { total?: number; page?: number };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Auth responses
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface RefreshResponse {
  accessToken: string;
}
```

- [ ] **Step 4: Create `packages/shared/src/schemas.ts`**

```typescript
import { z } from 'zod';

// Ghana phone: 02X, 03X, 04X, 05X (covers MTN, Vodafone, AirtelTigo, all networks)
export const ghanaPhoneRegex = /^0[2-5]\d{8}$/;

// Weak PINs blocklist (sequential, repeated, common patterns)
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210', '1212', '2580',
]);

export const pinSchema = z.string()
  .regex(/^\d{4}$/, 'PIN must be 4 digits')
  .refine(pin => !WEAK_PINS.has(pin), 'PIN is too common. Choose a stronger PIN.');

export const registerSchema = z.object({
  phone: z.string().regex(ghanaPhoneRegex, 'Invalid Ghana phone number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  pin: pinSchema,
});

export const loginSchema = z.object({
  phone: z.string().regex(ghanaPhoneRegex, 'Invalid Ghana phone number'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
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

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balance_ghs: z.number().min(0).optional(),
  is_primary: z.boolean().optional(),
});

// Inferred types for request bodies
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

- [ ] **Step 5: Create `packages/shared/src/constants.ts`**

```typescript
// Mobile Money and bank providers available in Ghana
export const PROVIDERS = {
  momo: [
    { id: 'mtn', name: 'MTN MoMo', color: '#FFCC00' },
    { id: 'vodafone', name: 'Vodafone Cash', color: '#E60000' },
    { id: 'airteltigo', name: 'AirtelTigo Money', color: '#FF0000' },
  ],
  bank: [
    { id: 'gcb', name: 'GCB Bank', color: '#004C99' },
    { id: 'ecobank', name: 'Ecobank', color: '#003DA5' },
    { id: 'fidelity', name: 'Fidelity Bank', color: '#1B3C6E' },
    { id: 'stanbic', name: 'Stanbic Bank', color: '#0033A0' },
    { id: 'absa', name: 'Absa Bank', color: '#DC0032' },
    { id: 'calbank', name: 'CalBank', color: '#007A33' },
    { id: 'uba', name: 'UBA', color: '#D71920' },
    { id: 'zenith', name: 'Zenith Bank', color: '#E31837' },
  ],
} as const;

export const ACCOUNT_TYPES = ['momo', 'bank', 'cash', 'susu'] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tw', name: 'Twi' },
  { code: 'ee', name: 'Ewe' },
  { code: 'dag', name: 'Dagbani' },
] as const;
```

- [ ] **Step 6: Create `packages/shared/src/format.ts`**

```typescript
/**
 * Format a number as Ghana Cedis: ₵1,234.56
 */
export function formatGHS(amount: number): string {
  return `₵${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Normalize a Ghana phone number to 0XXXXXXXXX format.
 * Accepts: "024 123 4567", "024-123-4567", "+233241234567", "233241234567", "0241234567"
 * Returns null if invalid.
 */
export function normalizePhone(phone: string): string | null {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle +233 or 233 prefix
  if (digits.startsWith('233') && digits.length === 12) {
    digits = '0' + digits.slice(3);
  }

  // Validate Ghana format: 0[2-5]XXXXXXXX (10 digits)
  if (/^0[2-5]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}
```

- [ ] **Step 7: Create `packages/shared/src/index.ts`**

```typescript
export * from './types.js';
export * from './schemas.js';
export * from './constants.js';
export * from './format.js';
```

- [ ] **Step 8: Install dependencies and typecheck**

Run: `cd packages/shared && pnpm install && pnpm typecheck`
Expected: no type errors

- [ ] **Step 9: Write tests for format utilities**

Create: `packages/shared/src/format.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatGHS, normalizePhone } from './format.js';

describe('formatGHS', () => {
  it('formats whole number', () => {
    expect(formatGHS(1000)).toBe('₵1,000.00');
  });

  it('formats decimal', () => {
    expect(formatGHS(1234.5)).toBe('₵1,234.50');
  });

  it('formats zero', () => {
    expect(formatGHS(0)).toBe('₵0.00');
  });
});

describe('normalizePhone', () => {
  it('normalizes spaced format', () => {
    expect(normalizePhone('024 123 4567')).toBe('0241234567');
  });

  it('normalizes dashed format', () => {
    expect(normalizePhone('024-123-4567')).toBe('0241234567');
  });

  it('normalizes +233 format', () => {
    expect(normalizePhone('+233241234567')).toBe('0241234567');
  });

  it('normalizes 233 format (no plus)', () => {
    expect(normalizePhone('233241234567')).toBe('0241234567');
  });

  it('passes through already normalized', () => {
    expect(normalizePhone('0241234567')).toBe('0241234567');
  });

  it('rejects invalid prefix', () => {
    expect(normalizePhone('0611234567')).toBeNull();
  });

  it('rejects too short', () => {
    expect(normalizePhone('024123456')).toBeNull();
  });

  it('rejects too long', () => {
    expect(normalizePhone('02412345678')).toBeNull();
  });
});
```

- [ ] **Step 10: Run tests**

Run: `cd packages/shared && pnpm test`
Expected: all tests pass

- [ ] **Step 11: Write tests for schemas**

Create: `packages/shared/src/schemas.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, createAccountSchema, updateAccountSchema, updateUserSchema, pinSchema } from './schemas.js';

describe('pinSchema', () => {
  it('accepts valid PIN', () => {
    expect(pinSchema.safeParse('5839').success).toBe(true);
  });

  it('rejects non-numeric', () => {
    expect(pinSchema.safeParse('abcd').success).toBe(false);
  });

  it('rejects too short', () => {
    expect(pinSchema.safeParse('123').success).toBe(false);
  });

  it('rejects weak PIN 1234', () => {
    const result = pinSchema.safeParse('1234');
    expect(result.success).toBe(false);
  });

  it('rejects repeated digits 0000', () => {
    expect(pinSchema.safeParse('0000').success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      phone: '0241234567',
      name: 'Kwame Asante',
      pin: '5839',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone prefix', () => {
    const result = registerSchema.safeParse({
      phone: '0611234567',
      name: 'Test',
      pin: '5839',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short name', () => {
    const result = registerSchema.safeParse({
      phone: '0241234567',
      name: 'K',
      pin: '5839',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login (even weak PIN)', () => {
    const result = loginSchema.safeParse({
      phone: '0241234567',
      pin: '1234',
    });
    expect(result.success).toBe(true);
  });
});

describe('createAccountSchema', () => {
  it('accepts valid momo account', () => {
    const result = createAccountSchema.safeParse({
      name: 'MTN MoMo',
      type: 'momo',
      provider: 'mtn',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = createAccountSchema.safeParse({
      name: 'Test',
      type: 'crypto',
    });
    expect(result.success).toBe(false);
  });

  it('defaults balance to 0', () => {
    const result = createAccountSchema.safeParse({
      name: 'Cash',
      type: 'cash',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.balance_ghs).toBe(0);
    }
  });
});

describe('updateAccountSchema', () => {
  it('accepts partial update', () => {
    const result = updateAccountSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    const result = updateAccountSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative balance', () => {
    const result = updateAccountSchema.safeParse({ balance_ghs: -100 });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts partial update', () => {
    const result = updateUserSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts language update', () => {
    const result = updateUserSchema.safeParse({ preferred_language: 'tw' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid language', () => {
    const result = updateUserSchema.safeParse({ preferred_language: 'fr' });
    expect(result.success).toBe(false);
  });

  it('rejects negative income', () => {
    const result = updateUserSchema.safeParse({ monthly_income_ghs: -500 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 12: Run all shared tests**

Run: `cd packages/shared && pnpm test`
Expected: all tests pass

- [ ] **Step 13: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared package with types, Zod schemas, and format utilities"
```

---

## Chunk 2: API Worker Scaffolding & Database

### Task 3: Scaffold Hono Worker (`apps/api`)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@cedisense/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir=dist",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:migrate:local": "wrangler d1 execute cedisense-db --local --file=./migrations/0001_initial_schema.sql",
    "db:migrate:remote": "wrangler d1 execute cedisense-db --remote --file=./migrations/0001_initial_schema.sql"
  },
  "dependencies": {
    "@cedisense/shared": "workspace:*",
    "hono": "^4"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "typescript": "^5",
    "vitest": "^3",
    "wrangler": "^4"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@cedisense/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `apps/api/wrangler.toml`**

```toml
name = "cedisense-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"

# Secrets (set via `wrangler secret put`, NEVER in this file):
# - JWT_SECRET: HMAC-SHA256 signing key for access tokens

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "cedisense-db"
database_id = "local"

[[kv_namespaces]]
binding = "KV"
id = "local"

[[r2_buckets]]
binding = "R2"
bucket_name = "cedisense-uploads"
```

- [ ] **Step 4: Create `apps/api/src/types.ts`**

```typescript
import type { Context } from 'hono';

// Cloudflare bindings available in every Worker handler
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// Variables injected by middleware (e.g., auth middleware sets userId)
export interface Variables {
  userId: string;
}

// Hono app type with our bindings and variables
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
```

- [ ] **Step 5: Create `apps/api/src/index.ts`**

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from './types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default app;
```

- [ ] **Step 6: Install dependencies**

Run: `cd apps/api && pnpm install`
Expected: dependencies installed

- [ ] **Step 7: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add apps/api/
git commit -m "feat: scaffold Hono worker with Cloudflare bindings"
```

---

### Task 4: Database Migration

**Files:**
- Create: `apps/api/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 0001: Auth & Core Tables
-- CediSense Subsystem 1: Scaffolding + Auth

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthly_income_ghs REAL,
  preferred_language TEXT DEFAULT 'en',
  onboarding_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Trigger: auto-update updated_at on user changes
CREATE TRIGGER IF NOT EXISTS users_updated_at AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Auth Methods (extensible: pin now, webauthn/otp/social later)
CREATE TABLE IF NOT EXISTS auth_methods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credential TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Accounts (MoMo wallets, bank accounts, cash)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('momo','bank','cash','susu')),
  provider TEXT,
  account_number TEXT,
  balance_ghs REAL DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_methods_user ON auth_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
```

- [ ] **Step 2: Run migration locally**

Run: `cd apps/api && pnpm db:migrate:local`
Expected: tables created successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/
git commit -m "feat: add D1 migration for users, auth_methods, accounts tables"
```

---

### Task 5: API Library Layer (hash, jwt, db helpers)

**Files:**
- Create: `apps/api/src/lib/hash.ts`
- Create: `apps/api/src/lib/jwt.ts`
- Create: `apps/api/src/lib/db.ts`
- Test: `apps/api/src/lib/hash.test.ts`
- Test: `apps/api/src/lib/jwt.test.ts`

- [ ] **Step 1: Write failing test for PIN hashing**

Create: `apps/api/src/lib/hash.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from './hash.js';

describe('hashPin', () => {
  it('returns hash and salt as base64 strings', async () => {
    const result = await hashPin('5839');
    expect(result.hash).toBeTruthy();
    expect(result.salt).toBeTruthy();
    // base64 encoded strings
    expect(typeof result.hash).toBe('string');
    expect(typeof result.salt).toBe('string');
  });

  it('produces different salts for same PIN', async () => {
    const a = await hashPin('5839');
    const b = await hashPin('5839');
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('verifyPin', () => {
  it('returns true for correct PIN', async () => {
    const { hash, salt } = await hashPin('5839');
    const result = await verifyPin('5839', hash, salt);
    expect(result).toBe(true);
  });

  it('returns false for wrong PIN', async () => {
    const { hash, salt } = await hashPin('5839');
    const result = await verifyPin('9999', hash, salt);
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/lib/hash.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PIN hashing**

Create: `apps/api/src/lib/hash.ts`

```typescript
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(pin: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
}

/**
 * Hash a PIN using PBKDF2-SHA256 with a random salt.
 * Returns base64-encoded hash and salt for storage.
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hashBuffer = await deriveKey(pin, salt.buffer);

  return {
    hash: toBase64(hashBuffer),
    salt: toBase64(salt.buffer),
  };
}

/**
 * Verify a PIN against a stored hash and salt.
 */
export async function verifyPin(pin: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const salt = fromBase64(storedSalt);
  const hashBuffer = await deriveKey(pin, salt);
  const computedHash = toBase64(hashBuffer);

  // Constant-time comparison
  if (computedHash.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}
```

- [ ] **Step 4: Run hash tests**

Run: `cd apps/api && pnpm test -- src/lib/hash.test.ts`
Expected: all tests pass

- [ ] **Step 5: Write failing test for JWT**

Create: `apps/api/src/lib/jwt.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from './jwt.js';

const TEST_SECRET = 'test-secret-key-for-testing-only-min-32-chars!!';

describe('signAccessToken', () => {
  it('creates a valid JWT string', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyAccessToken', () => {
  it('returns userId for valid token', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-123');
  });

  it('returns null for tampered token', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifyAccessToken(tampered, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('returns null for wrong secret', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const payload = await verifyAccessToken(token, 'wrong-secret-key-that-is-long-enough-chars!!');
    expect(payload).toBeNull();
  });
});

describe('generateRefreshToken', () => {
  it('produces a non-empty base64url string', () => {
    const token = generateRefreshToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    // base64url: no +, /, or = characters
    expect(token).not.toMatch(/[+/=]/);
  });

  it('produces unique tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });
});

describe('hashRefreshToken', () => {
  it('produces a deterministic hash', async () => {
    const token = 'test-token-value';
    const hash1 = await hashRefreshToken(token);
    const hash2 = await hashRefreshToken(token);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different tokens', async () => {
    const hash1 = await hashRefreshToken('token-a');
    const hash2 = await hashRefreshToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/lib/jwt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement JWT sign/verify**

Create: `apps/api/src/lib/jwt.ts`

```typescript
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeJson(obj: object): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Create a signed JWT access token.
 */
export async function signAccessToken(userId: string, secret: string): Promise<string> {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeJson({
    sub: userId,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  });

  const signingInput = `${header}.${payload}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * Verify a JWT access token. Returns payload if valid, null otherwise.
 */
export async function verifyAccessToken(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const signingInput = `${header}.${payload}`;

    const key = await getSigningKey(secret);
    const signatureBuffer = fromBase64Url(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload))
    ) as JwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token (32 bytes, base64url-encoded).
 */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes.buffer);
}

/**
 * Hash a refresh token for KV storage (SHA-256).
 */
export async function hashRefreshToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return toBase64Url(buffer);
}
```

- [ ] **Step 8: Run JWT tests**

Run: `cd apps/api && pnpm test -- src/lib/jwt.test.ts`
Expected: all tests pass

- [ ] **Step 9: Create DB helper**

Create: `apps/api/src/lib/db.ts`

```typescript
import type { Env } from '../types.js';

/**
 * Response envelope helpers for consistent API responses.
 */
export function success<T>(data: T, status = 200) {
  return { data, _status: status };
}

export function created<T>(data: T) {
  return { data, _status: 201 };
}

export function error(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return {
    error: { code, message, ...(details ? { details } : {}) },
    _status: status,
  };
}

/**
 * Generate a random ID matching D1 default: lower(hex(randomblob(16)))
 */
export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/lib/
git commit -m "feat: add PIN hashing (PBKDF2), JWT sign/verify, DB helpers"
```

---

## Chunk 3: Middleware & Auth Routes

### Task 6: CORS, Auth, and Rate Limit Middleware

**Files:**
- Create: `apps/api/src/middleware/cors.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/rate-limit.ts`

- [ ] **Step 1: Create CORS middleware**

Create: `apps/api/src/middleware/cors.ts`

```typescript
import { cors } from 'hono/cors';
import type { Env, Variables } from '../types.js';

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const env = c.env as Env;
      const allowed = [
        'https://cedisense.com',
        'https://www.cedisense.com',
      ];

      // Allow Pages preview deploys
      if (origin?.endsWith('.cedisense.pages.dev')) {
        return origin;
      }

      // Allow localhost in development
      if (env.ENVIRONMENT === 'development' && origin?.startsWith('http://localhost')) {
        return origin;
      }

      if (allowed.includes(origin ?? '')) {
        return origin!;
      }

      return '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
}
```

- [ ] **Step 2: Create auth middleware**

Create: `apps/api/src/middleware/auth.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import { verifyAccessToken } from '../lib/jwt.js';

/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies signature, sets userId in context.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } },
      401
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(
      { error: { code: 'TOKEN_EXPIRED', message: 'Access token is invalid or expired' } },
      401
    );
  }

  c.set('userId', payload.sub);
  await next();
});
```

- [ ] **Step 3: Create rate limit middleware**

Create: `apps/api/src/middleware/rate-limit.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

const GENERAL_LIMIT = 100;
const GENERAL_WINDOW_SECONDS = 60;

/**
 * General API rate limiting: 100 requests/minute per authenticated user.
 * Uses KV with sliding window approximation.
 */
export const rateLimitMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    await next();
    return;
  }

  const key = `rate:api:${userId}`;
  const current = await c.env.KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= GENERAL_LIMIT) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
          retryAfter: GENERAL_WINDOW_SECONDS,
        },
      },
      429,
      { 'Retry-After': String(GENERAL_WINDOW_SECONDS) }
    );
  }

  // Increment counter with TTL
  await c.env.KV.put(key, String(count + 1), {
    expirationTtl: GENERAL_WINDOW_SECONDS,
  });

  await next();
});

/**
 * Login rate limiting: 5 attempts per phone per 15 minutes.
 * Returns remaining attempts and lockout info.
 */
export async function checkLoginRateLimit(
  kv: KVNamespace,
  phone: string
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const key = `rate:login:${phone}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 5) {
    return { allowed: false, remaining: 0, retryAfter: 900 };
  }

  return { allowed: true, remaining: 5 - count - 1 };
}

export async function incrementLoginAttempts(kv: KVNamespace, phone: string): Promise<void> {
  const key = `rate:login:${phone}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  await kv.put(key, String(count + 1), { expirationTtl: 900 });
}

export async function clearLoginAttempts(kv: KVNamespace, phone: string): Promise<void> {
  await kv.delete(`rate:login:${phone}`);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/
git commit -m "feat: add CORS, JWT auth, and rate limiting middleware"
```

---

### Task 7: Auth Routes (register, login, refresh, logout)

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create auth routes**

Create: `apps/api/src/routes/auth.ts`

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { registerSchema, loginSchema, normalizePhone } from '@cedisense/shared';
import { hashPin, verifyPin } from '../lib/hash.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../lib/jwt.js';
import { generateId } from '../lib/db.js';
import {
  checkLoginRateLimit,
  incrementLoginAttempts,
  clearLoginAttempts,
} from '../middleware/rate-limit.js';
import { authMiddleware } from '../middleware/auth.js';
import type { PinCredential, PublicUser } from '@cedisense/shared';

const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function setRefreshCookie(c: any, token: string) {
  const isProduction = c.env.ENVIRONMENT === 'production';
  const cookie = [
    `refreshToken=${token}`,
    'Path=/api/v1/auth',
    'HttpOnly',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    `Max-Age=${REFRESH_TOKEN_TTL}`,
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
  c.header('Set-Cookie', cookie);
}

function clearRefreshCookie(c: any) {
  const isProduction = c.env.ENVIRONMENT === 'production';
  const cookie = [
    'refreshToken=',
    'Path=/api/v1/auth',
    'HttpOnly',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    'Max-Age=0',
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
  c.header('Set-Cookie', cookie);
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

// POST /api/v1/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const { name, pin } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid Ghana phone number' } },
      400
    );
  }

  // Check if phone already registered
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE phone = ?'
  ).bind(phone).first();

  if (existing) {
    return c.json(
      { error: { code: 'PHONE_EXISTS', message: 'This phone number is already registered' } },
      409
    );
  }

  // Hash PIN
  const { hash, salt } = await hashPin(pin);
  const credential: PinCredential = { hash, salt };

  // Create user + auth method in a batch
  const userId = generateId();
  const authMethodId = generateId();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO users (id, phone, name) VALUES (?, ?, ?)'
    ).bind(userId, phone, name),
    c.env.DB.prepare(
      'INSERT INTO auth_methods (id, user_id, type, credential, is_primary) VALUES (?, ?, ?, ?, ?)'
    ).bind(authMethodId, userId, 'pin', JSON.stringify(credential), 1),
  ]);

  // Generate tokens
  const accessToken = await signAccessToken(userId, c.env.JWT_SECRET);
  const refreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);

  // Store refresh token hash in KV
  await c.env.KV.put(
    `refresh:${refreshHash}`,
    JSON.stringify({ userId, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  // Set cookie and respond
  setRefreshCookie(c, refreshToken);

  const user: PublicUser = { id: userId, name, phone };
  return c.json({ data: { accessToken, user } }, 201);
});

// POST /api/v1/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid Ghana phone number' } },
      400
    );
  }

  // Check rate limit
  const rateLimit = await checkLoginRateLimit(c.env.KV, phone);
  if (!rateLimit.allowed) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
          retryAfter: rateLimit.retryAfter,
        },
      },
      429,
      { 'Retry-After': String(rateLimit.retryAfter) }
    );
  }

  // Lookup user and auth method
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.phone, am.credential
     FROM users u
     JOIN auth_methods am ON am.user_id = u.id AND am.type = 'pin' AND am.is_primary = 1
     WHERE u.phone = ?`
  ).bind(phone).first<{ id: string; name: string; phone: string; credential: string }>();

  if (!row) {
    await incrementLoginAttempts(c.env.KV, phone);
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone number or PIN' } },
      401,
      { 'X-RateLimit-Remaining': String(rateLimit.remaining) }
    );
  }

  // Verify PIN
  const { hash, salt } = JSON.parse(row.credential) as PinCredential;
  const valid = await verifyPin(parsed.data.pin, hash, salt);

  if (!valid) {
    await incrementLoginAttempts(c.env.KV, phone);
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone number or PIN' } },
      401,
      { 'X-RateLimit-Remaining': String(rateLimit.remaining) }
    );
  }

  // Success — clear rate limit
  await clearLoginAttempts(c.env.KV, phone);

  // Generate tokens
  const accessToken = await signAccessToken(row.id, c.env.JWT_SECRET);
  const refreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);

  await c.env.KV.put(
    `refresh:${refreshHash}`,
    JSON.stringify({ userId: row.id, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  setRefreshCookie(c, refreshToken);

  const user: PublicUser = { id: row.id, name: row.name, phone: row.phone };
  return c.json({ data: { accessToken, user } });
});

// POST /api/v1/auth/refresh
auth.post('/refresh', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const refreshToken = getCookieValue(cookieHeader, 'refreshToken');

  if (!refreshToken) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'No refresh token' } },
      401
    );
  }

  const tokenHash = await hashRefreshToken(refreshToken);
  const stored = await c.env.KV.get(`refresh:${tokenHash}`);

  if (!stored) {
    clearRefreshCookie(c);
    return c.json(
      { error: { code: 'TOKEN_EXPIRED', message: 'Refresh token is invalid or expired' } },
      401
    );
  }

  const { userId } = JSON.parse(stored) as { userId: string };

  // Delete old token (single-use rotation)
  await c.env.KV.delete(`refresh:${tokenHash}`);

  // Generate new token pair
  const newAccessToken = await signAccessToken(userId, c.env.JWT_SECRET);
  const newRefreshToken = generateRefreshToken();
  const newRefreshHash = await hashRefreshToken(newRefreshToken);

  await c.env.KV.put(
    `refresh:${newRefreshHash}`,
    JSON.stringify({ userId, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  setRefreshCookie(c, newRefreshToken);

  return c.json({ data: { accessToken: newAccessToken } });
});

// POST /api/v1/auth/logout (protected)
auth.post('/logout', authMiddleware, async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const refreshToken = getCookieValue(cookieHeader, 'refreshToken');

  if (refreshToken) {
    const tokenHash = await hashRefreshToken(refreshToken);
    await c.env.KV.delete(`refresh:${tokenHash}`);
  }

  clearRefreshCookie(c);
  return c.body(null, 204);
});

export { auth };
```

- [ ] **Step 2: Mount auth routes in main app**

Modify: `apps/api/src/index.ts`

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from './types.js';
import { corsMiddleware } from './middleware/cors.js';
import { auth } from './routes/auth.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', corsMiddleware());

// Routes
app.route('/api/v1/auth', auth);

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default app;
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add auth routes (register, login, refresh, logout) with rate limiting"
```

---

### Task 8: User and Account Routes

**Files:**
- Create: `apps/api/src/routes/users.ts`
- Create: `apps/api/src/routes/accounts.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create user routes**

Create: `apps/api/src/routes/users.ts`

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { updateUserSchema } from '@cedisense/shared';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/users/me
users.get('/me', async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    `SELECT id, phone, name, monthly_income_ghs, preferred_language, onboarding_completed, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(userId).first();

  if (!user) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'User not found' } },
      404
    );
  }

  return c.json({ data: user });
});

// PUT /api/v1/users/me
users.put('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.monthly_income_ghs !== undefined) {
    setClauses.push('monthly_income_ghs = ?');
    values.push(updates.monthly_income_ghs);
  }
  if (updates.preferred_language !== undefined) {
    setClauses.push('preferred_language = ?');
    values.push(updates.preferred_language);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(userId);

  await c.env.DB.prepare(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const user = await c.env.DB.prepare(
    `SELECT id, phone, name, monthly_income_ghs, preferred_language, onboarding_completed, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(userId).first();

  return c.json({ data: user });
});

// PUT /api/v1/users/me/onboarding
users.put('/me/onboarding', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  if (body?.completed !== true) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Body must contain { completed: true }' } },
      400
    );
  }

  await c.env.DB.prepare(
    'UPDATE users SET onboarding_completed = 1 WHERE id = ?'
  ).bind(userId).run();

  return c.body(null, 204);
});

export { users };
```

- [ ] **Step 2: Create account routes**

Create: `apps/api/src/routes/accounts.ts`

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createAccountSchema, updateAccountSchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const accounts = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// POST /api/v1/accounts
accounts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const data = parsed.data;
  const id = generateId();

  // If setting as primary, unset other primary accounts first
  if (data.is_primary) {
    await c.env.DB.prepare(
      'UPDATE accounts SET is_primary = 0 WHERE user_id = ? AND is_primary = 1'
    ).bind(userId).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO accounts (id, user_id, name, type, provider, account_number, balance_ghs, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, data.name, data.type,
    data.provider ?? null, data.account_number ?? null,
    data.balance_ghs, data.is_primary ? 1 : 0
  ).run();

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: account }, 201);
});

// GET /api/v1/accounts
accounts.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
  ).bind(userId).all();

  return c.json({ data: results });
});

// PUT /api/v1/accounts/:id
accounts.put('/:id', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateAccountSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Account not found' } },
      404
    );
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.balance_ghs !== undefined) {
    setClauses.push('balance_ghs = ?');
    values.push(updates.balance_ghs);
  }
  if (updates.is_primary !== undefined) {
    if (updates.is_primary) {
      await c.env.DB.prepare(
        'UPDATE accounts SET is_primary = 0 WHERE user_id = ? AND is_primary = 1'
      ).bind(userId).run();
    }
    setClauses.push('is_primary = ?');
    values.push(updates.is_primary ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(accountId);

  await c.env.DB.prepare(
    `UPDATE accounts SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ?'
  ).bind(accountId).first();

  return c.json({ data: account });
});

// DELETE /api/v1/accounts/:id
accounts.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.param('id');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Account not found' } },
      404
    );
  }

  // Prevent deleting last account
  const { count } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM accounts WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>() ?? { count: 0 };

  if (count <= 1) {
    return c.json(
      { error: { code: 'LAST_ACCOUNT', message: 'Cannot delete your last account' } },
      400
    );
  }

  await c.env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();

  return c.body(null, 204);
});

export { accounts };
```

- [ ] **Step 3: Update main app to mount all routes**

Modify: `apps/api/src/index.ts`

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from './types.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { auth } from './routes/auth.js';
import { users } from './routes/users.js';
import { accounts } from './routes/accounts.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', corsMiddleware());

// Public auth routes
app.route('/api/v1/auth', auth);

// Protected routes with rate limiting
app.use('/api/v1/users/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/accounts/*', authMiddleware, rateLimitMiddleware);

app.route('/api/v1/users', users);
app.route('/api/v1/accounts', accounts);

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 fallback
app.notFound((c) => {
  return c.json(
    { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500
  );
});

export default app;
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add user and account CRUD routes, mount all routes with middleware"
```

---

## Chunk 4: Frontend Scaffolding

### Task 9: Scaffold React/Vite App (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@cedisense/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@cedisense/shared": "workspace:*",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^4",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5",
    "vite": "^6"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"],
      "@cedisense/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create Tailwind config with Ghana theme**

Create: `apps/web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4A843',
        ghana: {
          green: '#006B3F',
          black: '#1A1A1A',
          dark: '#111111',
          surface: '#1A1A2E',
        },
        income: '#4ADE80',
        expense: '#F87171',
        muted: '#888888',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create: `apps/web/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `apps/web/src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

@layer base {
  body {
    @apply bg-ghana-black text-white font-sans antialiased;
  }
}
```

- [ ] **Step 6: Create `apps/web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1A1A1A" />
    <title>CediSense — Smart Finance for Ghana</title>
    <link rel="manifest" href="/manifest.json" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Register service worker for PWA asset caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — non-critical, app works without it
    });
  });
}
```

- [ ] **Step 8: Create `apps/web/src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted text-lg">{name} — coming soon</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Placeholder name="Login" />} />
      <Route path="/register" element={<Placeholder name="Register" />} />
      <Route path="/" element={<Placeholder name="Dashboard" />} />
    </Routes>
  );
}
```

- [ ] **Step 9: Install dependencies and verify dev server**

Run: `cd apps/web && pnpm install && pnpm dev`
Expected: Vite dev server starts at localhost:5173, page loads with placeholder

- [ ] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold React/Vite frontend with Ghana-themed Tailwind"
```

---

### Task 10: API Client & Auth Context

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create API client**

Create: `apps/web/src/lib/api.ts`

```typescript
import type { ApiSuccess, ApiError } from '@cedisense/shared';

const API_BASE = '/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for refresh token
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();

  if (!response.ok) {
    const error = json as ApiError;
    throw new ApiRequestError(
      error.error.message,
      error.error.code,
      response.status,
      error.error.details
    );
  }

  return (json as ApiSuccess<T>).data;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Create AuthContext**

Create: `apps/web/src/contexts/AuthContext.tsx`

```tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PublicUser, RegisterInput, LoginInput, AuthResponse, RefreshResponse, User } from '@cedisense/shared';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await api.get<User>('/users/me');
      setUser(userData);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  // Try silent refresh on mount
  useEffect(() => {
    async function init() {
      try {
        const { accessToken } = await api.post<RefreshResponse>('/auth/refresh');
        setAccessToken(accessToken);
        await fetchUser();
      } catch {
        // No valid refresh token — user needs to log in
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [fetchUser]);

  const login = useCallback(async (input: LoginInput) => {
    const { accessToken, user: publicUser } = await api.post<AuthResponse>('/auth/login', input);
    setAccessToken(accessToken);
    await fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (input: RegisterInput) => {
    const { accessToken, user: publicUser } = await api.post<AuthResponse>('/auth/register', input);
    setAccessToken(accessToken);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout even if API call fails
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ apps/web/src/contexts/
git commit -m "feat: add API client and AuthContext with silent refresh"
```

---

## Chunk 5: Frontend Pages & App Shell

### Task 11: App Shell (Layout, Navigation)

**Files:**
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/layout/BottomNav.tsx`
- Create: `apps/web/src/components/layout/SideNav.tsx`
- Create: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Create TopBar**

Create: `apps/web/src/components/layout/TopBar.tsx`

```tsx
import { useAuth } from '@/contexts/AuthContext';

export function TopBar() {
  const { user } = useAuth();

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '';

  return (
    <header className="bg-ghana-surface border-b border-ghana-surface/50 px-4 py-3 flex items-center justify-between md:hidden">
      <div className="flex items-center gap-2">
        <span className="text-gold font-extrabold text-xl">₵</span>
        <span className="text-white font-semibold text-base">CediSense</span>
      </div>
      <div className="w-8 h-8 rounded-full bg-ghana-green flex items-center justify-center text-white text-xs font-semibold">
        {initials}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create BottomNav**

Create: `apps/web/src/components/layout/BottomNav.tsx`

```tsx
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Txns', icon: '📋' },
  { to: '/add', label: 'Add', icon: '+', isAction: true },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
  { to: '/settings', label: 'More', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-ghana-surface border-t border-ghana-surface/50 py-2 pb-[env(safe-area-inset-bottom)] flex justify-around items-end md:hidden z-50">
      {navItems.map((item) =>
        item.isAction ? (
          <NavLink key={item.to} to={item.to} className="flex flex-col items-center -mt-4">
            <div className="w-11 h-11 rounded-full bg-gold flex items-center justify-center text-ghana-black text-xl font-bold shadow-lg shadow-gold/30">
              {item.icon}
            </div>
            <span className="text-[10px] text-muted mt-1">{item.label}</span>
          </NavLink>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center ${isActive ? 'text-gold' : 'text-muted'}`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        )
      )}
    </nav>
  );
}
```

- [ ] **Step 3: Create SideNav**

Create: `apps/web/src/components/layout/SideNav.tsx`

```tsx
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '📋' },
  { to: '/budgets', label: 'Budgets', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/ai-chat', label: 'AI Chat', icon: '💬' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-52 lg:w-56 bg-ghana-surface border-r border-ghana-surface/50 min-h-screen flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-gold font-extrabold text-2xl">₵</span>
        <span className="text-white font-semibold text-lg">CediSense</span>
      </div>
      <nav className="flex flex-col gap-0.5 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-ghana-green/15 border-l-[3px] border-ghana-green text-white'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Create AppShell**

Create: `apps/web/src/components/layout/AppShell.tsx`

```tsx
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-ghana-dark">
      <SideNav />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/
git commit -m "feat: add AppShell with responsive BottomNav, SideNav, TopBar"
```

---

### Task 12: Auth Pages (Login, Register)

**Files:**
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Create LoginPage**

Create: `apps/web/src/pages/LoginPage.tsx`

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ phone: phone.replace(/\s|-/g, ''), pin });
      navigate('/');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ghana-black">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-gold font-extrabold text-4xl">₵</span>
          <h1 className="text-white text-2xl font-bold mt-2">Welcome back</h1>
          <p className="text-muted text-sm mt-1">Sign in to your CediSense account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-expense/10 border border-expense/30 text-expense text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm text-muted block mb-1.5">Phone Number</label>
            <input
              type="tel"
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-base focus:outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-gold"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-ghana-green text-white font-semibold py-3 rounded-lg hover:bg-ghana-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-gold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create RegisterPage**

Create: `apps/web/src/pages/RegisterPage.tsx`

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function RegisterPage() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);

    try {
      await register({ phone: phone.replace(/\s|-/g, ''), name, pin });
      navigate('/onboarding');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ghana-black">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-gold font-extrabold text-4xl">₵</span>
          <h1 className="text-white text-2xl font-bold mt-2">Create Account</h1>
          <p className="text-muted text-sm mt-1">Start tracking your finances with CediSense</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-expense/10 border border-expense/30 text-expense text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm text-muted block mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="Kwame Asante"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-base focus:outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Phone Number</label>
            <input
              type="tel"
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-base focus:outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Create PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-gold"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4 || confirmPin.length < 4}
            className="w-full bg-ghana-green text-white font-semibold py-3 rounded-lg hover:bg-ghana-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/
git commit -m "feat: add Login and Register pages with Ghana-themed design"
```

---

### Task 13: Onboarding Wizard

**Files:**
- Create: `apps/web/src/components/onboarding/IncomeStep.tsx`
- Create: `apps/web/src/components/onboarding/AccountStep.tsx`
- Create: `apps/web/src/components/onboarding/FirstTransactionStep.tsx`
- Create: `apps/web/src/pages/OnboardingPage.tsx`

- [ ] **Step 1: Create IncomeStep**

Create: `apps/web/src/components/onboarding/IncomeStep.tsx`

```tsx
import { useState } from 'react';

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];

interface Props {
  onComplete: (income: number) => void;
  onSkip: () => void;
}

export function IncomeStep({ onComplete, onSkip }: Props) {
  const [amount, setAmount] = useState('');

  return (
    <div className="text-center">
      <div className="text-4xl mb-3">💰</div>
      <h2 className="text-xl font-semibold text-white">What's your monthly income?</h2>
      <p className="text-muted text-sm mt-1">This helps us give you better budget advice</p>

      <div className="flex items-center justify-center gap-2 mt-6">
        <span className="text-gold text-2xl font-bold">₵</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          className="bg-ghana-surface border-2 border-gold rounded-lg px-4 py-3 text-2xl text-white text-center w-44 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(String(a))}
            className="bg-ghana-surface border border-ghana-surface/50 rounded-full px-4 py-1.5 text-sm text-muted hover:border-gold hover:text-white transition-colors"
          >
            ₵{a.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="flex-1 py-3 text-muted text-sm hover:text-white transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() => amount && onComplete(parseFloat(amount))}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex-[2] bg-ghana-green text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AccountStep**

Create: `apps/web/src/components/onboarding/AccountStep.tsx`

```tsx
import { useState } from 'react';
import { PROVIDERS } from '@cedisense/shared';

const ACCOUNT_OPTIONS = [
  ...PROVIDERS.momo.map((p) => ({ ...p, type: 'momo' as const, subtitle: 'Mobile Money' })),
  ...PROVIDERS.bank.slice(0, 4).map((p) => ({ ...p, type: 'bank' as const, subtitle: 'Bank Account' })),
  { id: 'cash', name: 'Cash', color: '#333', type: 'cash' as const, subtitle: 'Physical cash tracking' },
];

interface Props {
  onComplete: (account: { name: string; type: 'momo' | 'bank' | 'cash'; provider: string }) => void;
  onSkip: () => void;
}

export function AccountStep({ onComplete, onSkip }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedOption = ACCOUNT_OPTIONS.find((o) => o.id === selected);

  return (
    <div className="text-center">
      <div className="text-4xl mb-3">📱</div>
      <h2 className="text-xl font-semibold text-white">Add your primary account</h2>
      <p className="text-muted text-sm mt-1">Which do you use most for daily transactions?</p>

      <div className="flex flex-col gap-2.5 mt-6 text-left">
        {ACCOUNT_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors ${
              selected === option.id
                ? 'border-gold bg-ghana-surface'
                : 'border-ghana-surface bg-ghana-surface hover:border-muted/30'
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: option.color }}
            >
              {option.id === 'cash' ? '💵' : option.name.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{option.name}</div>
              <div className="text-muted text-xs">{option.subtitle}</div>
            </div>
            {selected === option.id && <div className="ml-auto text-gold">✓</div>}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="flex-1 py-3 text-muted text-sm hover:text-white transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() =>
            selectedOption &&
            onComplete({
              name: selectedOption.name,
              type: selectedOption.type,
              provider: selectedOption.id,
            })
          }
          disabled={!selected}
          className="flex-[2] bg-ghana-green text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FirstTransactionStep**

Create: `apps/web/src/components/onboarding/FirstTransactionStep.tsx`

```tsx
interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function FirstTransactionStep({ onComplete, onSkip }: Props) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-3">📝</div>
      <h2 className="text-xl font-semibold text-white">Add your first transaction</h2>
      <p className="text-muted text-sm mt-1">Choose how you'd like to get started</p>

      <div className="flex flex-col gap-3 mt-6 text-left">
        <button
          onClick={onComplete}
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-gold bg-ghana-surface hover:bg-ghana-surface/80 transition-colors"
        >
          <span className="text-2xl">📲</span>
          <div>
            <div className="text-white font-semibold text-sm">Paste MoMo SMS</div>
            <div className="text-muted text-xs mt-0.5">
              Copy a transaction SMS from your messages and paste it here
            </div>
          </div>
        </button>

        <button
          onClick={onComplete}
          className="flex items-center gap-3 p-4 rounded-xl border border-ghana-surface bg-ghana-surface hover:border-muted/30 transition-colors"
        >
          <span className="text-2xl">✏️</span>
          <div>
            <div className="text-white font-semibold text-sm">Enter Manually</div>
            <div className="text-muted text-xs mt-0.5">
              Type in a recent transaction — amount, category, description
            </div>
          </div>
        </button>
      </div>

      <div className="bg-ghana-green/10 border border-ghana-green rounded-lg p-3 mt-4 text-left">
        <div className="text-ghana-green text-xs font-semibold">💡 Tip</div>
        <div className="text-muted text-xs mt-1">
          You can always import more transactions later from Settings → Import SMS
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={onSkip}
          className="text-muted text-sm hover:text-white transition-colors"
        >
          Skip — go to dashboard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create OnboardingPage**

Create: `apps/web/src/pages/OnboardingPage.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { IncomeStep } from '@/components/onboarding/IncomeStep';
import { AccountStep } from '@/components/onboarding/AccountStep';
import { FirstTransactionStep } from '@/components/onboarding/FirstTransactionStep';
import type { Account } from '@cedisense/shared';

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Determine which step to start at based on existing data
  useEffect(() => {
    async function checkProgress() {
      try {
        const accounts = await api.get<Account[]>('/accounts');
        if (user?.monthly_income_ghs != null) {
          if (accounts.length > 0) {
            setStep(3);
          } else {
            setStep(2);
          }
        }
      } catch {
        // Default to step 1
      } finally {
        setLoading(false);
      }
    }
    checkProgress();
  }, [user]);

  async function handleIncomeComplete(income: number) {
    await api.put('/users/me', { monthly_income_ghs: income });
    await refreshUser();
    setStep(2);
  }

  async function handleAccountComplete(account: { name: string; type: string; provider: string }) {
    await api.post('/accounts', {
      name: account.name,
      type: account.type,
      provider: account.provider,
      is_primary: true,
    });
    setStep(3);
  }

  async function handleFinish() {
    await api.put('/users/me/onboarding', { completed: true });
    await refreshUser();
    navigate('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghana-black">
        <div className="text-gold text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ghana-black">
      <div className="w-full max-w-sm">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'bg-gold w-10' : 'bg-ghana-surface w-6'
              }`}
            />
          ))}
          <span className="text-muted text-xs ml-2">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <IncomeStep onComplete={handleIncomeComplete} onSkip={() => setStep(2)} />
        )}
        {step === 2 && (
          <AccountStep onComplete={handleAccountComplete} onSkip={() => setStep(3)} />
        )}
        {step === 3 && (
          <FirstTransactionStep onComplete={handleFinish} onSkip={handleFinish} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/onboarding/ apps/web/src/pages/OnboardingPage.tsx
git commit -m "feat: add 3-step onboarding wizard (income, account, first transaction)"
```

---

### Task 14: Route Guards & Final App Wiring

**Files:**
- Create: `apps/web/src/components/layout/ProtectedRoute.tsx`
- Create: `apps/web/src/pages/DashboardPage.tsx`
- Create: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/public/manifest.json`
- Create: `apps/web/public/sw.js`

- [ ] **Step 1: Create ProtectedRoute**

Create: `apps/web/src/components/layout/ProtectedRoute.tsx`

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghana-black">
        <div className="text-gold text-xl animate-pulse">₵</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if not completed
  if (user && !user.onboarding_completed && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create placeholder DashboardPage**

Create: `apps/web/src/pages/DashboardPage.tsx`

```tsx
import { useAuth } from '@/contexts/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="p-4 md:p-6">
      <p className="text-muted text-sm">{greeting}, {user?.name.split(' ')[0]}</p>
      <h1 className="text-white text-2xl md:text-3xl font-bold mt-1">₵0.00</h1>
      <p className="text-muted text-xs">Total balance</p>

      <div className="mt-8 bg-ghana-surface rounded-xl p-6 text-center">
        <p className="text-muted">Dashboard charts coming in Subsystem 3</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create SettingsPage**

Create: `apps/web/src/pages/SettingsPage.tsx`

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-white text-xl font-bold mb-6">Settings</h1>

      <div className="bg-ghana-surface rounded-xl p-4 mb-4">
        <div className="text-muted text-xs uppercase mb-2">Account</div>
        <div className="text-white font-medium">{user?.name}</div>
        <div className="text-muted text-sm">{user?.phone}</div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-expense/10 text-expense font-medium py-3 rounded-xl hover:bg-expense/20 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Wire up App.tsx with all routes**

Modify: `apps/web/src/App.tsx`

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="p-4 md:p-6">
      <div className="bg-ghana-surface rounded-xl p-6 text-center">
        <p className="text-muted">{name} — coming in a future subsystem</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Onboarding (protected, no shell) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Protected routes with app shell */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<Placeholder name="Transactions" />} />
          <Route path="/budgets" element={<Placeholder name="Budgets" />} />
          <Route path="/goals" element={<Placeholder name="Goals" />} />
          <Route path="/ai-chat" element={<Placeholder name="AI Chat" />} />
          <Route path="/add" element={<Placeholder name="Add Transaction" />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Create PWA manifest**

Create: `apps/web/public/manifest.json`

```json
{
  "name": "CediSense",
  "short_name": "CediSense",
  "description": "Smart Finance for Ghana",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A1A1A",
  "theme_color": "#D4A843",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 6: Create service worker (asset cache only)**

Create: `apps/web/public/sw.js`

```javascript
const CACHE_NAME = 'cedisense-v1';
const STATIC_ASSETS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for static assets
  if (event.request.method !== 'GET') return;
  // Don't cache API calls
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

- [ ] **Step 7: Typecheck the full frontend**

Run: `cd apps/web && pnpm typecheck`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: wire up route guards, app shell, auth pages, onboarding, PWA manifest"
```

---

## Chunk 6: Integration & Dev Environment

### Task 15: Dev Environment & Root Scripts

**Files:**
- Create: `apps/api/.dev.vars`
- Modify: `package.json` (root)

- [ ] **Step 1: Create `.dev.vars` for local secrets**

Create: `apps/api/.dev.vars`

```
JWT_SECRET=dev-secret-key-for-local-testing-only-min-32-chars!!
```

Note: `.dev.vars` is already in `.gitignore`

- [ ] **Step 2: Verify full build from root**

Run: `pnpm install && pnpm build`
Expected: all packages build successfully

- [ ] **Step 3: Verify dev servers start**

Run (in separate terminals):
- `cd apps/api && pnpm dev` → Worker dev server at localhost:8787
- `cd apps/web && pnpm dev` → Vite dev server at localhost:5173

Expected: Both servers start. Frontend proxies `/api` to Worker.

- [ ] **Step 4: Run all tests from root**

Run: `pnpm test`
Expected: all tests pass (shared package tests)

- [ ] **Step 5: Run local D1 migration**

Run: `cd apps/api && pnpm db:migrate:local`
Expected: tables created in local D1

- [ ] **Step 6: Manual smoke test**

1. Open `http://localhost:5173`
2. Should redirect to `/login`
3. Click "Create one" → Register page loads
4. Register with phone `0241234567`, name `Test User`, PIN `5839`
5. Should redirect to `/onboarding`
6. Complete or skip all 3 steps
7. Should land on Dashboard with greeting
8. Navigate to Settings → Sign Out
9. Should redirect to `/login`
10. Log in with same credentials
11. Should land on Dashboard (onboarding skipped)

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete subsystem 1 — scaffolding, auth, onboarding, app shell"
```
