# CediSense — AI-Powered Personal Finance Dashboard for Ghana

## Project Plan & Claude Code Implementation Guide

**Parent Company:** Hodges & Co. Limited
**Sub-brand:** CediSense (working name)
**Target Market:** Ghana
**Stack:** React/Vite + Cloudflare (Workers, D1, KV, R2, Pages, **Workers AI**)
**AI Model:** `@cf/qwen/qwen3-30b-a3b-fp8` (Qwen3 30B MoE — best free-tier performer)
**Currency:** Ghana Cedis (GHS / ₵)

---

## 1. Executive Summary

CediSense is an AI-powered personal finance dashboard designed specifically for Ghanaians. Unlike Plaid-based solutions built for US/EU markets, CediSense is architected around Ghana's dominant financial infrastructure: **Mobile Money** (MTN MoMo, Vodafone Cash, AirtelTigo Money) and **local banks** (GCB, Ecobank, Fidelity, Stanbic, etc.).

The platform ingests transaction data through multiple channels (SMS parsing, MoMo API, CSV/statement upload, and manual entry), categorizes spending using AI, and provides actionable budgeting advice via **Cloudflare Workers AI** (Qwen3 30B MoE) — all contextualized to the Ghanaian economy (inflation rates, market prices, GHS purchasing power, susu culture, etc.). **Zero external API costs** — the AI runs entirely on Cloudflare's free tier.

---

## 2. Ghana Financial Landscape — Key Design Decisions

### Why NOT Plaid
- Plaid does not operate in Ghana
- Ghana's open banking framework is still maturing
- Mobile Money is the dominant financial channel, not traditional bank accounts

### Data Ingestion Strategy (Priority Order)

| Channel | Coverage | Implementation Complexity |
|---------|----------|--------------------------|
| **SMS Parsing (Primary)** | MTN MoMo, Vodafone Cash, AirtelTigo, Bank alerts | Medium — PWA reads forwarded SMS or user pastes |
| **MTN MoMo Open API** | MTN MoMo merchants/collections | High — requires MTN partner onboarding |
| **CSV/PDF Statement Upload** | All banks, MoMo statements | Low — parse uploaded files |
| **Manual Entry** | Universal fallback | Low |
| **Mono API (Future)** | Select Ghana banks (pilot phase) | Medium — Mono has Ghana pilot with GTBank, Fidelity, MTN |

### Key Ghana Context for AI
- **Mobile Money dominance:** 74+ million registered accounts as of early 2025
- **Inflation awareness:** GHS purchasing power fluctuates; AI advice must account for this
- **Susu/savings culture:** Traditional rotating savings groups are common
- **Market day spending patterns:** Periodic market purchases (Kejetia, Makola, etc.)
- **Remittances:** Diaspora inflows are a major income source
- **Utility payments:** ECG, Ghana Water, DSTV, internet bundles
- **Transport costs:** Trotro, Bolt/Uber, fuel

---

## 3. Technical Architecture

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)              │
│              Cloudflare Pages — cedisense.com         │
│                                                       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard│ │Txn List  │ │Budgets   │ │AI Chat   │ │
│  │Overview │ │& Search  │ │& Goals   │ │Advisor   │ │
│  └─────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐              │
│  │SMS      │ │Statement │ │Manual    │              │
│  │Import   │ │Upload    │ │Entry     │              │
│  └─────────┘ └──────────┘ └──────────┘              │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS / REST API
┌───────────────────────▼──────────────────────────────┐
│               API LAYER (Cloudflare Workers)          │
│                                                       │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────┐│
│  │ Auth Worker   │  │ Transaction    │  │ AI Worker ││
│  │ (JWT/Session) │  │ Worker (CRUD,  │  │ (Workers  ││
│  │               │  │ categorize,    │  │  AI       ││
│  │               │  │ parse SMS/CSV) │  │  binding) ││
│  └──────────────┘  └────────────────┘  └───────────┘│
│  ┌──────────────┐  ┌────────────────┐               │
│  │ Budget Worker │  │ Insights       │               │
│  │ (goals,      │  │ Worker (spend  │               │
│  │  alerts)     │  │ analysis, AI)  │               │
│  └──────────────┘  └────────────────┘               │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                  DATA LAYER (Cloudflare)              │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ D1       │  │ KV       │  │ R2       │           │
│  │ Database │  │ Sessions,│  │ Statement│           │
│  │ (users,  │  │ cache,   │  │ uploads, │           │
│  │ txns,    │  │ rate     │  │ exports  │           │
│  │ budgets, │  │ limits   │  │          │           │
│  │ cats)    │  │          │  │          │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└──────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (Cloudflare D1 — SQLite)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phone TEXT UNIQUE NOT NULL,          -- Ghana phone: 0XX XXX XXXX
  email TEXT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,              -- 4-digit PIN (mobile-first auth)
  monthly_income_ghs REAL DEFAULT 0,
  preferred_language TEXT DEFAULT 'en', -- en, tw (Twi), ee (Ewe), dag (Dagbani)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Accounts (MoMo wallets, bank accounts, cash)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                   -- "MTN MoMo", "GCB Savings", "Cash"
  type TEXT NOT NULL,                   -- momo | bank | cash | susu
  provider TEXT,                        -- mtn | vodafone | airteltigo | gcb | ecobank | fidelity | stanbic | etc
  account_number TEXT,                  -- masked: ****1234
  balance_ghs REAL DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Categories (Ghana-contextualized defaults + custom)
