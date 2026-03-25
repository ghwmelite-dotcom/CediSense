import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import type { SusuFrequency, SusuVariant } from '@cedisense/shared';
import { generateId } from '../../lib/db.js';

// Re-export for sub-routers
export { generateId };
export type { Env, Variables };

export type AppType = { Bindings: Env; Variables: Variables };

// ─── Row types ───────────────────────────────────────────────────────────────

export interface SusuGroupRow {
  id: string;
  name: string;
  creator_id: string;
  invite_code: string;
  contribution_pesewas: number;
  frequency: SusuFrequency;
  max_members: number;
  current_round: number;
  is_active: number;
  variant: SusuVariant;
  goal_amount_pesewas: number | null;
  goal_description: string | null;
  penalty_percent: number;
  penalty_pool_pesewas: number;
  target_term: string | null;
  school_name: string | null;
  base_currency: string | null;
  event_name: string | null;
  event_date: string | null;
  guarantee_percent: number;
  guarantee_pool_pesewas: number;
  supplier_name: string | null;
  supplier_contact: string | null;
  item_description: string | null;
  estimated_savings_percent: number | null;
  crop_type: string | null;
  planting_month: number | null;
  harvest_month: number | null;
  organization_name: string | null;
  organization_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface SusuPenaltyRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  penalty_pesewas: number;
  reason: string;
  created_at: string;
}

export interface SusuMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  payout_order: number;
  pre_paid: number;
  joined_at: string;
}

export interface SusuContributionRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  contributed_at: string;
  original_currency: string | null;
  original_amount: number | null;
  exchange_rate: number | null;
}

export interface SusuPayoutRow {
  id: string;
  group_id: string;
  member_id: string;
  round: number;
  amount_pesewas: number;
  paid_at: string;
}

export interface EarlyPayoutRequestRow {
  id: string;
  group_id: string;
  requester_member_id: string;
  reason: string | null;
  amount_pesewas: number;
  premium_percent: number;
  status: string;
  votes_for: number;
  votes_against: number;
  votes_needed: number;
  created_at: string;
  resolved_at: string | null;
}

export interface EarlyPayoutVoteRow {
  id: string;
  request_id: string;
  member_id: string;
  vote: string;
  voted_at: string;
}

export interface FuneralClaimRow {
  id: string;
  group_id: string;
  claimant_member_id: string;
  deceased_name: string;
  relationship: string;
  description: string | null;
  amount_pesewas: number;
  status: string;
  approved_by_count: number;
  denied_by_count: number;
  approval_threshold: number;
  created_at: string;
  resolved_at: string | null;
}

export interface WelfareClaimRow {
  id: string;
  group_id: string;
  claimant_member_id: string;
  claim_type: string;
  description: string;
  amount_requested_pesewas: number;
  amount_approved_pesewas: number | null;
  status: string;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function mapGroup(row: SusuGroupRow) {
  return {
    ...row,
    is_active: row.is_active === 1,
  };
}

// Badge name lookup
export const BADGE_NAMES: Record<string, string> = {
  first_contribution: 'First Step',
  first_payout: 'First Payout',
  perfect_round: 'Perfect Round',
  streak_5: '5 Streak',
  streak_10: '10 Streak',
  streak_20: '20 Streak',
  group_founder: 'Founder',
  group_completed: 'Completer',
};

// Award a badge if the user doesn't already have it for this group
export async function awardBadge(
  db: D1Database,
  userId: string,
  badgeType: string,
  groupId: string | null = null
): Promise<void> {
  const existing = groupId
    ? await db
        .prepare(`SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ? AND group_id = ?`)
        .bind(userId, badgeType, groupId)
        .first()
    : await db
        .prepare(`SELECT id FROM susu_badges WHERE user_id = ? AND badge_type = ?`)
        .bind(userId, badgeType)
        .first();

  if (existing) return;

  const badgeId = generateId();
  const badgeName = BADGE_NAMES[badgeType] ?? badgeType;

  await db
    .prepare(
      `INSERT INTO susu_badges (id, user_id, badge_type, badge_name, group_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(badgeId, userId, badgeType, badgeName, groupId)
    .run();
}

// ─── Main router ─────────────────────────────────────────────────────────────

const susu = new Hono<AppType>();

// Mount sub-routers
import groups from './groups.js';
import members from './members.js';
import contributions from './contributions.js';
import claims from './claims.js';
import chat from './chat.js';
import gamification from './gamification.js';

susu.route('/', groups);
susu.route('/', members);
susu.route('/', contributions);
susu.route('/', claims);
susu.route('/', chat);
susu.route('/', gamification);

export { susu };
