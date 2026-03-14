# AI Chat Advisor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversational AI financial advisor with streaming responses, persistent chat history, and rich financial context from the user's transaction data.

**Architecture:** Single `POST /api/v1/ai/chat` endpoint streams SSE responses from Workers AI (Qwen3-30B-A3B). Financial context assembled from dashboard aggregation queries. Chat history persisted in D1. Frontend uses `fetch` + `ReadableStream` for streaming. Daily usage tracked in KV.

**Tech Stack:** Hono, Cloudflare Workers AI, D1, KV, React 18, TypeScript strict, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-ai-chat-advisor-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/migrations/0003_chat_messages.sql` | D1 migration for chat_messages table |
| `apps/api/src/lib/dashboard-queries.ts` | Shared dashboard aggregation queries (extracted from dashboard.ts) |
| `apps/api/src/lib/ai-context.ts` | Build financial context string for AI system prompt |
| `apps/api/src/lib/ai-context.test.ts` | Tests for context builder |
| `apps/api/src/routes/ai.ts` | AI chat endpoints: chat (SSE), history, clear |
| `apps/web/src/lib/markdown.ts` | Lightweight markdown renderer with HTML entity encoding |
| `apps/web/src/lib/markdown.test.ts` | Tests for markdown renderer |
| `apps/web/src/lib/streaming.ts` | SSE stream parser with line buffering + AbortController |
| `apps/web/src/lib/streaming.test.ts` | Tests for SSE parser |
| `apps/web/src/components/chat/ChatBubble.tsx` | User + assistant message bubbles |
| `apps/web/src/components/chat/ChatInput.tsx` | Sticky input bar with send button |
| `apps/web/src/components/chat/ChatHeader.tsx` | Title bar with clear button |
| `apps/web/src/components/chat/WelcomeMessage.tsx` | Empty state with suggestion chips |
| `apps/web/src/components/chat/TypingIndicator.tsx` | Pulsing dots during streaming |
| `apps/web/src/components/chat/UsageWarning.tsx` | Daily limit warning banner |
| `apps/web/src/pages/AIChatPage.tsx` | Full chat page assembling all components |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `ChatMessage`, `ChatRole` |
| `packages/shared/src/schemas.ts` | Add `chatMessageSchema`, `chatHistoryQuerySchema`, inferred types |
| `apps/api/src/routes/dashboard.ts` | Refactor to use shared dashboard-queries.ts |
| `apps/api/src/index.ts` | Mount AI route with auth middleware |
| `apps/web/src/App.tsx` | Replace AI chat placeholder with AIChatPage |

---

## Chunk 1: Shared Types, Migration, Dashboard Query Extraction

### Task 1: Add shared types and schemas

**Files:**
- Modify: `packages/shared/src/types.ts` (append after DashboardData)
- Modify: `packages/shared/src/schemas.ts` (append after DashboardQueryInput)

- [ ] **Step 1: Add chat types to shared types**

In `packages/shared/src/types.ts`, append:

```typescript
// ─── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type ChatRole = 'user' | 'assistant';
```

- [ ] **Step 2: Add chat schemas**

In `packages/shared/src/schemas.ts`, append:

```typescript
// ─── Chat schemas ─────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(500, 'Message too long (max 500 characters)'),
});

export const chatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatHistoryQueryInput = z.infer<typeof chatHistoryQuerySchema>;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add ChatMessage types and chat validation schemas"
```

---

### Task 2: Create D1 migration

**Files:**
- Create: `apps/api/migrations/0003_chat_messages.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Chat messages for AI advisor conversations
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/migrations/0003_chat_messages.sql
git commit -m "feat: add chat_messages D1 migration"
```

---

### Task 3: Extract dashboard queries into shared helper

**Files:**
- Create: `apps/api/src/lib/dashboard-queries.ts`
- Modify: `apps/api/src/routes/dashboard.ts`

Extract the 4 queries needed by both dashboard and AI context (accounts, summary, categories, recent transactions) into a reusable module. The dashboard route calls these + daily trend + uncategorized count. The AI context builder calls just accounts + summary + categories + recent.

- [ ] **Step 1: Create dashboard-queries.ts**

Create `apps/api/src/lib/dashboard-queries.ts`:

```typescript
/**
 * Shared dashboard aggregation queries and date utilities used by both
 * the dashboard route and the AI context builder.
 */

