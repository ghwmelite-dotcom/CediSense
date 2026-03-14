# AI Chat Advisor — Design Spec

## Overview

Build a conversational AI financial advisor powered by Workers AI (Qwen3-30B-A3B), with streaming responses, persistent chat history in D1, and rich financial context from the user's transaction data. Accessible via the existing `/ai-chat` route.

## Scope

**In scope:**
- Streaming chat endpoint (SSE) using `@cf/qwen/qwen3-30b-a3b-fp8`
- Persistent conversation history in D1
- Rich financial context per message (current month's dashboard data)
- Last 15 messages as conversation context
- Soft daily usage limit (40 messages/day) with KV counter and warning
- Chat UI with message bubbles, typing indicator, suggestion chips
- Clear history functionality
- Lightweight markdown rendering in assistant messages

**Out of scope:**
- Function calling / tool use (AI can't query specific data on demand)
- Multi-conversation sessions (single ongoing thread per user)
- Voice input
- Image/chart generation in responses
- Paid tier with higher limits

## Tech Stack

- **AI Model:** `@cf/qwen/qwen3-30b-a3b-fp8` via Workers AI binding (`env.AI`)
- **Streaming:** SSE (Server-Sent Events) via `fetch` ReadableStream
- **Storage:** D1 for chat history, KV for daily usage counter
- **Validation:** Zod schemas in `@cedisense/shared`

---

## Database

### Migration: `0003_chat_messages.sql`

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
```

Single ongoing conversation per user. No `conversation_id` — users clear history to start fresh.

---

## API Design

### Middleware Registration

```typescript
app.use('/api/v1/ai/*', authMiddleware, rateLimitMiddleware);
app.route('/api/v1/ai', ai);
```

### Endpoint 1: `POST /api/v1/ai/chat`

Send a message and receive a streaming SSE response.

**Request:**
```typescript
{ message: string }  // 1-500 characters
```

**Server-side flow:**
1. Validate message with Zod (non-empty, max 500 chars)
2. Increment daily usage counter in KV: key `ai-usage:{userId}:{YYYY-MM-DD}`, TTL 86400s
3. Fetch last 15 messages from D1 (ordered by `created_at ASC`) — before saving the new user message, to get clean context. Also clean up any orphaned trailing user messages (user message with no following assistant message, from a previous failed stream).
4. Save user message to `chat_messages` table
5. Fetch current month's dashboard data (reuse dashboard aggregation queries)
6. Build system prompt with financial context
7. Call Workers AI with `{ stream: true }`
8. Stream tokens via SSE, collecting the full response
9. After stream completes, save full assistant response to D1. If the stream fails or client disconnects before completion, the user message remains in D1 without a reply — this orphan is detected and cleaned up at the start of the next request (step 3).
10. If daily count > 40, include `usage_warning` in the SSE metadata

**Note:** The system prompt is never persisted to D1 — it is constructed fresh on every request from the financial context. Only `user` and `assistant` messages are stored.

**Response:** SSE stream with required headers:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```
No `Content-Length` header (chunked transfer).

```
data: {"type":"token","content":"Here"}
data: {"type":"token","content":"'s"}
data: {"type":"token","content":" what"}
data: {"type":"meta","usage_warning":true,"daily_count":41}
data: {"type":"done"}
```

SSE event types:
- `token` — a text chunk to append to the assistant message
- `meta` — metadata sent once after all tokens; includes `usage_warning` (boolean) and `daily_count` (number)
- `done` — stream is complete
- `error` — an error occurred: `{"type":"error","message":"..."}`

**Error responses (non-streaming, JSON):**
- 400: `{ error: { code: 'VALIDATION_ERROR', message: '...' } }` for invalid input
- 500: `{ error: { code: 'AI_ERROR', message: 'Failed to generate response' } }` — `AI_ERROR` is a new error code distinct from `INTERNAL_ERROR`, allowing the client to show a retry-specific message

### Endpoint 2: `GET /api/v1/ai/history`

Fetch conversation history for display.

**Query params:**
- `limit` — number of messages to return (default 50, max 100)
- `before` — message ID for cursor-based pagination (optional)

**Response:** `{ data: ChatMessage[] }` ordered by `created_at ASC` (oldest first).

The `ChatMessage` type:
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
```

**SQL (cursor uses rowid for stability — `created_at` has only second precision):**
```sql
-- Without cursor:
SELECT id, role, content, created_at
FROM chat_messages
WHERE user_id = ?
ORDER BY rowid DESC
LIMIT ?

-- With cursor:
SELECT id, role, content, created_at
FROM chat_messages
WHERE user_id = ? AND rowid < (SELECT rowid FROM chat_messages WHERE id = ?)
ORDER BY rowid DESC
LIMIT ?
```

Results reversed to ASC on the server before returning. Uses `rowid` instead of `created_at` for cursor stability — multiple messages can share the same `created_at` timestamp (second precision).

### Endpoint 3: `DELETE /api/v1/ai/history`

Clear all conversation history for the user.

**SQL:**
```sql
DELETE FROM chat_messages WHERE user_id = ?
```

**Response:** `204 No Content`

---

## System Prompt

```
You are CediSense AI, a friendly and knowledgeable personal finance advisor for Ghanaians.

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
{financial_context}
```

### Financial Context Format

Built from the dashboard aggregation queries (same as `GET /api/v1/dashboard`):

```
Accounts:
- MTN MoMo: ₵1,234.56
- GCB Savings: ₵5,678.90
Total balance: ₵6,913.46

This month (March 2026):
- Income: ₵3,500.00
- Expenses: ₵2,100.00
- Fees: ₵45.50
- Net: +₵1,400.00
- Transactions: 47

Top spending categories:
1. Food & Groceries: ₵650.00 (31.0%)
2. Transport: ₵420.00 (20.0%)
3. Utilities: ₵350.00 (16.7%)
4. Family Support: ₵280.00 (13.3%)
5. Airtime & Data: ₵150.00 (7.1%)

Recent transactions:
- Mar 14: -₵25.00 Trotro (Transport)
- Mar 14: -₵180.00 Melcom (Shopping)
- Mar 13: +₵3,500.00 Salary (Income)
- Mar 12: -₵50.00 ECG Prepaid (Utilities)
- Mar 11: -₵35.00 MTN Data Bundle (Airtime & Data)
```

This is assembled server-side by `apps/api/src/lib/ai-context.ts`. The dashboard aggregation queries (accounts, summary, categories, recent transactions) are extracted from `apps/api/src/routes/dashboard.ts` into a shared helper (e.g., `apps/api/src/lib/dashboard-queries.ts`) so both the dashboard route and the AI context builder can reuse them. Amounts are converted from pesewas to GHS for the prompt.

---

## Frontend Design

### Page Layout

```
AIChatPage
├── ChatHeader          — title + clear button
├── MessageList         — scrollable messages
│   ├── WelcomeMessage  — shown when empty
│   ├── ChatBubble[]    — user (right) + assistant (left)
│   └── TypingIndicator — during streaming
├── UsageWarning        — banner when > 40 msgs/day
└── ChatInput           — sticky bottom input
```

### ChatHeader

- Sticky top (below AppShell TopBar on desktop)
- Left: "✨ CediSense AI" — text-lg font-semibold text-white
- Right: "Clear" button — text-sm text-muted, triggers confirmation
- Background: ghana-dark/95 backdrop-blur, border-b border-white/5

### MessageList

- `flex flex-col overflow-y-auto` filling available height between header and input
- Auto-scrolls to bottom on new messages and during streaming
- On mount, fetches `GET /api/v1/ai/history?limit=50`
- If no history, shows WelcomeMessage instead

### WelcomeMessage

- Centered in the message area
- ✨ icon (text-4xl)
- "Hi! I'm your CediSense AI advisor" — text-white text-lg font-semibold
- "Ask me about your spending, savings tips, or financial goals" — text-muted text-sm
- Suggestion chips below:
  - "How am I spending?"
  - "Tips to save on MoMo fees"
  - "Summarize this month"
  - "Am I on track?"
- Chips: `bg-white/10 border border-white/10 rounded-full px-4 py-2 text-gold text-sm`
- Tapping a chip sends its text as a message

### ChatBubble

**User bubble:**
- Right-aligned, `max-w-[80%]`
- `bg-gold/20 text-white rounded-2xl rounded-br-md px-4 py-2.5`
- Plain text (no markdown)

**Assistant bubble:**
- Left-aligned, `max-w-[85%]`
- `bg-ghana-surface text-white rounded-2xl rounded-bl-md px-4 py-2.5 border border-white/10`
- Lightweight markdown rendering (bold, lists, line breaks, inline code)

**Both:**
- Timestamp below: relative time in text-xs text-muted
- Fade-in animation on appear (motion-safe)

### TypingIndicator

- Styled like an assistant bubble but with three pulsing dots
- Dots: `w-2 h-2 bg-muted rounded-full` with staggered animation delay
- Shown after user sends message, replaced by streaming content on first token

### ChatInput

- Sticky bottom, above BottomNav on mobile (`bottom-20 md:bottom-0`)
- Container: `bg-ghana-dark/95 backdrop-blur border-t border-white/5 px-4 py-3`
- Input: `bg-white/10 border border-white/10 rounded-xl` — single-line input, placeholder "Ask about your finances..."
- Send button: `w-10 h-10 rounded-full bg-gold flex items-center justify-center` with arrow icon
- Send disabled when: input empty OR currently streaming
- Submit on Enter (Shift+Enter does nothing in single-line input)
- Character counter: shown when > 400 chars as "450/500" text-xs text-muted
- Input cleared after sending

### UsageWarning

- Banner between ChatHeader and MessageList
- `bg-gold/10 border border-gold/20 rounded-lg px-4 py-2 mx-4 mt-2`
- Text: "You've used most of your daily AI chats" — text-sm text-gold
- Dismiss button (X) on the right
- Only shown when `usage_warning: true` received in SSE meta event
- Stays dismissed for the session (React state)

### Streaming Implementation

Frontend uses `fetch()` with the response body as a `ReadableStream`:

```typescript
const response = await fetch('/api/v1/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ message }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  // Parse SSE lines: "data: {...}\n\n"
  // Handle token/meta/done/error events
}
```

This avoids `EventSource` (which doesn't support POST or custom headers).

**Important implementation notes for `apps/web/src/lib/streaming.ts`:**
- The SSE parser must buffer incomplete lines across chunks — a single `reader.read()` call may return partial JSON split across chunk boundaries
- Use `AbortController` to cancel the fetch on component unmount or user navigation, preventing orphaned Workers AI inference:
  ```typescript
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal, ... });
  // On cleanup: controller.abort();
  ```

### Responsive Layout

**Mobile (<768px):**
- Full screen, messages fill between header and input
- Input bar: `fixed bottom-20` (above BottomNav)
- Messages: `pb-36` to account for input + BottomNav

**Desktop (≥768px):**
- Centered container: `max-w-2xl mx-auto`
- Input bar: sticky bottom of the container
- Messages fill available height

### Error States

- **Stream error:** Show error bubble: "Something went wrong. Tap to retry." Tapping resends the message.
- **History load error:** "Couldn't load chat history" with retry, input still works
- **Clear history error:** Toast notification "Failed to clear history"
- **Network offline:** Send button disabled, show "You're offline" in input area

---

## Styling

### Colors

| Element | Color | Token |
|---------|-------|-------|
| User bubble | gold/20 | bg-gold/20 |
| Assistant bubble | #1A1A2E | bg-ghana-surface |
| Assistant border | white/10 | border-white/10 |
| Send button | #D4A843 | bg-gold |
| Send disabled | white/20 | bg-white/20 |
| Typing dots | #888888 | bg-muted |
| Usage warning | gold/10 | bg-gold/10 |
| Timestamps | #888888 | text-muted |
| Suggestion chip bg | white/10 | bg-white/10 |
| Suggestion chip text | #D4A843 | text-gold |

### Animations

- **Message appear:** Fade-in + 4px upward translate, 150ms ease-out (motion-safe)
- **Typing dots:** Staggered pulse with CSS keyframes (0ms, 150ms, 300ms delay)
- **Suggestion chip tap:** `active:scale-95` transition
- **All animations:** Respect `prefers-reduced-motion`

### Typography

- Header title: text-lg font-semibold
- Message text: text-sm leading-relaxed
- Timestamps: text-xs text-muted
- Character counter: text-xs text-muted
- Suggestion chips: text-sm

### Spacing

- Message gap: 8px between same-role, 16px between role changes
- Bubble padding: px-4 py-2.5
- Input bar padding: px-4 py-3
- Page horizontal padding: px-4

---

## Markdown Rendering

Lightweight regex-based transforms on assistant message content. No heavy library.

**Supported:**
- `**bold**` → `<strong class="font-semibold">`
- `\n` → `<br />`
- Lines starting with `- ` or `* ` → `<li>` wrapped in `<ul class="list-disc pl-4 space-y-1">`
- `` `inline code` `` → `<code class="bg-white/10 px-1 rounded text-xs">`

**Sanitization:** HTML-entity-encode the raw AI content (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`) **before** applying markdown transforms. This is safer than regex tag stripping (which fails on malformed tags, split chunks, etc.) and ensures no raw HTML can execute.