CREATE TABLE categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT,                         -- NULL = system default
  name TEXT NOT NULL,
  icon TEXT,                            -- emoji
  color TEXT,                           -- hex
  type TEXT NOT NULL,                   -- income | expense | transfer
  parent_id TEXT REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0
);

-- Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT REFERENCES categories(id),
  type TEXT NOT NULL,                   -- credit | debit | transfer
  amount_ghs REAL NOT NULL,
  fee_ghs REAL DEFAULT 0,              -- MoMo fees, bank charges
  description TEXT,
  raw_text TEXT,                        -- original SMS or import text
  counterparty TEXT,                    -- who you paid / received from
  reference TEXT,                       -- MoMo transaction ID
  source TEXT NOT NULL,                 -- sms_import | csv_import | manual | momo_api
  transaction_date TEXT NOT NULL,
  categorized_by TEXT DEFAULT 'ai',     -- ai | user | rule
  created_at TEXT DEFAULT (datetime('now'))
);

-- Budgets
CREATE TABLE budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  amount_ghs REAL NOT NULL,
  period TEXT NOT NULL,                 -- weekly | monthly | custom
  start_date TEXT NOT NULL,
  end_date TEXT,
  alert_threshold REAL DEFAULT 0.8,    -- alert at 80% spent
  created_at TEXT DEFAULT (datetime('now'))
);

-- Savings Goals
CREATE TABLE savings_goals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                   -- "New Phone", "Rent Deposit", "Susu Contribution"
  target_ghs REAL NOT NULL,
  current_ghs REAL DEFAULT 0,
  target_date TEXT,
  icon TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI Chat History
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,                   -- user | assistant
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- SMS Parsing Rules (learned patterns)
CREATE TABLE sms_patterns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT NOT NULL,               -- mtn_momo | vodafone_cash | airteltigo | gcb | ecobank | etc
  pattern_regex TEXT NOT NULL,
  field_mapping TEXT NOT NULL,          -- JSON: which capture groups map to which fields
  sample_sms TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Category Rules (auto-categorization)