export function lastDayOfMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon, 0);
  return `${year}-${String(mon).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function allDaysInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  balance_pesewas: number;
}

export interface SummaryRow {
  type: string;
  total: number;
  fees: number;
  count: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  total_pesewas: number;
  transaction_count: number;
}

export interface RecentTransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  type: string;
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  source: string;
  transaction_date: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  account_name: string;
}

export async function fetchAccounts(db: D1Database, userId: string): Promise<AccountRow[]> {
  const result = await db.prepare(
    'SELECT id, name, type, provider, balance_pesewas FROM accounts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
  ).bind(userId).all();
  return (result.results ?? []) as AccountRow[];
}

export async function fetchSummary(db: D1Database, userId: string, startDate: string, endDate: string): Promise<SummaryRow[]> {
  const result = await db.prepare(
    `SELECT type, SUM(amount_pesewas) as total, SUM(fee_pesewas) as fees, COUNT(*) as count
     FROM transactions
     WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY type`
  ).bind(userId, startDate, endDate).all();
  return (result.results ?? []) as SummaryRow[];
}

export async function fetchCategoryBreakdown(db: D1Database, userId: string, startDate: string, endDate: string): Promise<CategoryRow[]> {
  const result = await db.prepare(
    `SELECT c.id, c.name,
            COALESCE(c.icon, '📦') as icon,
            COALESCE(c.color, '#888888') as color,
            SUM(t.amount_pesewas) as total_pesewas,
            COUNT(*) as transaction_count
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND t.type = 'debit'
       AND t.transaction_date >= ? AND t.transaction_date <= ?
     GROUP BY c.id
     ORDER BY total_pesewas DESC`
  ).bind(userId, startDate, endDate).all();
  return (result.results ?? []) as CategoryRow[];
}

export async function fetchRecentTransactions(db: D1Database, userId: string, limit = 5): Promise<RecentTransactionRow[]> {
  const result = await db.prepare(
    `SELECT t.id, t.account_id, t.category_id, t.type, t.amount_pesewas,
            t.fee_pesewas, t.description, t.counterparty, t.reference,
            t.source, t.transaction_date, t.created_at,
            c.name as category_name, c.icon as category_icon, a.name as account_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.user_id = ?
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT ?`
  ).bind(userId, limit).all();
  return (result.results ?? []) as RecentTransactionRow[];
}

/**
 * Assemble summary totals from grouped rows.
 */
export function assembleSummary(rows: SummaryRow[]) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalFees = 0;
  let transactionCount = 0;

  for (const row of rows) {
    transactionCount += row.count;
    totalFees += row.fees ?? 0;
    if (row.type === 'credit') {
      totalIncome += row.total ?? 0;
    } else if (row.type === 'debit') {
      totalExpenses += row.total ?? 0;
    }
  }

  return { totalIncome, totalExpenses, totalFees, transactionCount };
}
```

- [ ] **Step 2: Refactor dashboard.ts to use shared queries**

Replace the inline queries in `apps/api/src/routes/dashboard.ts` with imports from `dashboard-queries.ts`. The route handler should call:

```typescript
import {
  fetchAccounts, fetchSummary, fetchCategoryBreakdown,
  fetchRecentTransactions, assembleSummary,
  type AccountRow, type CategoryRow,
} from '../lib/dashboard-queries.js';
```

Then replace the Promise.all contents:
- Query 1 → `fetchAccounts(c.env.DB, userId)`
- Query 2 → `fetchSummary(c.env.DB, userId, startDate, endDate)`
- Query 3 → `fetchCategoryBreakdown(c.env.DB, userId, startDate, endDate)`
- Query 5 → `fetchRecentTransactions(c.env.DB, userId)`
- Queries 4 (daily trend) and 6 (uncategorized count) stay inline — they're dashboard-specific.

Use `assembleSummary()` to process the summary rows.

Remove the type casts from the dashboard route since the shared functions now return typed results.

**Also move date utilities:** Remove `lastDayOfMonth`, `currentMonth`, and `allDaysInMonth` from `dashboard.ts` and import them from `dashboard-queries.ts` instead. Update the existing dashboard test to import from the new location. This avoids an inverted dependency (lib importing from routes).