Render with `dangerouslySetInnerHTML` after entity-encoding + markdown transform.

---

## Types (additions to packages/shared/src/types.ts)

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type ChatRole = 'user' | 'assistant';
```

## Validation (additions to packages/shared/src/schemas.ts)

```typescript
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

---

## File Structure

### New Files
- `apps/api/migrations/0003_chat_messages.sql` — Chat messages table
- `apps/api/src/routes/ai.ts` — AI chat endpoints (chat, history, clear)
- `apps/api/src/lib/ai-context.ts` — Build financial context string from dashboard queries
- `apps/web/src/pages/AIChatPage.tsx` — Full chat page
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/ChatBubble.tsx`
- `apps/web/src/components/chat/ChatInput.tsx`
- `apps/web/src/components/chat/WelcomeMessage.tsx`
- `apps/web/src/components/chat/TypingIndicator.tsx`
- `apps/web/src/components/chat/UsageWarning.tsx`
- `apps/web/src/lib/markdown.ts` — Lightweight markdown renderer
- `apps/web/src/lib/streaming.ts` — SSE stream parser for fetch ReadableStream

### Modified Files
- `packages/shared/src/types.ts` — Add `ChatMessage`, `ChatRole`
- `packages/shared/src/schemas.ts` — Add `chatMessageSchema`, `chatHistoryQuerySchema`, inferred types
- `apps/api/src/index.ts` — Mount AI route with auth middleware
- `apps/api/src/routes/dashboard.ts` — Extract aggregation queries to shared helper
- `apps/web/src/App.tsx` — Replace AI chat placeholder with real `AIChatPage`

### New Shared Files (extracted from dashboard)
- `apps/api/src/lib/dashboard-queries.ts` — Shared aggregation queries used by both dashboard route and AI context builder

### Test Files
- `apps/api/src/lib/ai-context.test.ts` — Financial context builder tests
- `apps/web/src/lib/markdown.test.ts` — Markdown renderer tests
- `apps/web/src/lib/streaming.test.ts` — SSE parser tests
