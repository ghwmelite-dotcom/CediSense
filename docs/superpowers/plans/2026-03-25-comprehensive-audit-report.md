# CediSense Comprehensive Audit Report

**Date:** 2026-03-25
**Scope:** Full codebase — API (apps/api), Frontend (apps/web), Shared (packages/shared)
**Domains:** Security (OWASP Top 10), Performance, Database Optimization

---

## Executive Summary

**Overall Health: GOOD — 7.5/10**

The codebase demonstrates strong foundational practices: prepared statements everywhere, secure PIN hashing (PBKDF2-SHA256), single-use refresh tokens, comprehensive rate limiting, and proper CORS/CSP headers. The frontend has good code splitting with lazy-loaded pages and accessible animations.

However, there are **6 critical items** requiring immediate action, **12 high-priority items**, and **18 medium-priority improvements**.

---

## CRITICAL (Fix Immediately)

### 1. XSS in HTML Report Export
**Domain:** Security (A07) | **File:** `apps/api/src/routes/export.ts:139-144`

Category names (user-controlled) are injected into HTML without escaping:
```typescript
categoryRowsHtml += `<td>${meta.icon} ${meta.name}</td>`;
// If name = '<img src=x onerror="alert(1)">', XSS executes
```

**Fix:** Add HTML escape function, apply to all user-controlled values in the HTML template.

---

### 2. CSV Formula Injection
**Domain:** Security (A03) | **File:** `apps/api/src/routes/export.ts:49-65`

Category/account names starting with `=`, `+`, `-`, `@` are interpreted as formulas in Excel:
```typescript
escape(r.category_name)  // "=1+1" becomes a formula in Excel
```

**Fix:** Prefix suspicious values with apostrophe: `"'=1+1"`.

---

### 3. JWT Algorithm Not Validated
**Domain:** Security (A08) | **File:** `apps/api/src/lib/jwt.ts:62-77`