- [ ] **Step 3: Verify TypeScript compiles and tests pass**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/dashboard-queries.ts apps/api/src/routes/dashboard.ts
git commit -m "refactor: extract dashboard queries into shared helper"
```

---

## Chunk 2: AI Context Builder + API Routes

### Task 4: Create AI financial context builder

**Files:**
- Create: `apps/api/src/lib/ai-context.ts`
- Create: `apps/api/src/lib/ai-context.test.ts`

- [ ] **Step 1: Create ai-context.ts**

Create `apps/api/src/lib/ai-context.ts`:

```typescript
import {
  fetchAccounts, fetchSummary, fetchCategoryBreakdown,
  fetchRecentTransactions, assembleSummary,
  currentMonth, lastDayOfMonth,
} from './dashboard-queries.js';

function formatGHS(pesewas: number): string {
  const ghs = pesewas / 100;
  return `₵${ghs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthName(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1, 1);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

/**
 * Build a plain-text financial context string for the AI system prompt.
 * Uses the same aggregation queries as the dashboard endpoint.
 */
export async function buildFinancialContext(db: D1Database, userId: string): Promise<string> {
  const month = currentMonth();
  const startDate = `${month}-01`;
  const endDate = lastDayOfMonth(month);

  const [accounts, summaryRows, categories, recentTxns] = await Promise.all([
    fetchAccounts(db, userId),
    fetchSummary(db, userId, startDate, endDate),
    fetchCategoryBreakdown(db, userId, startDate, endDate),
    fetchRecentTransactions(db, userId, 5),
  ]);

  const { totalIncome, totalExpenses, totalFees, transactionCount } = assembleSummary(summaryRows);
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_pesewas ?? 0), 0);
  const net = totalIncome - totalExpenses;

  const lines: string[] = [];

  // Accounts
  lines.push('Accounts:');
  for (const acc of accounts) {
    lines.push(`- ${acc.name}: ${formatGHS(acc.balance_pesewas)}`);
  }
  lines.push(`Total balance: ${formatGHS(totalBalance)}`);
  lines.push('');

  // Monthly summary
  lines.push(`This month (${formatMonthName(month)}):`);
  lines.push(`- Income: ${formatGHS(totalIncome)}`);
  lines.push(`- Expenses: ${formatGHS(totalExpenses)}`);
  lines.push(`- Fees: ${formatGHS(totalFees)}`);
  lines.push(`- Net: ${net >= 0 ? '+' : '-'}${formatGHS(Math.abs(net))}`);
  lines.push(`- Transactions: ${transactionCount}`);
  lines.push('');

  // Top spending categories
  if (categories.length > 0) {
    lines.push('Top spending categories:');
    const topCats = categories.slice(0, 5);
    topCats.forEach((cat, i) => {
      const pct = totalExpenses > 0
        ? Math.round((cat.total_pesewas / totalExpenses) * 1000) / 10
        : 0;
      lines.push(`${i + 1}. ${cat.name}: ${formatGHS(cat.total_pesewas)} (${pct.toFixed(1)}%)`);
    });
    lines.push('');
  }

  // Recent transactions
  if (recentTxns.length > 0) {
    lines.push('Recent transactions:');
    for (const txn of recentTxns) {
      const date = txn.transaction_date.slice(5); // "MM-DD"
      const [m, d] = date.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateLabel = `${monthNames[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
      const sign = txn.type === 'credit' ? '+' : '-';
      const desc = txn.description || txn.counterparty || 'Transaction';
      const cat = txn.category_name ? ` (${txn.category_name})` : '';
      lines.push(`- ${dateLabel}: ${sign}${formatGHS(txn.amount_pesewas)} ${desc}${cat}`);
    }
  }

  return lines.join('\n');
}

/**
 * The full system prompt with financial context injected.
 */
export function buildSystemPrompt(financialContext: string): string {
  return `You are CediSense AI, a friendly and knowledgeable personal finance advisor for Ghanaians.

You understand:
- Ghana Cedis (GHS/₵), pesewas, Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo)
- Ghanaian financial culture: susu savings, market day spending, family obligations, church tithes
- Local costs: trotro fares, ECG prepaid, water bills, rent advances
- MoMo fee structures and how to minimize them
- Savings options: T-Bills, mutual funds, susu collectors

Guidelines:
- Be warm, practical, and non-judgmental
- Give specific advice based on the user's actual spending data
- Use ₵ formatting for all amounts (e.g., ₵1,234.56)
- When interpreting amounts from context, divide pesewas by 100 to get GHS
- Keep responses concise — 2-3 paragraphs max unless the user asks for detail
- If asked about something outside personal finance, politely redirect
- Never fabricate transaction data — only reference what's provided in the financial context below

Here is the user's current financial data:
${financialContext}`;
}
```

- [ ] **Step 2: Create ai-context.test.ts**

Create `apps/api/src/lib/ai-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './ai-context.js';

