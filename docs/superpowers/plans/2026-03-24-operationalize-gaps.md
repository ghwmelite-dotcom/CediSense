# Operationalize Remaining Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operationalize the 3 remaining non-functional features: full Notifications page, Notification Preferences in Settings, and real CSV/PDF export endpoints.

**Architecture:** Backend-first approach — add export API endpoints on the Worker (CSV for transactions, server-rendered HTML for reports), then build the frontend pages/components that consume them. Notifications page has its own standalone data management (not coupled to the dropdown hook). Settings preferences section calls existing `/notifications/preferences` API. Report export reuses shared query helpers from `dashboard-queries.ts`.

**Tech Stack:** Hono (API routes), React + Tailwind (frontend), Cloudflare Workers (runtime), Zod (validation), existing CediSense design system (premium-card, btn-gold, etc.)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `apps/web/src/pages/NotificationsPage.tsx` | Full-page notification history with filters, own data fetching |
| `apps/web/src/components/settings/NotificationsSection.tsx` | Push toggle + per-group mute toggles in Settings |
| `apps/api/src/routes/export.ts` | CSV transaction export + server-rendered HTML report export |

### Modified Files
| File | Change |
|------|--------|
| `apps/web/src/App.tsx` | Add `/notifications` route |
| `apps/web/src/components/shared/NotificationPanel.tsx` | Add "See all" footer link to `/notifications` |
| `apps/web/src/pages/SettingsPage.tsx` | Add NotificationsSection card |
| `apps/api/src/index.ts` | Mount export routes with auth + rate limit |
| `apps/web/src/pages/TransactionFeedPage.tsx` | Replace existing print-based Export button with CSV download |
| `apps/web/src/pages/InsightsPage.tsx` | Replace print button with fetch-then-blob PDF approach |

---

## Task 1: Notifications Page

**Files:**
- Create: `apps/web/src/pages/NotificationsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/shared/NotificationPanel.tsx`

**Note:** The NotificationsPage manages its own API calls and state. It does NOT reuse the `useNotifications` hook because that hook is tightly coupled to the dropdown panel (depends on `isOpen` state, smaller batch size). The page needs: independent data fetching on mount, larger page size (30), intersection observer for infinite scroll, and filter state.

### Step-by-step

- [ ] **Step 1: Create `NotificationsPage.tsx`**

Create `apps/web/src/pages/NotificationsPage.tsx` with standalone data management:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Notification } from '@cedisense/shared';
import { NotificationItem } from '@/components/shared/NotificationItem';

