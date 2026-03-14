# Susu Groups (Multi-user) — Design Spec

## Overview

Digital rotating savings groups (susu). Members join via invite codes, contribute each round, and one member receives the payout per round based on payout order. Full multi-user — each member sees their own contribution status from their CediSense account.

## Database: `0008_susu.sql`

```sql
CREATE TABLE IF NOT EXISTS susu_groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  contribution_pesewas INTEGER NOT NULL CHECK(contribution_pesewas > 0),
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  max_members INTEGER NOT NULL DEFAULT 12 CHECK(max_members >= 2),
  current_round INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_susu_groups_invite ON susu_groups(invite_code);

CREATE TABLE IF NOT EXISTS susu_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  payout_order INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id),
  UNIQUE(group_id, payout_order)
);
CREATE INDEX idx_susu_members_group ON susu_members(group_id);
CREATE INDEX idx_susu_members_user ON susu_members(user_id);

CREATE TABLE IF NOT EXISTS susu_contributions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  round INTEGER NOT NULL,
  amount_pesewas INTEGER NOT NULL,
  contributed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, round)
);

CREATE TABLE IF NOT EXISTS susu_payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  group_id TEXT NOT NULL REFERENCES susu_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES susu_members(id),
  round INTEGER NOT NULL,
  amount_pesewas INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, round)
);
```

**Invite code:** 8-char alphanumeric uppercase, generated server-side. Format: `SUSU-XXXXXXXX`.

## API: `/api/v1/susu`

### Group Management
- `POST /groups` — create group. Creator auto-joins as member at payout_order 1. Generates invite code. Returns group + invite code.
- `GET /groups` — list groups user belongs to (as creator or member). Include member count, current round.
- `GET /groups/:id` — full group detail: settings, all members with contribution status for current round, payout recipient for current round, user's membership info.
- `PUT /groups/:id` — update group (creator only): name, contribution amount, frequency, max_members, is_active.
- `DELETE /groups/:id` — delete group (creator only), cascades all data. 204.

### Membership
- `POST /groups/join` — join via invite code `{ invite_code: string }`. Auto-assigns next payout_order. Validates: group exists, active, not full, user not already member.
- `POST /groups/:id/leave` — leave group (non-creator only). Reorders remaining payout_orders.

### Round Operations (creator only)
- `POST /groups/:id/contributions` — record contribution for a member: `{ member_id: string, amount_pesewas: number }`. Validates: current round, not already contributed this round.
- `POST /groups/:id/payouts` — record payout to current round's recipient. Amount = contribution * member_count. Auto-determines recipient from payout_order matching current_round.
- `POST /groups/:id/advance-round` — increment current_round. Validates: all members contributed, payout recorded.

### Read
- `GET /groups/:id/history` — all contributions and payouts across all rounds for the group.

## Types

```typescript
export type SusuFrequency = 'daily' | 'weekly' | 'monthly';

export interface SusuGroup {
  id: string; name: string; creator_id: string; invite_code: string;
  contribution_pesewas: number; frequency: SusuFrequency;
  max_members: number; current_round: number; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface SusuMember {
  id: string; group_id: string; user_id: string;
  display_name: string; payout_order: number; joined_at: string;
}

export interface SusuContribution {
  id: string; group_id: string; member_id: string;
  round: number; amount_pesewas: number; contributed_at: string;
}

export interface SusuPayout {
  id: string; group_id: string; member_id: string;
  round: number; amount_pesewas: number; paid_at: string;
}

export interface SusuGroupWithDetails extends SusuGroup {
  member_count: number;
  members: Array<SusuMember & { has_contributed_this_round: boolean }>;
  payout_recipient: SusuMember | null;
  my_member_id: string | null;
  is_creator: boolean;
}
```

## Schemas

```typescript
export const createSusuGroupSchema = z.object({
  name: z.string().min(1).max(100),
  contribution_pesewas: z.number().int().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  max_members: z.number().int().min(2).max(50).default(12),
});

export const joinSusuGroupSchema = z.object({
  invite_code: z.string().min(1),
});

export const recordContributionSchema = z.object({
  member_id: z.string().min(1),
  amount_pesewas: z.number().int().positive(),
});

export const updateSusuGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contribution_pesewas: z.number().int().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  max_members: z.number().int().min(2).max(50).optional(),
  is_active: z.boolean().optional(),
});
```

## Frontend: `/susu` page

- **My Groups** list: group name, member count, current round, role badge (Creator/Member), contribution status
- **Group Detail** view (modal or sub-route): round tracker circle/progress, member list with contribution checkmarks for current round, payout recipient highlighted, contribution recording (creator), advance round button
- **Create Group** modal: name, contribution amount, frequency, max members
- **Join Group** modal: invite code input
- **Invite Code Display**: shareable code with copy button
- Empty state: people icon + "Start or join a susu group"

## Files

**New:** `0008_susu.sql`, `routes/susu.ts`, `pages/SusuPage.tsx`, `components/susu/GroupCard.tsx`, `components/susu/GroupDetail.tsx`, `components/susu/CreateGroupModal.tsx`, `components/susu/JoinGroupModal.tsx`

**Modified:** `types.ts`, `schemas.ts`, `index.ts`, `App.tsx`