describe('buildSystemPrompt', () => {
  it('injects financial context into system prompt', () => {
    const context = 'Accounts:\n- MTN MoMo: ₵500.00\nTotal balance: ₵500.00';
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('CediSense AI');
    expect(prompt).toContain('MTN MoMo');
    expect(prompt).toContain('₵500.00');
    expect(prompt).toContain('Ghana Cedis');
    expect(prompt).toContain('susu');
  });

  it('includes all guideline sections', () => {
    const prompt = buildSystemPrompt('test context');

    expect(prompt).toContain('You understand:');
    expect(prompt).toContain('Guidelines:');
    expect(prompt).toContain('MoMo fee');
    expect(prompt).toContain('non-judgmental');
    expect(prompt).toContain('Never fabricate');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx vitest run src/lib/ai-context.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/ai-context.ts apps/api/src/lib/ai-context.test.ts
git commit -m "feat: add AI financial context builder with system prompt"
```

---

### Task 5: Create AI chat API route

**Files:**
- Create: `apps/api/src/routes/ai.ts`

This is the core task — streaming SSE endpoint, history, and clear.

- [ ] **Step 1: Create ai.ts**

Create `apps/api/src/routes/ai.ts`:

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { chatMessageSchema, chatHistoryQuerySchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { buildFinancialContext, buildSystemPrompt } from '../lib/ai-context.js';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

const AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const MAX_CONTEXT_MESSAGES = 15;
const DAILY_LIMIT_WARN = 40;

// POST /chat — streaming SSE response
ai.post('/chat', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = chatMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } },
      400
    );
  }

  const { message } = parsed.data;

  // Increment daily usage counter (read-then-write, not atomic — acceptable for soft limit)
  const today = new Date().toISOString().slice(0, 10);
  const kvKey = `ai-usage:${userId}:${today}`;
  const currentCount = parseInt(await c.env.KV.get(kvKey) ?? '0', 10);
  const newCount = currentCount + 1;
  await c.env.KV.put(kvKey, String(newCount), { expirationTtl: 86400 });

  // Fetch last N messages + clean orphaned trailing user messages
  const historyResult = await c.env.DB.prepare(
    `SELECT id, role, content FROM chat_messages WHERE user_id = ? ORDER BY rowid DESC LIMIT ?`
  ).bind(userId, MAX_CONTEXT_MESSAGES + 5).all();

  let history = (historyResult.results ?? []).reverse() as Array<{ id: string; role: string; content: string }>;

  // Clean orphaned trailing user messages (no assistant reply after them)
  while (history.length > 0 && history[history.length - 1].role === 'user') {
    const orphan = history.pop()!;
    await c.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(orphan.id).run();
  }

  // Trim to max context
  history = history.slice(-MAX_CONTEXT_MESSAGES);

  // Save user message
  const userMsgId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)'
  ).bind(userMsgId, userId, 'user', message).run();

  // Build AI context
  const financialContext = await buildFinancialContext(c.env.DB, userId);
  const systemPrompt = buildSystemPrompt(financialContext);

  // Build messages array for AI
  const aiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Call Workers AI with streaming
  let aiStream: ReadableStream;
  try {
    aiStream = await (c.env.AI.run as (model: string, input: Record<string, unknown>) => Promise<ReadableStream>)(
      AI_MODEL,
      { messages: aiMessages, stream: true, max_tokens: 1024 }
    );
  } catch {
    return c.json(
      { error: { code: 'AI_ERROR', message: 'Failed to generate response' } },
      500
    );
  }

  // Create SSE response stream
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let aiBuffer = ''; // Buffer for incomplete SSE lines across chunks

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const text = aiBuffer + chunk;

          // Workers AI SSE format: "data: {...}\n\n"
          const lines = text.split('\n');
          // Last element may be incomplete — keep as buffer
          aiBuffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const token = parsed.response ?? '';
              if (token) {
                fullResponse += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Send meta event
        const usageWarning = newCount > DAILY_LIMIT_WARN;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'meta', usage_warning: usageWarning, daily_count: newCount })}\n\n`)
        );

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));

        // Save assistant response to D1
        if (fullResponse.trim()) {
          const assistantMsgId = generateId();
          await c.env.DB.prepare(
            'INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)'
          ).bind(assistantMsgId, userId, 'assistant', fullResponse.trim()).run();
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// GET /history — conversation history
ai.get('/history', async (c) => {
  const userId = c.get('userId');
  const queryParams = {
    limit: c.req.query('limit'),
    before: c.req.query('before'),
  };

  const parsed = chatHistoryQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
      400
    );
  }

  const { limit, before } = parsed.data;
  let result;

  if (before) {
    result = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = ? AND rowid < (SELECT rowid FROM chat_messages WHERE id = ?)
       ORDER BY rowid DESC LIMIT ?`
    ).bind(userId, before, limit).all();
  } else {
    result = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = ? ORDER BY rowid DESC LIMIT ?`
    ).bind(userId, limit).all();
  }

  // Reverse to ASC order for display
  const messages = (result.results ?? []).reverse();

  return c.json({ data: messages });
});

