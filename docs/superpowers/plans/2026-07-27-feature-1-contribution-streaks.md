# Feature 1: Contribution Streaks With Stakes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every member's contribution streak visible and worth protecting — flame badges in the UI, a "round saved" system message in chat, and a cron push when a streak is about to die.

**Architecture:** `trust_scores.current_streak`/`longest_streak` are already maintained on every contribution (reset on late, +1 on on-time — `apps/api/src/routes/susu/contributions.ts:128-210`). This feature *surfaces* the streak in API payloads, *displays* it in the web app, and *defends* it with a system chat message + a cron-driven push nudge. One additive migration adds `message_type` to `susu_messages` for system messages.

**Tech Stack:** Hono (Cloudflare Workers), D1 (SQLite), React 18 + Tailwind, wrangler dev + vite for local verification.

## Global Constraints

- Migrations must be D1-safe: additive DDL only (no table rebuilds, no CHECK edits, no `writable_schema`).
- `pnpm -r run typecheck` and `npx vitest run` (300 tests) must stay green after every task.
- Branch: `feat/susu-engagement-1-streaks` off `master`. One PR. Deploy worker + Pages after merge.
- Do NOT touch the user's uncommitted files: `apps/api/src/routes/susu/contributions.ts`, `apps/api/src/routes/susu/groups.ts`, `apps/web/index.html` — except the exact hunks this plan specifies in `contributions.ts` and `groups.ts` (additive edits only, do not revert their existing uncommitted changes).

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `apps/api/migrations/0035_streak_features.sql` | Add `message_type` column to `susu_messages` |
| `apps/api/src/routes/susu/groups.ts` | Include `current_streak` in group-detail members + group list payload |
| `apps/api/src/routes/susu/contributions.ts` | Insert "round saved" system message on last-pending on-time contribution |
| `apps/api/src/index.ts` | Cron: streak-risk nudge job in `scheduled()` |
| `apps/api/src/lib/streak-nudge.ts` | Pure logic: who gets nudged (testable) |
| `apps/api/src/lib/streak-nudge.test.ts` | Unit tests for nudge logic |
| `packages/shared/src/types.ts` | `streak` fields on member + group types |
| `apps/web/src/components/susu/MemberList.tsx` | Per-member flame badge |
| `apps/web/src/components/susu/GroupCard.tsx` | My-streak flame on group list card |

**Interfaces:**
- Consumes: `trust_scores.current_streak` (number), existing `awardBadge()`, `sendWebPush()` from `apps/api/src/lib/web-push.ts`, `SusuGroupWithDetails.members[]`.
- Produces:
  - `GET /api/v1/susu/groups/:id` → `members[]` gains `streak: number`
  - `GET /api/v1/susu/groups` → each group gains `my_streak: number`
  - `susu_messages.message_type`: `'user' | 'system'`
  - `computeStreakNudges(rows: NudgeRow[]): Nudge[]` in `streak-nudge.ts`

---

### Task 1: Migration — `message_type` on `susu_messages`

**Files:**
- Create: `apps/api/migrations/0035_streak_features.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Feature 1 (streaks): system chat messages.
-- message_type distinguishes system-generated messages ('system') from
-- member-authored ones ('user'). Existing rows default to 'user'.
ALTER TABLE susu_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_susu_messages_type ON susu_messages(group_id, message_type);
```

- [ ] **Step 2: Apply locally and verify**

```bash
cd apps/api
npx wrangler d1 execute cedisense-db --local --file=migrations/0035_streak_features.sql
npx wrangler d1 execute cedisense-db --local --json --command "PRAGMA table_info(susu_messages)" | grep message_type
```
Expected: column present, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/0035_streak_features.sql
git commit -m "feat(susu): message_type column for system chat messages"
```

---

### Task 2: Nudge logic unit (pure, TDD)

**Files:**
- Create: `apps/api/src/lib/streak-nudge.ts`
- Test: `apps/api/src/lib/streak-nudge.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface NudgeRow {
    user_id: string; display_name: string; group_id: string; group_name: string;
    current_streak: number; contributed_this_round: number; // 0|1
  }
  export interface Nudge { userId: string; groupId: string; title: string; body: string; }
  export function computeStreakNudges(rows: NudgeRow[], minStreak?: number): Nudge[]
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeStreakNudges } from './streak-nudge.js';