CREATE TABLE category_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  match_type TEXT NOT NULL,             -- contains | exact | regex
  match_value TEXT NOT NULL,            -- "ECG" | "DSTV" | "BOLT"
  category_id TEXT NOT NULL REFERENCES categories(id),
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_txn_user_date ON transactions(user_id, transaction_date);
CREATE INDEX idx_txn_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_txn_source ON transactions(source);
CREATE INDEX idx_budget_user ON budgets(user_id);
CREATE INDEX idx_goals_user ON savings_goals(user_id);
CREATE INDEX idx_accounts_user ON accounts(user_id);
```

### Default Categories (Ghana-Contextualized)

```json
[
  { "name": "Food & Groceries", "icon": "🍚", "type": "expense", "children": [
    "Market Shopping", "Street Food / Chop Bar", "Restaurant", "Supermarket"
  ]},
  { "name": "Transport", "icon": "🚐", "type": "expense", "children": [
    "Trotro / Bus", "Bolt / Uber", "Fuel", "Taxi / Dropping"
  ]},
  { "name": "Utilities", "icon": "💡", "type": "expense", "children": [
    "ECG (Electricity)", "Ghana Water", "Internet / WiFi", "TV (DSTV/GOtv)", "Airtime & Data"
  ]},
  { "name": "Rent & Housing", "icon": "🏠", "type": "expense" },
  { "name": "Health", "icon": "🏥", "type": "expense", "children": [
    "Pharmacy", "Hospital / Clinic", "NHIS", "Lab Tests"
  ]},
  { "name": "Education", "icon": "📚", "type": "expense", "children": [
    "School Fees", "Books & Supplies", "Extra Classes"
  ]},
  { "name": "Church / Tithe", "icon": "⛪", "type": "expense" },
  { "name": "Family Support", "icon": "👨‍👩‍👧‍👦", "type": "expense", "children": [
    "Remittance Sent", "Extended Family", "Funeral Contribution", "Naming Ceremony"
  ]},
  { "name": "Mobile Money Fees", "icon": "📱", "type": "expense" },
  { "name": "Shopping", "icon": "🛍️", "type": "expense", "children": [
    "Clothing", "Electronics", "Home Items"
  ]},
  { "name": "Entertainment", "icon": "🎉", "type": "expense", "children": [
    "Outings", "Betting / Lotto", "Events"
  ]},
  { "name": "Savings / Susu", "icon": "🏦", "type": "expense" },
  { "name": "Salary", "icon": "💰", "type": "income" },
  { "name": "Business Income", "icon": "📈", "type": "income" },
  { "name": "Remittance Received", "icon": "🌍", "type": "income" },
  { "name": "MoMo Transfer In", "icon": "📲", "type": "income" },
  { "name": "Side Hustle", "icon": "💼", "type": "income" },
  { "name": "Interest / Returns", "icon": "📊", "type": "income" }
]
```

---

## 5. SMS Parsing Engine — Ghana Providers

### Sample MTN MoMo SMS Patterns

```
// Cash Out
"You have done a cash-out of GHS 200.00 from your MoMo wallet. Fee charged: GHS 1.50.
Transaction ID: 1234567890. Your new balance is GHS 1,543.20."

// Transfer Sent
"Transfer of GHS 50.00 to KWAME ASANTE (024XXXXXXX) is successful.
Transaction ID: 9876543210. Fee: GHS 0.50. Balance: GHS 1,492.70."

// Transfer Received
"You have received GHS 100.00 from AMA MENSAH (055XXXXXXX).
Transaction ID: 1122334455. Your new balance is GHS 1,592.70."

// Payment (Merchant)
"Payment of GHS 35.00 to SHOPRITE ACCRA MALL successful.
Ref: PAY-20240315-001. Balance: GHS 1,557.70."

// Airtime Purchase
"You have bought GHS 10.00 airtime. Balance: GHS 1,547.70."
```

### Regex Patterns (Workers)

```javascript
const MTN_MOMO_PATTERNS = [
  {
    name: 'cash_out',
    regex: /cash-out of GHS\s?([\d,]+\.?\d*).+?Fee charged:\s?GHS\s?([\d,]+\.?\d*).+?Transaction ID:\s?(\d+).+?balance is GHS\s?([\d,]+\.?\d*)/is,
    fields: { amount: 1, fee: 2, reference: 3, balance: 4, type: 'debit' }
  },
  {
    name: 'transfer_sent',
    regex: /Transfer of GHS\s?([\d,]+\.?\d*)\s?to\s?(.+?)\s?\((\d+)\).+?Transaction ID:\s?(\d+).+?Fee:\s?GHS\s?([\d,]+\.?\d*).+?Balance:\s?GHS\s?([\d,]+\.?\d*)/is,
    fields: { amount: 1, counterparty: 2, counterparty_phone: 3, reference: 4, fee: 5, balance: 6, type: 'debit' }
  },
  {
    name: 'transfer_received',
    regex: /received GHS\s?([\d,]+\.?\d*)\s?from\s?(.+?)\s?\((\d+)\).+?Transaction ID:\s?(\d+).+?balance is GHS\s?([\d,]+\.?\d*)/is,
    fields: { amount: 1, counterparty: 2, counterparty_phone: 3, reference: 4, balance: 5, type: 'credit' }
  },
  {
    name: 'payment_merchant',
    regex: /Payment of GHS\s?([\d,]+\.?\d*)\s?to\s?(.+?)\s?successful.+?Ref:\s?(.+?)\.?\s?Balance:\s?GHS\s?([\d,]+\.?\d*)/is,
    fields: { amount: 1, counterparty: 2, reference: 3, balance: 4, type: 'debit' }
  },
  {
    name: 'airtime',
    regex: /bought GHS\s?([\d,]+\.?\d*)\s?airtime.+?Balance:\s?GHS\s?([\d,]+\.?\d*)/is,
    fields: { amount: 1, balance: 2, type: 'debit', auto_category: 'Airtime & Data' }
  }
];