// DELETE /history — clear all history
ai.delete('/history', async (c) => {
  const userId = c.get('userId');
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(userId).run();
  return c.body(null, 204);
});

export { ai };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/ai.ts
git commit -m "feat: add AI chat streaming endpoint with history and clear"
```

---

### Task 6: Mount AI route in API index

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add import and mount**

1. Add import after the dashboard import:
```typescript
import { ai } from './routes/ai.js';
```

2. Add middleware (after the dashboard middleware line):
```typescript
app.use('/api/v1/ai/*', authMiddleware, rateLimitMiddleware);
```

3. Add route mount (after the dashboard route mount):
```typescript
app.route('/api/v1/ai', ai);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: mount AI chat route with auth middleware"
```

---

## Chunk 3: Frontend Utilities (Markdown + Streaming)

### Task 7: Lightweight markdown renderer

**Files:**
- Create: `apps/web/src/lib/markdown.ts`
- Create: `apps/web/src/lib/markdown.test.ts`

- [ ] **Step 1: Create markdown.ts**

Create `apps/web/src/lib/markdown.ts`:

```typescript
/**
 * HTML-entity-encode a string to prevent XSS.
 * Applied BEFORE markdown transforms.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight markdown-to-HTML renderer for AI assistant messages.
 * Supports: **bold**, `inline code`, line breaks, unordered lists (- / *).
 * Input is entity-encoded first to prevent XSS.
 */