The JWT decoder re-signs and verifies but never checks `header.alg === 'HS256'`. While the current implementation uses HMAC verification (so "none" attacks won't work in practice), this is a defense-in-depth gap.

**Fix:** Parse and validate the JWT header algorithm before verification.

---

### 4. Chat Message N+1 Queries
**Domain:** Database | **File:** `apps/api/src/routes/susu/chat.ts:108-123`

For each message in a chat fetch, **2 separate queries** run (reactions + read count). 50 messages = 100+ queries.

**Fix:** Batch fetch all reactions and read counts with `WHERE message_id IN (...)` grouped queries.

---

### 5. Missing Indexes on Foreign Key Columns
**Domain:** Database | **Files:** All migrations

6 foreign key columns used in JOINs have no indexes:
- `susu_contributions.group_id`
- `susu_payouts.group_id`
- `funeral_claims.claimant_member_id`
- `welfare_claims.claimant_member_id`
- `message_reactions.member_id`
- `early_payout_votes.member_id`

**Fix:** Add indexes via new migration.

---

### 6. Missing chat_read_receipts Indexes
**Domain:** Database | **Table:** `chat_read_receipts`

Zero indexes on a table queried by `member_id` and `group_id` in every chat fetch.

**Fix:** Add `idx_chat_read_receipts_member` and `idx_chat_read_receipts_group`.

---

## HIGH Priority

| # | Domain | Issue | File | Fix |
|---|--------|-------|------|-----|
| 7 | Performance | Recharts not lazy-loaded (~150KB in initial bundle) | `DashboardPage.tsx` | Lazy-load chart components |
| 8 | Performance | TransactionRow not memoized (re-renders entire list) | `TransactionRow.tsx` | Add `React.memo` wrapper |
| 9 | Security | Susu nested endpoint access control gaps | `susu/contributions.ts` | Audit all nested routes for membership checks |
| 10 | Database | Admin group list uses scalar subquery per row | `admin/groups.ts:104` | Replace with LEFT JOIN + GROUP BY |
| 11 | Database | Gamification leaderboard N+1 for badge counts | `gamification.ts:86` | Use LEFT JOIN + COUNT() |
| 12 | Database | Missing `susu_members(group_id, user_id)` composite index | Migrations | Add composite index |
| 13 | Database | Missing `transactions(account_id, transaction_date)` index | Migrations | Add index for import dedup |
| 14 | Database | Duplicate susu_messages index (0014 vs 0028) | Migration 0028 | Remove duplicate |

---

## MEDIUM Priority

| # | Domain | Issue | File |
|---|--------|-------|------|
| 15 | Performance | Notification polling every 30s (2,880 req/day/user) | `useNotifications.ts` |
| 16 | Performance | Vite missing manual chunks config (recharts, vendors) | `vite.config.ts` |
| 17 | Performance | 3 font imports with 5 Inter weights (render blocking) | `globals.css` |
| 18 | Performance | AuthContext value object recreated every render | `AuthContext.tsx` |
| 19 | Performance | Dashboard makes 3 separate API calls on load | `DashboardPage.tsx` |
| 20 | Performance | Ambient glow pseudo-elements cause repaints on scroll | `globals.css` |
| 21 | Performance | Inline SVG gradient ID collisions across charts | `SpendingTrendChart.tsx` |
| 22 | Performance | Inline functions in BottomNav recreated each render | `BottomNav.tsx` |
| 23 | Security | CSP missing `report-uri` directive | `index.ts:41` |
| 24 | Security | Refresh token TTL is 30 days (consider reducing to 7) | `auth.ts:19` |
| 25 | Security | Error logging lacks structure (no request ID, no user) | `index.ts:166` |
| 26 | Security | Audit logging missing for Susu sensitive operations | `susu/*.ts` |
| 27 | Database | Dashboard endpoint has no Cache-Control headers | `dashboard.ts` |
| 28 | Database | Susu group list over-fetches (40+ columns for list view) | `susu/groups.ts:113` |
| 29 | Database | Batch writes not wrapped in D1 transactions | `contributions.ts:85` |
| 30 | Database | Cron scheduled task has no error handling | `index.ts:176` |
| 31 | Database | Export CSV 5000-row limit should warn user | `export.ts:44` |
| 32 | Performance | Images/SVGs without explicit dimensions (CLS risk) | Various |

---

## LOW Priority (Backlog)

- Reduce Inter font weights from 5 to 2 (400, 600)
- Replace global `scroll-behavior: smooth` with targeted use
- Optimize `usePrefersReducedMotion` hook (minor)
- Add `SELECT` column projection instead of `SELECT *` in transactions
- Add KV hot key monitoring
- Add API request tracing with request IDs
- Run `npm audit` for dependency vulnerabilities

---

## Positive Findings (What's Done Well)

| Area | Status |
|------|--------|
| SQL Injection protection | All queries use prepared statements |
| PIN hashing | PBKDF2-SHA256, 100K iterations, constant-time compare |
| Refresh tokens | SHA-256 hashed, single-use rotation, KV-stored |
| Cookie security | HttpOnly, Secure (prod), SameSite=Strict |
| CORS | Restrictive whitelist with Cloudflare preview validation |
| Security headers | Complete set (CSP, X-Frame-Options, nosniff, etc.) |
| Rate limiting | Comprehensive (API, login, admin, public endpoints) |
| Code splitting | All pages lazy-loaded via React.lazy |
| Offline support | IndexedDB cache + sync queue with proper error handling |
| Accessibility | prefers-reduced-motion respected, ARIA attributes |
| Service worker | Stale-while-revalidate for API, cache-first for static |

---

## Recommended Implementation Order

### Week 1 — Critical Security + Database
1. Fix XSS in HTML report (escape user content)
2. Fix CSV formula injection (prefix suspicious values)
3. Add JWT algorithm validation
4. Add all missing database indexes (single migration)
5. Fix chat message N+1 queries (batch fetch)

### Week 2 — High Performance + Security
6. Lazy-load Recharts components
7. Memo-ize TransactionRow
8. Audit Susu endpoint access control
9. Fix admin group list scalar subquery
10. Configure Vite manual chunks

### Week 3 — Medium Optimizations
11. Increase notification poll interval to 120s
12. Add Cache-Control headers to dashboard
13. Implement structured error logging
14. Extend audit logging to Susu operations
15. Reduce font loading impact