// Similar patterns needed for:
// - Vodafone Cash
// - AirtelTigo Money
// - Bank SMS alerts (GCB, Ecobank, Fidelity, Stanbic, etc.)
```

---

## 6. AI Engine — Cloudflare Workers AI (100% Free Tier)

### Why Workers AI + Qwen3-30B-A3B

Cloudflare Workers AI runs open-source models on serverless GPUs at the edge. The free tier gives **10,000 neurons/day** — and the model choice makes all the difference in how far that budget stretches.

**`@cf/qwen/qwen3-30b-a3b-fp8`** is the clear winner:

| Model | Quality | Neurons per Chat Msg* | Daily Free Capacity |
|-------|---------|----------------------|-------------------|
| **Qwen3-30B-A3B (MoE)** | ★★★★★ Near GPT-4o | ~15 neurons | **~660 messages** |
| Llama 3.1 8B fp8-fast | ★★★☆☆ Good | ~11 neurons | ~900 messages |
| Llama 4 Scout 17B | ★★★★☆ Very Good | ~28 neurons | ~357 messages |
| Llama 3.3 70B | ★★★★★ Excellent | ~67 neurons | ~149 messages |
| Granite 4.0 Micro | ★★☆☆☆ Basic | ~4 neurons | ~2,500 messages |

*\*Based on ~500 input tokens (with context) + 400 output tokens per message*

**Why Qwen3-30B-A3B is the sweet spot:**
- 30B total parameters but only **3B active** at runtime (Mixture-of-Experts)
- Priced at tiny-model rates but performs at frontier-model levels
- Scores **91.0 on ArenaHard** — rivaling GPT-4o
- Supports **thinking mode** (for complex budget analysis) and **non-thinking mode** (for quick answers)
- **Function calling** support for structured responses
- Multilingual — handles Twi, Ewe, and Dagbani prompts reasonably well
- **No API key needed** — uses native Workers AI binding (env.AI)

### Tiered Model Strategy (Maximize Free Neurons)

```
┌─────────────────────────────────────────────────────────────┐
│                    MODEL ROUTING STRATEGY                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TASK: Transaction Categorization (bulk, simple)              │
│  MODEL: @cf/ibm-granite/granite-4.0-h-micro                  │
│  WHY: Ultra-cheap (~2.5 neurons/call), good enough for       │
│       classifying "ECG PREPAID" → Utilities/Electricity       │
│  BUDGET: ~4,000 categorizations/day on free tier              │
│                                                               │
│  TASK: AI Chat Advisor (conversational, contextual)           │
│  MODEL: @cf/qwen/qwen3-30b-a3b-fp8                          │
│  WHY: Best quality/cost ratio, understands financial context, │
│       supports thinking mode for budget planning              │
│  BUDGET: ~660 conversations/day on free tier                  │
│                                                               │
│  TASK: Monthly Report / Deep Analysis (complex, rare)         │
│  MODEL: @cf/qwen/qwen3-30b-a3b-fp8 (with /think mode)       │
│  WHY: Thinking mode enables chain-of-thought for complex      │
│       financial analysis at same neuron cost                   │
│  BUDGET: Shared with chat budget                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### wrangler.toml — Workers AI Binding

```toml
[ai]
binding = "AI"
```

That's it. No API keys, no external fetch calls. The `AI` binding is available in your Worker automatically.

### System Prompt for Financial Advisor

```javascript
const SYSTEM_PROMPT = `You are CediSense AI, a personal finance advisor for Ghanaians.
You must respond in non-thinking mode by default (concise, actionable answers).
Only use thinking mode when the user asks for deep analysis or budget planning.

CONTEXT:
- All amounts are in Ghana Cedis (GHS / ₵)
- You understand Ghana's financial landscape: Mobile Money (MoMo), susu savings, market trading, trotro fares, ECG prepaid, NHIS, school fees, church tithes, family obligations
- You know that extended family financial support is culturally important but should be budgeted
- You understand GHS inflation and purchasing power concerns
- You know common expenses: rent advances (1-2 years typical), funerals, naming ceremonies, weddings
- You're aware of MoMo fees and how they add up