export function renderMarkdown(raw: string): string {
  // Step 1: Entity-encode to prevent XSS
  let html = escapeHtml(raw);

  // Step 2: Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Step 3: Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>');

  // Step 4: Process lines for lists and line breaks
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const isListItem = /^[-*]\s/.test(trimmed);

    if (isListItem) {
      if (!inList) {
        result.push('<ul class="list-disc pl-4 space-y-1">');
        inList = true;
      }
      result.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed === '') {
        result.push('<br />');
      } else {
        result.push(line);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  // Join with <br /> for non-list line breaks
  return result.join('<br />').replace(/(<br \/>){3,}/g, '<br /><br />');
}
```

- [ ] **Step 2: Create markdown.test.ts**

Create `apps/web/src/lib/markdown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    expect(renderMarkdown('Hello **world**')).toContain('<strong class="font-semibold">world</strong>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('Use `formatGHS`')).toContain('<code class="bg-white/10 px-1 rounded text-xs">formatGHS</code>');
  });

  it('renders unordered list', () => {
    const result = renderMarkdown('Items:\n- Apple\n- Banana');
    expect(result).toContain('<ul class="list-disc pl-4 space-y-1">');
    expect(result).toContain('<li>Apple</li>');
    expect(result).toContain('<li>Banana</li>');
    expect(result).toContain('</ul>');
  });

  it('escapes HTML to prevent XSS', () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('handles malformed HTML in AI output', () => {
    const result = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('preserves ₵ currency symbols', () => {
    const result = renderMarkdown('You spent ₵1,234.56 on food');
    expect(result).toContain('₵1,234.56');
  });

  it('converts line breaks', () => {
    const result = renderMarkdown('Line 1\nLine 2');
    expect(result).toContain('<br />');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/lib/markdown.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/markdown.ts apps/web/src/lib/markdown.test.ts
git commit -m "feat: add lightweight markdown renderer with XSS protection"
```

---

### Task 8: SSE stream parser

**Files:**
- Create: `apps/web/src/lib/streaming.ts`
- Create: `apps/web/src/lib/streaming.test.ts`

- [ ] **Step 1: Create streaming.ts**

Create `apps/web/src/lib/streaming.ts`:

```typescript
import { getAccessToken } from './api';

const API_BASE = '/api/v1';

export interface SSETokenEvent {
  type: 'token';
  content: string;
}

export interface SSEMetaEvent {
  type: 'meta';
  usage_warning: boolean;
  daily_count: number;
}

export interface SSEDoneEvent {
  type: 'done';
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = SSETokenEvent | SSEMetaEvent | SSEDoneEvent | SSEErrorEvent;

/**
 * Parse a chunk of SSE text into events.
 * Handles line buffering for chunks split across boundaries.
 * Returns [parsed events, remaining buffer].
 */
export function parseSSEChunk(buffer: string, chunk: string): [SSEEvent[], string] {
  const text = buffer + chunk;
  const events: SSEEvent[] = [];
  const lines = text.split('\n');

  // Last element may be incomplete — keep it as buffer
  const remaining = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;

    const jsonStr = trimmed.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const event = JSON.parse(jsonStr) as SSEEvent;
      events.push(event);
    } catch {
      // Skip malformed
    }
  }

  return [events, remaining];
}

/**
 * Send a chat message and stream the response.
 * Returns an async generator of SSE events.
 */
export async function* streamChat(
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent, void, unknown> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    yield { type: 'error', message: (error as { error: { message: string } }).error.message };
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const [events, remaining] = parseSSEChunk(buffer, chunk);
      buffer = remaining;

      for (const event of events) {
        yield event;
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const [events] = parseSSEChunk('', buffer + '\n');
      for (const event of events) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 2: Create streaming.test.ts**

Create `apps/web/src/lib/streaming.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSSEChunk } from './streaming';

describe('parseSSEChunk', () => {
  it('parses a complete token event', () => {
    const [events, buffer] = parseSSEChunk('', 'data: {"type":"token","content":"Hello"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'token', content: 'Hello' });
    expect(buffer).toBe('');
  });

  it('parses multiple events in one chunk', () => {
    const chunk = 'data: {"type":"token","content":"Hi"}\ndata: {"type":"token","content":" there"}\n';
    const [events, buffer] = parseSSEChunk('', chunk);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'token', content: 'Hi' });
    expect(events[1]).toEqual({ type: 'token', content: ' there' });
    expect(buffer).toBe('');
  });

  it('buffers incomplete lines across chunks', () => {
    const [events1, buffer1] = parseSSEChunk('', 'data: {"type":"tok');
    expect(events1).toHaveLength(0);
    expect(buffer1).toBe('data: {"type":"tok');

    const [events2, buffer2] = parseSSEChunk(buffer1, 'en","content":"Hi"}\n');
    expect(events2).toHaveLength(1);
    expect(events2[0]).toEqual({ type: 'token', content: 'Hi' });
    expect(buffer2).toBe('');
  });

  it('parses meta event', () => {
    const [events] = parseSSEChunk('', 'data: {"type":"meta","usage_warning":true,"daily_count":41}\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'meta', usage_warning: true, daily_count: 41 });
  });

  it('parses done event', () => {
    const [events] = parseSSEChunk('', 'data: {"type":"done"}\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'done' });
  });

  it('skips [DONE] marker', () => {
    const [events] = parseSSEChunk('', 'data: [DONE]\n');
    expect(events).toHaveLength(0);
  });

  it('skips malformed JSON', () => {
    const [events] = parseSSEChunk('', 'data: {broken json}\n');
    expect(events).toHaveLength(0);
  });

  it('ignores non-data lines', () => {
    const [events] = parseSSEChunk('', 'event: message\ndata: {"type":"token","content":"x"}\n');
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run src/lib/streaming.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/streaming.ts apps/web/src/lib/streaming.test.ts
git commit -m "feat: add SSE stream parser with line buffering and AbortController"
```

---

## Chunk 4: Frontend Chat Components

### Task 9: ChatBubble, TypingIndicator, UsageWarning

**Files:**
- Create: `apps/web/src/components/chat/ChatBubble.tsx`
- Create: `apps/web/src/components/chat/TypingIndicator.tsx`
- Create: `apps/web/src/components/chat/UsageWarning.tsx`

- [ ] **Step 1: Create ChatBubble.tsx**

```tsx
import { renderMarkdown } from '@/lib/markdown';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ChatBubble({ role, content, timestamp, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`${isUser ? 'max-w-[80%]' : 'max-w-[85%]'}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed text-white ${
            isUser
              ? 'bg-gold/20 rounded-2xl rounded-br-md'
              : 'bg-ghana-surface rounded-2xl rounded-bl-md border border-white/10'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div
              className="prose-chat"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-gold/60 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
        {timestamp && (
          <p className={`text-xs text-muted mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {formatRelativeTime(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TypingIndicator.tsx**

```tsx
export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-ghana-surface rounded-2xl rounded-bl-md border border-white/10 px-4 py-3 flex gap-1.5">
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted rounded-full motion-safe:animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create UsageWarning.tsx**

```tsx
interface UsageWarningProps {
  onDismiss: () => void;
}

export function UsageWarning({ onDismiss }: UsageWarningProps) {
  return (
    <div className="mx-4 mt-2 bg-gold/10 border border-gold/20 rounded-lg px-4 py-2 flex items-center justify-between">
      <p className="text-sm text-gold">You've used most of your daily AI chats</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-gold/60 hover:text-gold text-sm ml-2 shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/chat/ChatBubble.tsx apps/web/src/components/chat/TypingIndicator.tsx apps/web/src/components/chat/UsageWarning.tsx
git commit -m "feat: add ChatBubble, TypingIndicator, UsageWarning components"
```

---

### Task 10: ChatHeader, ChatInput, WelcomeMessage

**Files:**
- Create: `apps/web/src/components/chat/ChatHeader.tsx`
- Create: `apps/web/src/components/chat/ChatInput.tsx`
- Create: `apps/web/src/components/chat/WelcomeMessage.tsx`

- [ ] **Step 1: Create ChatHeader.tsx**

```tsx
import { useState } from 'react';

interface ChatHeaderProps {
  onClear: () => void;
  hasHistory: boolean;
}

export function ChatHeader({ onClear, hasHistory }: ChatHeaderProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-white/5">
      <span className="text-white text-lg font-semibold">✨ CediSense AI</span>
      {hasHistory && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-muted text-sm hover:text-white transition-colors"
        >
          Clear
        </button>
      )}
      {confirming && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-muted text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onClear(); setConfirming(false); }}
            className="text-expense text-xs px-2 py-1 rounded bg-expense/10 hover:bg-expense/20"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ChatInput.tsx**

```tsx
import { useState, useRef } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  function handleSubmit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-ghana-dark/95 backdrop-blur border-t border-white/5 px-4 py-3 z-10">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={disabled}
            maxLength={500}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
              placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
              disabled:opacity-50"
          />
          {value.length > 400 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {value.length}/500
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            canSend ? 'bg-gold text-ghana-black' : 'bg-white/20 text-muted'
          }`}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WelcomeMessage.tsx**

```tsx
interface WelcomeMessageProps {
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  'How am I spending?',
  'Tips to save on MoMo fees',
  'Summarize this month',
  'Am I on track?',
];

export function WelcomeMessage({ onSuggestion }: WelcomeMessageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <span className="text-4xl mb-4">✨</span>
      <h2 className="text-white text-lg font-semibold mb-2">Hi! I'm your CediSense AI advisor</h2>
      <p className="text-muted text-sm text-center mb-6">
        Ask me about your spending, savings tips, or financial goals
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestion(text)}
            className="bg-white/10 border border-white/10 rounded-full px-4 py-2 text-gold text-sm
              hover:bg-white/20 active:scale-95 transition-all"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles and commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/src/components/chat/ChatHeader.tsx apps/web/src/components/chat/ChatInput.tsx apps/web/src/components/chat/WelcomeMessage.tsx
git commit -m "feat: add ChatHeader, ChatInput, WelcomeMessage components"
```

---

## Chunk 5: Chat Page Assembly + App Integration

### Task 11: Create AIChatPage

**Files:**
- Create: `apps/web/src/pages/AIChatPage.tsx`

- [ ] **Step 1: Create AIChatPage.tsx**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { streamChat, type SSEEvent } from '@/lib/streaming';
import type { ChatMessage } from '@cedisense/shared';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { WelcomeMessage } from '@/components/chat/WelcomeMessage';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { UsageWarning } from '@/components/chat/UsageWarning';

export function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showUsageWarning, setShowUsageWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load history on mount
  useEffect(() => {
    api.get<ChatMessage[]>('/ai/history?limit=50')
      .then((data) => {
        setMessages(data);
        setIsLoadingHistory(false);
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => {
        setIsLoadingHistory(false);
      });
  }, [scrollToBottom]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Scroll on new messages or streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  async function handleSend(text: string) {
    setError(null);

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    // Start streaming
    const controller = new AbortController();
    abortRef.current = controller;

    let fullResponse = '';

    try {
      for await (const event of streamChat(text, controller.signal)) {
        switch (event.type) {
          case 'token':
            fullResponse += event.content;
            setStreamingContent(fullResponse);
            break;
          case 'meta':
            if (event.usage_warning) {
              setShowUsageWarning(true);
            }
            break;
          case 'done': {
            // Add assistant message to state
            const assistantMsg: ChatMessage = {
              id: `temp-${Date.now()}-ai`,
              role: 'assistant',
              content: fullResponse,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setStreamingContent('');
            break;
          }
          case 'error':
            setError(event.message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to get response. Try again.');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleClear() {
    try {
      await api.delete('/ai/history');
      setMessages([]);
      setStreamingContent('');
      setShowUsageWarning(false);
      setError(null);
    } catch {
      // Could show a toast, but keeping it simple
    }
  }

  const showWelcome = !isLoadingHistory && messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full pb-36 md:pb-20">
      <ChatHeader onClear={handleClear} hasHistory={messages.length > 0} />

      {showUsageWarning && (
        <UsageWarning onDismiss={() => setShowUsageWarning(false)} />
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {isLoadingHistory && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-12 rounded-xl bg-ghana-surface animate-pulse ${i % 2 === 0 ? 'w-3/4' : 'w-2/3 ml-auto'}`} />
            ))}
          </div>
        )}

        {showWelcome && <WelcomeMessage onSuggestion={handleSend} />}

        {!isLoadingHistory && messages.length > 0 && (
          <div className="max-w-2xl mx-auto">
            {messages.map((msg, i) => {
              const prevRole = i > 0 ? messages[i - 1].role : null;
              const gap = prevRole === msg.role ? 'mt-2' : 'mt-4';
              return (
                <div key={msg.id} className={i === 0 ? '' : gap}>
                  <ChatBubble
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.created_at}
                  />
                </div>
              );
            })}

            {/* Streaming assistant bubble */}
            {isStreaming && streamingContent && (
              <ChatBubble
                role="assistant"
                content={streamingContent}
                isStreaming
              />
            )}

            {/* Typing indicator before first token */}
            {isStreaming && !streamingContent && <TypingIndicator />}

            {/* Error bubble */}
            {error && !isStreaming && (
              <div className="flex justify-start">
                <div className="bg-expense/10 border border-expense/20 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%]">
                  <p className="text-expense text-sm">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUserMsg) {
                        setMessages((prev) => prev.filter(m => m.id !== lastUserMsg.id));
                        handleSend(lastUserMsg.content);
                      }
                    }}
                    className="text-gold text-xs mt-1 underline"
                  >
                    Tap to retry
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/AIChatPage.tsx
git commit -m "feat: add AIChatPage with streaming chat interface"
```

---

### Task 12: Wire AIChatPage into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add import**

Add after the ImportPage import (line 12):
```typescript
import { AIChatPage } from '@/pages/AIChatPage';
```

- [ ] **Step 2: Replace placeholder route**

Change line 55 from:
```tsx
<Route path="/ai-chat" element={<Placeholder name="AI Chat" />} />
```
To:
```tsx
<Route path="/ai-chat" element={<AIChatPage />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: wire AIChatPage into app routing"
```

---

## Chunk 6: Integration Verification

### Task 13: Full TypeScript + test verification

- [ ] **Step 1: TypeScript check all packages**

Run: `cd packages/shared && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All existing + new tests pass

- [ ] **Step 3: Fix any issues and commit**

---

### Task 14: Manual smoke test

- [ ] **Step 1: Apply migration**

Run the D1 migration locally: `cd apps/api && npx wrangler d1 execute cedisense-db --local --file=migrations/0003_chat_messages.sql`

- [ ] **Step 2: Start dev servers**

Run: `pnpm dev`

- [ ] **Step 3: Test AI chat flow**

1. Navigate to `/ai-chat`
2. Verify welcome message with suggestion chips
3. Tap a suggestion chip — verify streaming response appears
4. Send a custom message — verify it streams
5. Verify timestamps on messages
6. Navigate away and back — verify history loads
7. Clear history — verify welcome message returns
8. Test error state (disable network, try to send)

- [ ] **Step 4: Stop dev servers**