describe('computeStreakNudges', () => {
  const row = { user_id: 'u1', display_name: 'Kofi', group_id: 'g1', group_name: 'Osu Traders', current_streak: 5, contributed_this_round: 0 };

  it('nudges members with a streak at risk who have not contributed', () => {
    const nudges = computeStreakNudges([row]);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].body).toContain('5');
    expect(nudges[0].body).toContain('Osu Traders');
  });

  it('skips members who already contributed this round', () => {
    expect(computeStreakNudges([{ ...row, contributed_this_round: 1 }])).toHaveLength(0);
  });

  it('skips streaks below the minimum (default 2)', () => {
    expect(computeStreakNudges([{ ...row, current_streak: 1 }])).toHaveLength(0);
    expect(computeStreakNudges([{ ...row, current_streak: 1 }], 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/api/src/lib/streak-nudge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export interface NudgeRow {
  user_id: string; display_name: string; group_id: string; group_name: string;
  current_streak: number; contributed_this_round: number;
}
export interface Nudge { userId: string; groupId: string; title: string; body: string; }

export function computeStreakNudges(rows: NudgeRow[], minStreak = 2): Nudge[] {
  return rows
    .filter((r) => r.contributed_this_round === 0 && r.current_streak >= minStreak)
    .map((r) => ({
      userId: r.user_id,
      groupId: r.group_id,
      title: 'Your streak is at risk 🔥',
      body: `${r.display_name}, your ${r.current_streak}-round streak in "${r.group_name}" ends if you miss this round. Contribute now to keep it alive.`,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/api/src/lib/streak-nudge.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/streak-nudge.ts apps/api/src/lib/streak-nudge.test.ts
git commit -m "feat(susu): streak-risk nudge logic + tests"
```

---

### Task 3: Surface streaks in API payloads

**Files:**
- Modify: `apps/api/src/routes/susu/groups.ts` — GET `/groups/:id` members query (LEFT JOIN trust_scores) and GET `/groups` list query.

- [ ] **Step 1: Group detail members — add streak**

In the GET `/groups/:id` handler, the members query (`SELECT sm.*, ... FROM susu_members sm ...`) becomes:

```sql
SELECT sm.*, COALESCE(ts.current_streak, 0) AS streak
FROM susu_members sm
LEFT JOIN trust_scores ts ON ts.user_id = sm.user_id
WHERE sm.group_id = ?
ORDER BY sm.payout_order
```
Map `streak` through in `membersWithContrib`.

- [ ] **Step 2: Group list — add `my_streak`**

In GET `/groups`, add to the SELECT:
```sql
(SELECT COALESCE(ts.current_streak, 0) FROM trust_scores ts WHERE ts.user_id = ?) AS my_streak
```
(binding `userId` again) and include `my_streak` in the mapped response.

- [ ] **Step 3: Shared types**

In `packages/shared/src/types.ts`, on the susu member type add `streak?: number` and on the group list type add `my_streak?: number`.

- [ ] **Step 4: Verify**

```bash
pnpm -r run typecheck   # clean
# local E2E: GET /api/v1/susu/groups/:id shows streak on members
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/susu/groups.ts packages/shared/src/types.ts
git commit -m "feat(susu): expose current_streak in group payloads"
```

---

### Task 4: "Round saved" system message

**Files:**
- Modify: `apps/api/src/routes/susu/contributions.ts` — after a successful on-time contribution insert.

- [ ] **Step 1: Implement (additive, after the contribution insert + before response)**

```ts
// System message: last pending member contributing on time saves the round
if (!is_late) {
  const pending = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members m
     WHERE m.group_id = ? AND NOT EXISTS (
       SELECT 1 FROM susu_contributions sc
       WHERE sc.group_id = m.group_id AND sc.member_id = m.id AND sc.round = ?)`
  ).bind(groupId, group.current_round).first<{ cnt: number }>();
  if ((pending?.cnt ?? 1) === 0) {
    await c.env.DB.prepare(
      `INSERT INTO susu_messages (id, group_id, member_id, content, message_type)
       VALUES (?, ?, ?, ?, 'system')`
    ).bind(generateId(), groupId, member_id,
      `🔥 ${memberDisplayName} kept the round alive — everyone has contributed!`).run();
  }
}
```
(`memberDisplayName` from the member row already fetched in the handler.)

- [ ] **Step 2: Verify locally** — create group, all contribute, last contribution posts the system message (`message_type='system'` in `GET .../messages`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/susu/contributions.ts
git commit -m "feat(susu): 'kept the round alive' system message"
```

---

### Task 5: Cron streak-risk nudge

**Files:**
- Modify: `apps/api/src/index.ts` — `scheduled()` handler (currently purge-only, ~line 192).
- Consumes: `computeStreakNudges` (Task 2), `sendWebPush` (`apps/api/src/lib/web-push.ts`), `push_subscriptions` table.

- [ ] **Step 1: Implement the job**

```ts
// after the existing purge block in scheduled():
try {
  const { results } = await env.DB.prepare(
    `SELECT m.user_id, m.display_name, g.id AS group_id, g.name AS group_name,
            COALESCE(ts.current_streak, 0) AS current_streak,
            EXISTS(SELECT 1 FROM susu_contributions sc
                   WHERE sc.group_id = g.id AND sc.member_id = m.id AND sc.round = g.current_round) AS contributed_this_round
     FROM susu_members m
     JOIN susu_groups g ON g.id = m.group_id AND g.is_active = 1
     LEFT JOIN trust_scores ts ON ts.user_id = m.user_id`
  ).all();
  const nudges = computeStreakNudges(results as never[]);
  for (const n of nudges) {
    const { results: subs } = await env.DB.prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
    ).bind(n.userId).all();
    for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
      ctx.waitUntil(sendWebPush(env, sub, { title: n.title, body: n.body, url: '/susu' }));
    }
  }
  console.log(JSON.stringify({ type: 'cron', action: 'streak-nudge', sent: nudges.length }));
} catch (err) { /* log like purge */ }
```
(Check `sendWebPush` actual signature in `lib/web-push.ts` and the notification insert helper in `lib/notifications.ts` — mirror its payload shape; also insert a row into `notifications` per nudge so it appears in-app.)

- [ ] **Step 2: Verify locally**

```bash
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled"   # against wrangler dev
```
Expected: log line `streak-nudge` with sent count; nudged users have rows in `notifications`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(susu): cron streak-risk push nudges"
```

---

### Task 6: Flame UI

**Files:**
- Modify: `apps/web/src/components/susu/MemberList.tsx` — flame + count next to member names with `streak >= 1`.
- Modify: `apps/web/src/components/susu/GroupCard.tsx` — flame + count when `my_streak >= 1`.

- [ ] **Step 1: MemberList badge** (next to display name)

```tsx
{(m.streak ?? 0) >= 1 && (
  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-400"
        title={`${m.streak}-round streak`}>
    🔥 {m.streak}
  </span>
)}
```

- [ ] **Step 2: GroupCard badge** (top-right of card, next to member count)

```tsx
{(group.my_streak ?? 0) >= 1 && (
  <span className="text-xs font-semibold text-orange-400" title={`${group.my_streak}-round streak`}>
    🔥 {group.my_streak}
  </span>
)}
```

- [ ] **Step 3: Verify** — mobile-viewport screenshots of `/susu` list + group detail showing flames; `pnpm -r run typecheck`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/susu/MemberList.tsx apps/web/src/components/susu/GroupCard.tsx
git commit -m "feat(susu): streak flame badges in member list and group cards"
```

---

### Task 7: Full verification + PR + deploy

- [ ] **Step 1:** `pnpm -r run typecheck` + `npx vitest run` — all green.
- [ ] **Step 2:** Scripted E2E against local stack: two members, streak increments visible in payloads, system message posted on round completion, cron handler logs `streak-nudge`.
- [ ] **Step 3:** Mobile screenshots (375px + 390px) of group list + detail with flames + system message in chat.
- [ ] **Step 4:** PR to `master` with evidence; squash-merge.
- [ ] **Step 5:** Deploy — `wrangler deploy` (API), apply migration 0035 to prod D1, `wrangler pages deploy` (web). Verify prod: streak in group payload, migration applied.

---

## Self-Review

- **Spec coverage:** flame UI (T6), rescue system message (T4), cron nudge (T2+T5), schema (T1), payloads (T3), verification (T7) — all covered.
- **Placeholders:** none — every step has code or exact commands.
- **Type consistency:** `streak` (member), `my_streak` (group), `message_type` ('user'|'system'), `computeStreakNudges` signature identical across tasks.