PERSONALITY:
- Warm, practical, encouraging — like a financially savvy older sibling
- Use relatable Ghanaian examples (Kejetia prices, trotro fares, light bill struggles)
- Never judgmental about spending on family, church, or cultural obligations
- Suggest practical savings strategies (susu groups, MoMo savings lock, T-Bills via apps)

CAPABILITIES:
- Analyze spending patterns from transaction data
- Create personalized budgets based on Ghanaian cost of living
- Suggest ways to reduce MoMo fees
- Help plan for large expenses (rent advances, school fees, funerals)
- Provide investment awareness (Ghana T-Bills, mutual funds, MoMo savings)
- Track progress toward savings goals

RULES:
- Always be honest about limitations
- Never provide specific investment advice — only general awareness
- Flag if spending in any category exceeds healthy thresholds
- Celebrate progress and milestones
- Keep responses concise and actionable (under 300 words unless deep analysis requested)
- If asked about specific products, note you're not affiliated with any provider`;
```

### AI Worker — Chat Endpoint (Workers AI Binding)

```javascript
// POST /api/ai/chat
export async function handleAIChat(request, env) {
  const { userId, message } = await request.json();

  // Fetch user's financial context
  const userContext = await getUserFinancialSummary(env.DB, userId);
  
  // Build context message
  const contextMessage = `
USER FINANCIAL SNAPSHOT:
- Monthly Income: ₵${userContext.monthlyIncome}
- This Month's Spending: ₵${userContext.thisMonthSpending}
- Top Categories: ${userContext.topCategories.map(c => `${c.name}: ₵${c.total}`).join(', ')}
- Active Budgets: ${userContext.budgets.map(b => `${b.name}: ₵${b.spent}/₵${b.limit}`).join(', ')}
- Savings Goals: ${userContext.goals.map(g => `${g.name}: ₵${g.current}/₵${g.target}`).join(', ')}
- Account Balances: ${userContext.accounts.map(a => `${a.name}: ₵${a.balance}`).join(', ')}
- MoMo Fees This Month: ₵${userContext.momoFees}
`;

  // Get conversation history (last 10 messages)
  const history = await getConversationHistory(env.DB, userId, 10);

  // ✅ Call Workers AI directly via binding — no API key, no fetch!
  const aiResponse = await env.AI.run(
    '@cf/qwen/qwen3-30b-a3b-fp8',
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextMessage },
        ...history,
        { role: 'user', content: message }
      ],
      max_tokens: 800,
      temperature: 0.7,
      top_p: 0.9
    }
  );

  const aiReply = aiResponse.response;

  // Save to conversation history
  await saveConversation(env.DB, userId, 'user', message);
  await saveConversation(env.DB, userId, 'assistant', aiReply);

  return new Response(JSON.stringify({ reply: aiReply }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### AI Worker — Transaction Categorization (Cheap Model)

```javascript
// Bulk categorize transactions using the ultra-cheap Granite Micro model
export async function categorizeTransactions(transactions, env) {
  const results = [];

  for (const txn of transactions) {
    const prompt = `Categorize this Ghana financial transaction into exactly one category.

CATEGORIES: Food & Groceries, Transport, Utilities, Rent & Housing, Health, Education,
Church/Tithe, Family Support, Mobile Money Fees, Shopping, Entertainment, Savings/Susu,
Salary, Business Income, Remittance Received, MoMo Transfer In, Side Hustle, Interest/Returns

TRANSACTION: "${txn.description}" | Amount: ₵${txn.amount} | Type: ${txn.type}

Respond with ONLY the category name, nothing else.`;

    const response = await env.AI.run(
      '@cf/ibm-granite/granite-4.0-h-micro',  // Ultra-cheap: ~2.5 neurons per call
      {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.1
      }
    );

    results.push({
      transactionId: txn.id,
      category: response.response.trim()
    });
  }

  return results;
}
```

### AI Worker — Streaming Response (SSE)

```javascript
// POST /api/ai/chat/stream — Server-Sent Events for real-time chat
export async function handleAIChatStream(request, env) {
  const { userId, message } = await request.json();
  const userContext = await getUserFinancialSummary(env.DB, userId);
  const history = await getConversationHistory(env.DB, userId, 10);

  // Workers AI supports streaming natively!
  const stream = await env.AI.run(
    '@cf/qwen/qwen3-30b-a3b-fp8',
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildContextMessage(userContext) },
        ...history,
        { role: 'user', content: message }
      ],
      max_tokens: 800,
      temperature: 0.7,
      stream: true  // ← Enable SSE streaming
    }
  );

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Neuron Budget Calculator

```
DAILY FREE BUDGET: 10,000 neurons

Example daily usage for ~50 active users:
─────────────────────────────────────────────
  5 AI chat messages/user × 50 users = 250 messages
  250 × 15 neurons = 3,750 neurons (chat)

  10 categorizations/user × 50 users = 500 categorizations
  500 × 2.5 neurons = 1,250 neurons (categorization)

  TOTAL: 5,000 neurons/day — well within free tier!
─────────────────────────────────────────────

Scaling beyond free tier:
  $0.011 per 1,000 neurons
  1,000 chat messages = 15,000 neurons = $0.165
  That's ₵0.0027 per AI chat message at current rates
```

---

## 7. Feature Roadmap — Phased Build

### Phase 1: MVP (Weeks 1–3) ✦ Claude Code Sprint
**Goal:** Working dashboard with manual entry + SMS paste import + AI chat

- [ ] Project scaffolding (React/Vite + Cloudflare Workers + D1)
- [ ] Auth system (phone + PIN, JWT via Workers)
- [ ] D1 schema migration & seed default categories
- [ ] Manual transaction entry form
- [ ] SMS paste & parse engine (MTN MoMo patterns)
- [ ] Transaction list with search/filter
- [ ] Basic dashboard (total income, expenses, balance, category breakdown)
- [ ] AI chat advisor (Claude API integration)
- [ ] Simple budget creation & tracking
- [ ] PWA manifest + service worker
- [ ] Deploy to Cloudflare Pages

### Phase 2: Smart Features (Weeks 4–6)
**Goal:** CSV import, auto-categorization, insights

- [ ] CSV/PDF bank statement parser (upload to R2, parse via Worker)
- [ ] Vodafone Cash & AirtelTigo SMS patterns
- [ ] Bank SMS alert patterns (GCB, Ecobank, Fidelity)
- [ ] AI auto-categorization with learning from user corrections
- [ ] Category rules engine (user-defined auto-categorization)
- [ ] Spending insights dashboard (trends, comparisons, anomalies)
- [ ] Savings goals with progress tracking
- [ ] Budget alerts (KV-based notification triggers)
- [ ] Monthly spending report (AI-generated summary)

### Phase 3: Growth & Polish (Weeks 7–10)
**Goal:** Multi-language, sharing, advanced AI

- [ ] Twi language support (and/or Ewe, Dagbani)
- [ ] Recurring transaction detection
- [ ] Bill reminders (ECG, water, rent, school fees)
- [ ] Export reports (PDF via R2)
- [ ] Expense splitting (shared costs with friends/family)
- [ ] Dark mode
- [ ] Offline support (PWA + IndexedDB sync)
- [ ] Onboarding flow with financial health assessment

### Phase 4: Future (Post-Launch)
- [ ] MTN MoMo Open API integration (requires partner account)
- [ ] Mono API integration (when Ghana coverage matures)
- [ ] WhatsApp/Telegram bot for transaction logging
- [ ] USSD interface for feature phone users
- [ ] Investment tracking (T-Bills, mutual funds)
- [ ] Susu group management feature
- [ ] Family financial planning tools

---

## 8. Claude Code Prompts — Implementation Sequence

### Prompt 1: Project Scaffolding

```
Create a new React/Vite project called "cedisense" with the following:
- React 18 with TypeScript
- Tailwind CSS (mobile-first, Ghana-themed color palette: gold #D4A843, green #006B3F, black #1A1A1A, white)
- React Router v6 with these routes:
  / (Dashboard), /transactions, /budgets, /goals, /ai-chat, /settings, /login
- Cloudflare Pages deployment config (wrangler.toml)
- Cloudflare Workers API in /api directory with:
  - wrangler.toml for Workers
  - D1 binding (database name: cedisense-db)
  - KV binding (namespace: CEDISENSE_KV)
  - R2 binding (bucket: cedisense-uploads)
  - Workers AI binding (for Qwen3-30B-A3B and Granite Micro)
- PWA manifest with Ghana flag colors
- Mobile-first responsive layout with bottom navigation bar
- Shared types in /shared/types.ts
```

### Prompt 2: Database & Auth

```
Implement the D1 database schema and auth system:

1. Create migration files in /api/migrations/ with the full schema
   (users, accounts, categories, transactions, budgets, savings_goals, 
   ai_conversations, sms_patterns, category_rules)

2. Create a seed script that populates default Ghana-contextualized categories

3. Implement auth Worker endpoints:
   POST /api/auth/register - phone, name, pin (hash with bcrypt)
   POST /api/auth/login - phone, pin → JWT token
   POST /api/auth/verify - verify JWT
   
   Use phone number as primary identifier (Ghana format: 0XX XXX XXXX)
   Store JWT in httpOnly cookie
   PIN is 4-digit numeric (mobile-friendly)

4. Create auth middleware for protected routes
5. Create React auth context with login/register screens
```

### Prompt 3: Transaction Engine & SMS Parser

```
Build the transaction management system:

1. Create Worker endpoints:
   POST /api/transactions - create manual transaction
   GET /api/transactions?month=&category=&type= - list with filters
   PUT /api/transactions/:id - update (recategorize)
   DELETE /api/transactions/:id

2. Build SMS parsing engine in /api/lib/sms-parser.ts:
   - MTN MoMo patterns (cash-out, transfer sent/received, payment, airtime)
   - Vodafone Cash patterns
   - AirtelTigo Money patterns
   - Return structured transaction data from raw SMS text
   - Handle GHS amount parsing (commas in thousands)

3. POST /api/transactions/import-sms endpoint:
   - Accept array of SMS texts
   - Parse each through pattern matching
   - Deduplicate by reference/transaction ID
   - Auto-categorize using category_rules table
   - Return parsed results for user confirmation

4. React components:
   - TransactionForm (manual entry with amount, category picker, date, notes)
   - SMSImportModal (paste SMS text area, shows parsed preview, confirm button)
   - TransactionList (grouped by date, swipe to edit category)
   - CategoryPicker (grid of icons with Ghana categories)
```

### Prompt 4: Dashboard & Charts

```
Build the main dashboard:

1. GET /api/dashboard endpoint returning:
   - Total balance across all accounts
   - This month income vs expenses
   - Spending by category (top 5)
   - Daily spending trend (last 30 days)
   - Budget status (% used per budget)
   - Savings goals progress
   - Recent transactions (last 5)

2. React Dashboard page with:
   - Balance card (primary account balance, total across accounts)
   - Income vs Expense summary card with GHS formatting (₵1,234.56)
   - Category breakdown donut chart (use recharts)
   - Daily spending bar chart (last 30 days)
   - Budget progress bars
   - Quick actions: Add Transaction, Import SMS, Ask AI
   
   Use GHS formatting everywhere: ₵ prefix, comma thousands, 2 decimal places
   Mobile-first: cards stack vertically, charts responsive
   Color theme: gold accents, dark greens, clean whites
```

### Prompt 5: AI Chat Advisor

```
Build the AI financial advisor chat:

1. Worker endpoints:
   POST /api/ai/chat - send message, get AI response
   GET /api/ai/history - get conversation history
   DELETE /api/ai/history - clear history

2. The AI chat Worker should:
   - Fetch user's complete financial snapshot (income, spending, budgets, goals, balances)
   - Include last 10 messages as conversation history
   - Use the CediSense AI system prompt (Ghana-contextualized)
   - Call Workers AI via env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {...})
   - Save both user message and AI response to ai_conversations table
   - Support SSE streaming via { stream: true } option
   - Also implement a categorization endpoint using env.AI.run('@cf/ibm-granite/granite-4.0-h-micro')
     for cheap bulk transaction classification

3. React AI Chat page:
   - Chat bubble interface (user messages right, AI left)
   - Quick suggestion chips: "How am I doing?", "Where can I save?", 
     "MoMo fees this month?", "Budget for next month"
   - Loading indicator while AI responds
   - Markdown rendering for AI responses
   - Clear history button

4. Quick insight prompts available from Dashboard:
   - "Analyze my spending this month"
   - "Help me create a budget"
   - "How can I reduce my MoMo fees?"
   - "Am I on track for my savings goals?"
```

### Prompt 6: Budgets & Savings Goals

```
Build budget management and savings goals:

1. Worker endpoints:
   POST /api/budgets - create budget
   GET /api/budgets - list all with spending progress
   PUT /api/budgets/:id - update
   DELETE /api/budgets/:id
   
   POST /api/goals - create savings goal
   GET /api/goals - list all with progress
   PUT /api/goals/:id - update (including adding funds)
   DELETE /api/goals/:id

2. Budget logic:
   - Calculate spent amount from transactions in budget period + category
   - Return percentage used and remaining amount
   - Support weekly and monthly periods

3. React pages:
   - BudgetList: cards showing each budget with progress bar, spent/limit
   - BudgetForm: select category, set amount, choose period
   - GoalsList: visual cards with progress rings
   - GoalForm: name, target amount, target date, icon picker
   - Goal detail with "Add Funds" button (logs as a transaction)
```

---

## 9. Deployment & Configuration

### Cloudflare Wrangler Config

```toml
# wrangler.toml (Workers API)
name = "cedisense-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

# ✅ Workers AI — no API key needed, just a binding!
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

### Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWT tokens |
| `ENVIRONMENT` | production / staging / development |

> **Note:** No AI API keys needed! Workers AI uses a native binding (`env.AI`) — authentication is handled automatically by Cloudflare.

---

## 10. Monetization Strategy

| Tier | Price (GHS/month) | Features |
|------|-------------------|----------|
| **Free** | ₵0 | 50 transactions/month, basic dashboard, 5 AI chats/month |
| **Plus** | ₵15–25 | Unlimited transactions, full AI advisor, CSV import, budgets |
| **Pro** | ₵40–60 | Everything + PDF reports, multi-account, priority support |

**Payment Integration:** Paystack Ghana (supports MoMo & card payments)

---

## 11. Competitive Advantage

1. **Ghana-first design** — not a US tool localized; built for MoMo, cedis, and local spending patterns
2. **SMS-based import** — works without bank API access, which is Ghana's reality
3. **AI that understands Ghanaian context** — susu, family obligations, market day spending, ECG
4. **100% Cloudflare-native** — Workers AI, D1, KV, R2, Pages — entire stack on one platform
5. **$0 AI costs** — Qwen3-30B via Workers AI free tier handles ~660 chats + 4,000 categorizations daily
6. **PWA** — works offline, installable, no Play Store friction
7. **Low cost to run** — Cloudflare's generous free tiers make this viable as a bootstrapped product
8. **Edge performance** — AI inference runs on Cloudflare's global network, low latency from Ghana (PoPs in Lagos)

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| SMS formats change | Version patterns, crowdsource updates from users |
| Users hesitant about SMS data | All processing local/on-device where possible, clear privacy policy |
| MoMo API access difficult | SMS parsing is primary; API is Phase 4 enhancement |
| Low smartphone penetration in rural areas | Phase 4 USSD interface |
| GHS inflation makes budgets stale | AI advisor factors in inflation; periodic budget review prompts |
| Competition from M-Pesa/MoMo built-in tools | CediSense aggregates ALL accounts, not just one provider |
| Workers AI free tier exceeded (10K neurons/day) | Tiered model strategy (Granite Micro for bulk tasks); rate limit AI chats per user; Workers Paid is only $0.011/1K neurons |
| Qwen3 model quality for Ghanaian context | Fine-tune system prompt iteratively; fallback to Llama 4 Scout if needed; user feedback loop |

---

## 13. Getting Started — Claude Code Commands

```bash
# 1. Initialize the project
claude "Set up a new React/Vite + Cloudflare Workers monorepo for CediSense, 
a personal finance dashboard. Follow the project plan in cedisense-project-plan.md.
Include Workers AI binding in wrangler.toml ([ai] binding = 'AI')"

# 2. Database
claude "Create the D1 migration files and seed data based on the schema in the project plan"

# 3. Auth
claude "Implement phone + PIN authentication with JWT using Cloudflare Workers"

# 4. Core features (iterate)
claude "Build the SMS parsing engine for MTN MoMo transaction messages"
claude "Build the transaction management CRUD API and React components"
claude "Build the dashboard with spending charts using recharts"
claude "Build the AI chat advisor using Cloudflare Workers AI binding (env.AI).
Use @cf/qwen/qwen3-30b-a3b-fp8 for chat and @cf/ibm-granite/granite-4.0-h-micro
for transaction categorization. Include SSE streaming support."
claude "Build budget tracking and savings goals features"

# 5. Deploy
claude "Configure Cloudflare Pages deployment and Workers routes for production"
```

---

*Plan created: March 2026*
*Author: Ozzy (Hodges & Co. Limited)*
*Stack: React/Vite • Cloudflare Workers/D1/KV/R2/Pages/**Workers AI** • Qwen3-30B-A3B (MoE)*
*AI Cost: **$0/month** on free tier (10,000 neurons/day)*