const PAGE_SIZE = 30;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'susu_contribution', label: 'Contributions' },
  { key: 'susu_payout', label: 'Payouts' },
  { key: 'susu_vote', label: 'Votes' },
  { key: 'susu_member', label: 'Members' },
  { key: 'susu_chat', label: 'Chat' },
] as const;
```

Key implementation details:
- Own `useState` for `notifications`, `cursor`, `hasMore`, `isLoading`, `filter`
- Fetch from `/notifications?limit=30` on mount (not gated by `isOpen`)
- For "unread" filter, use `unread_only=1` query param (server-side efficient)
- For type filters, client-side filter by `notification.type.startsWith(filterKey)`
- Date grouping: group by `created_at` date → labels "Today", "Yesterday", "Mar 22", etc.
- Use `useNavigate` to handle notification press → deep-link via `getDeepLink()` helper
- Mark-read on press via `api.patch(\`/notifications/${id}/read\`)`
- "Mark all read" button in header via `api.patch('/notifications/read-all')`
- Infinite scroll via IntersectionObserver on sentinel div at bottom
- Empty state with bell icon when no notifications match filter
- Page header with accent line matching other pages' style
- Staggered animations matching the app's `motion-safe:animate-slide-up` pattern

- [ ] **Step 2: Register route in `App.tsx`**

Add lazy import and route:

```tsx
// After line 27 (CollectorPage import):
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

// Inside the protected AppShell route group (after line 110, the collector route):
<Route path="/notifications" element={<NotificationsPage />} />
```

- [ ] **Step 3: Add "See all" footer link to NotificationPanel dropdown**

In `apps/web/src/components/shared/NotificationPanel.tsx`, add a footer link below the notification list div. The `navigate` and `onClose` are already available in scope (line 68: `const navigate = useNavigate()`).

```tsx
// After the closing </div> of the notification list (the div with className="overflow-y-auto max-h-[420px]..."):
<div className="border-t border-white/5 px-4 py-2.5">
  <button
    type="button"
    onClick={() => { navigate('/notifications'); onClose(); }}
    className="w-full text-center text-xs text-info hover:text-info/80 transition-colors font-medium"
  >
    See all notifications
  </button>
</div>
```

- [ ] **Step 4: Verify and commit**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

```bash
git add apps/web/src/pages/NotificationsPage.tsx apps/web/src/App.tsx apps/web/src/components/shared/NotificationPanel.tsx
git commit -m "feat: add full notifications page with filters and 'See all' link"
```

---

## Task 2: Notification Preferences in Settings

**Files:**
- Create: `apps/web/src/components/settings/NotificationsSection.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`

### Step-by-step

- [ ] **Step 1: Create `NotificationsSection.tsx`**

Create `apps/web/src/components/settings/NotificationsSection.tsx`:

This component:
- Fetches preferences from `GET /notifications/preferences` → `NotificationPreferences` type
- Fetches user's susu groups from `GET /susu/groups` (to show group names for mute toggles)
- Shows push notification master toggle (calls `PUT /notifications/preferences` with `{ push_enabled }`)
- Shows list of susu groups with mute/unmute toggles (calls `PUT /notifications/preferences` with `{ muted_groups }`)
- Optimistic UI updates on toggle

```tsx
// Structure:
// ┌─────────────────────────────────────┐
// │ Notifications                       │
// │                                     │
// │ Push Notifications          [toggle]│
// │ Get alerts on your device           │
// │                                     │
// │ ─── Group Notifications ──────────  │
// │                                     │
// │ Susu Group Alpha            [toggle]│
// │ Susu Group Beta             [toggle]│
// │ Family Fund                 [toggle]│
// │                                     │
// │ (toggle OFF = group is muted)       │
// └─────────────────────────────────────┘
```

Key implementation:
- `api.get<NotificationPreferences>('/notifications/preferences')` on mount
- `api.get<SusuGroup[]>('/susu/groups')` to get group names (import type from shared)
- Push toggle: `api.put('/notifications/preferences', { push_enabled: !current })`
- Group mute toggle: compute new `muted_groups` array (add/remove group_id), then `api.put('/notifications/preferences', { muted_groups })`
- Muted groups: if `group_id` is in `prefs.muted_groups`, toggle shows OFF (muted). Toggling removes from array (unmute) or adds (mute).
- Uses same section header pattern as `ProfileSection`, `AccountsSection` etc.
- Show "No groups yet" message if user has no susu groups

- [ ] **Step 2: Add NotificationsSection to SettingsPage**

In `apps/web/src/pages/SettingsPage.tsx`:

```tsx
// Add import:
import { NotificationsSection } from '@/components/settings/NotificationsSection';

// After the RulesSection card (after line 201), before the Sign out section:
{/* Notifications */}
<div
  className="motion-safe:animate-slide-up"
  style={{ animationDelay: '240ms', animationFillMode: 'both' }}
>
  <SettingsCard accentColor="bg-info">
    <NotificationsSection />
  </SettingsCard>
</div>
```

Update the Sign out section's `animationDelay` from `'240ms'` to `'300ms'`.

- [ ] **Step 3: Verify and commit**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

```bash
git add apps/web/src/components/settings/NotificationsSection.tsx apps/web/src/pages/SettingsPage.tsx
git commit -m "feat: add notification preferences section to Settings (push toggle + group mute)"
```

---

## Task 3: CSV Export for Transactions

**Files:**
- Create: `apps/api/src/routes/export.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/web/src/pages/TransactionFeedPage.tsx`

### Step-by-step

- [ ] **Step 1: Create export route — CSV endpoint**

Create `apps/api/src/routes/export.ts`:

**Security note:** The SQL uses parameterized queries — only `?` placeholders are appended to the SQL string, never raw user input. All values go through `.bind(...params)`.

```typescript
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

const exportRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /export/transactions/csv
 * Query params: account_id, category_id, from, to (all optional)
 * Returns: text/csv with Content-Disposition header for download
 */
exportRoutes.get('/transactions/csv', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const categoryId = c.req.query('category_id');
  const from = c.req.query('from');
  const to = c.req.query('to');

  // Build query with parameterized filters (only ? placeholders appended, never raw values)
  let sql = `
    SELECT t.transaction_date, t.type, t.amount_pesewas, t.fee_pesewas,
           t.description, t.counterparty, t.reference, t.source,
           c.name AS category_name, a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (accountId) { sql += ' AND t.account_id = ?'; params.push(accountId); }
  if (categoryId) { sql += ' AND t.category_id = ?'; params.push(categoryId); }
  if (from) { sql += ' AND t.transaction_date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.transaction_date <= ?'; params.push(to); }

  sql += ' ORDER BY t.transaction_date DESC LIMIT 5000';

  const { results } = await c.env.DB.prepare(sql).bind(...params).all();

  // Build CSV with BOM for Excel compatibility
  const header = 'Date,Type,Amount (GHS),Fee (GHS),Description,Counterparty,Reference,Category,Account,Source';
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = (results ?? []).map((r: Record<string, unknown>) => {
    const amt = (((r.amount_pesewas as number) ?? 0) / 100).toFixed(2);
    const fee = (((r.fee_pesewas as number) ?? 0) / 100).toFixed(2);
    return [
      r.transaction_date, r.type, amt, fee,
      escape(r.description), escape(r.counterparty), escape(r.reference),
      escape(r.category_name), escape(r.account_name), r.source ?? 'manual',
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel correctly interprets special characters (e.g. ₵)
  const csv = '\uFEFF' + [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cedisense-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

export { exportRoutes };
```

- [ ] **Step 2: Mount export routes in `index.ts`**

In `apps/api/src/index.ts`:

```typescript
// Add import (after notifications import):
import { exportRoutes } from './routes/export.js';

// Add middleware (after notifications middleware block):
app.use('/api/v1/export', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/export/*', authMiddleware, rateLimitMiddleware);

// Add route mount (after notifications route mount):
app.route('/api/v1/export', exportRoutes);
```

- [ ] **Step 3: Replace existing Export button in TransactionFeedPage with CSV download**

In `apps/web/src/pages/TransactionFeedPage.tsx`, **replace** the existing "Export" button (which opens `/print/transactions` in a new tab) with a CSV download button. The existing filter variables are: `accountFilter`, `categoryFilter`, `fromFilter`, `toFilter`.

```tsx
// Import getAccessToken at top:
import { api, getAccessToken } from '@/lib/api';

// Add handler function inside the component:
async function handleExportCSV() {
  const params = new URLSearchParams();
  if (accountFilter) params.set('account_id', accountFilter);
  if (categoryFilter) params.set('category_id', categoryFilter);
  if (fromFilter) params.set('from', fromFilter);
  if (toFilter) params.set('to', toFilter);

  const response = await fetch(`/api/v1/export/transactions/csv?${params}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cedisense-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Replace the existing Export button's onClick from:
//   onClick={() => window.open('/print/transactions', '_blank')}
// To:
//   onClick={handleExportCSV}
// Keep the same button styling (btn-gold or equivalent).
```

- [ ] **Step 4: Verify and commit**

Run: `cd apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`
Expected: No type errors

```bash
git add apps/api/src/routes/export.ts apps/api/src/index.ts apps/web/src/pages/TransactionFeedPage.tsx
git commit -m "feat: add CSV export for transactions with filter support"
```

---

## Task 4: PDF Export for Insights Report

**Files:**
- Modify: `apps/api/src/routes/export.ts`
- Modify: `apps/web/src/pages/InsightsPage.tsx`

**Critical auth note:** `window.open()` sends a plain GET with no Authorization header. Since the auth token is in-memory (not a cookie), the new endpoint would get 401. Solution: fetch via `api` helper with auth, create Blob URL, then open that.

### Step-by-step

- [ ] **Step 1: Add server-rendered HTML report endpoint**

In `apps/api/src/routes/export.ts`, add a new endpoint. Import and reuse the shared query helpers from `dashboard-queries.ts` (same ones used by the insights route):

```typescript
// Add imports at top of export.ts:
import {
  fetchSummary,
  fetchCategoryBreakdown,
  assembleSummary,
  currentMonth,
  lastDayOfMonth,
  previousMonth,
  type CategoryRow,
} from '../lib/dashboard-queries.js';

/**
 * GET /export/report/html?month=YYYY-MM
 * Returns: self-contained HTML document optimized for print-to-PDF
 * Called via fetch (with Bearer token), not window.open.
 */
exportRoutes.get('/report/html', async (c) => {
  const userId = c.get('userId');
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'month param required (YYYY-MM)' } }, 400);
  }

  const now = currentMonth();
  if (month > now) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot export future months.' } }, 400);
  }

  const prevMonth = previousMonth(month);
  const curStart = `${month}-01`;
  const curEnd = lastDayOfMonth(month);
  const prevStart = `${prevMonth}-01`;
  const prevEnd = lastDayOfMonth(prevMonth);

  const [curSummaryRows, curCategoryRows, prevSummaryRows, prevCategoryRows] = await Promise.all([
    fetchSummary(c.env.DB, userId, curStart, curEnd),
    fetchCategoryBreakdown(c.env.DB, userId, curStart, curEnd),
    fetchSummary(c.env.DB, userId, prevStart, prevEnd),
    fetchCategoryBreakdown(c.env.DB, userId, prevStart, prevEnd),
  ]);

  const curSummary = assembleSummary(curSummaryRows);
  const prevSummary = assembleSummary(prevSummaryRows);
  const net = curSummary.totalIncome - curSummary.totalExpenses;

  // Build category trends (same logic as insights route)
  const currentMap = new Map<string, CategoryRow>();
  const previousMap = new Map<string, CategoryRow>();
  for (const row of curCategoryRows) currentMap.set(row.id, row);
  for (const row of prevCategoryRows) previousMap.set(row.id, row);
  const allIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

  // Format GHS helper
  const fmtGHS = (pesewas: number) => `GHS ${(pesewas / 100).toFixed(2)}`;

  // Month label
  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });

  // Build category rows HTML
  let categoryRowsHtml = '';
  const sortedIds = [...allIds].sort((a, b) => {
    const aTotal = (currentMap.get(a)?.total_pesewas ?? 0) + (previousMap.get(a)?.total_pesewas ?? 0);
    const bTotal = (currentMap.get(b)?.total_pesewas ?? 0) + (previousMap.get(b)?.total_pesewas ?? 0);
    return bTotal - aTotal;
  }).slice(0, 10);

  for (const id of sortedIds) {
    const cur = currentMap.get(id);
    const prev = previousMap.get(id);
    const meta = cur ?? prev!;
    const curP = cur?.total_pesewas ?? 0;
    const prevP = prev?.total_pesewas ?? 0;
    const changePct = prevP > 0 ? Math.round(((curP - prevP) / prevP) * 1000) / 10 : (curP > 0 ? 100 : 0);
    const changeColor = changePct <= 0 ? '#22c55e' : '#ef4444';
    categoryRowsHtml += `<tr>
      <td>${meta.icon} ${meta.name}</td>
      <td>${fmtGHS(curP)}</td>
      <td>${fmtGHS(prevP)}</td>
      <td style="color:${changeColor}">${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%</td>
    </tr>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CediSense Report - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e; line-height: 1.5; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f8f8fa; font-weight: 600; border-bottom: 2px solid #e5e5e5; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    .total-row td { font-weight: 700; border-top: 2px solid #e5e5e5; }
    .text-credit { color: #22c55e; }
    .text-debit { color: #ef4444; }
    .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>CediSense Monthly Report</h1>
  <p class="subtitle">${monthLabel}</p>

  <h2>Summary</h2>
  <table>
    <thead><tr><th>Metric</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Income</td><td class="text-credit">${fmtGHS(curSummary.totalIncome)}</td></tr>
      <tr><td>Expenses</td><td class="text-debit">${fmtGHS(curSummary.totalExpenses)}</td></tr>
      <tr><td>Fees</td><td>${fmtGHS(curSummary.totalFees)}</td></tr>
      <tr class="total-row"><td>Net</td><td class="${net >= 0 ? 'text-credit' : 'text-debit'}">${net >= 0 ? '+' : '-'}${fmtGHS(Math.abs(net))}</td></tr>
      <tr><td>Transactions</td><td>${curSummary.transactionCount}</td></tr>
    </tbody>
  </table>

  <h2>Spending by Category</h2>
  <table>
    <thead><tr><th>Category</th><th>Current Month</th><th>Previous Month</th><th>Change</th></tr></thead>
    <tbody>${categoryRowsHtml}</tbody>
  </table>

  <p class="footer">Generated by CediSense &mdash; Built by Hodges &amp; Co.</p>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
```

- [ ] **Step 2: Update Insights page "Export PDF" button to use fetch-then-blob approach**

In `apps/web/src/pages/InsightsPage.tsx`, **replace** the existing `window.open` call with a fetch that includes the auth token, creates a Blob URL, then opens it:

```tsx
// Import getAccessToken:
import { api, getAccessToken } from '@/lib/api';

// Replace the existing Export PDF button onClick handler:
async function handleExportPDF() {
  const token = getAccessToken();
  const res = await fetch(`/api/v1/export/report/html?month=${month}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return; // silently fail or show toast
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up after a delay to allow the new tab to load
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Change the button from:
//   onClick={() => window.open(`/print/report?month=${month}`, '_blank')}
// To:
//   onClick={handleExportPDF}
```

- [ ] **Step 3: Verify and commit**

Run: `cd apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`
Expected: No type errors

```bash
git add apps/api/src/routes/export.ts apps/web/src/pages/InsightsPage.tsx
git commit -m "feat: add server-rendered HTML report export for Insights PDF"
```

---

## Task 5: Deploy and Verify

- [ ] **Step 1: Build frontend**

```bash
cd apps/web && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Deploy API worker**

```bash
cd apps/api && npx wrangler deploy
```
Expected: Worker deployed successfully.

- [ ] **Step 3: Deploy frontend**

```bash
cd apps/web && npx wrangler pages deploy dist
```
Expected: Pages deployed successfully.

- [ ] **Step 4: Verify all 3 features on production**

1. Navigate to `/notifications` — should show full notification list with filter tabs
2. Go to `/settings` — should see Notifications section with push toggle and group mutes
3. Go to `/transactions` — should see "Export CSV" button, click to download `.csv` file
4. Go to `/insights` — click "Export PDF", should open clean report in new tab with print dialog

- [ ] **Step 5: Final commit if any hotfixes needed**

```bash
git add -A && git commit -m "fix: post-deploy hotfixes for operationalization features"
```
