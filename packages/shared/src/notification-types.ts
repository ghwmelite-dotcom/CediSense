import { z } from 'zod';

// ── Notification type enums ────────────────────────────
export const notificationTypeSchema = z.enum([
  'susu_contribution',
  'susu_payout',
  'susu_vote_opened',
  'susu_vote_resolved',
  'susu_member_joined',
  'susu_chat_message',
  'susu_chat_mention',
  'susu_claim_filed',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationReferenceTypeSchema = z.enum([
  'contribution', 'payout', 'early_payout_request',
  'funeral_claim', 'welfare_claim', 'message',
]);
export type NotificationReferenceType = z.infer<typeof notificationReferenceTypeSchema>;

// ── Notification entity ────────────────────────────────
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  group_id: string | null;
  reference_id: string | null;
  reference_type: NotificationReferenceType | null;
  is_read: 0 | 1;
  created_at: string;
}

// ── Preferences ────────────────────────────────────────
export interface NotificationPreferences {
  push_enabled: boolean;
  muted_groups: string[];
}

// ── Push subscription payload (from browser) ───────────
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// ── Internal event shape (used by NotificationService) ─
export interface NotificationEvent {
  type: NotificationType;
  groupId: string;
  actorId: string;
  data: Record<string, unknown>;
}

// ── Zod schemas for API validation ─────────────────────
export const notificationPreferencesSchema = z.object({
  push_enabled: z.boolean().optional(),
  muted_groups: z.array(z.string()).optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const notificationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread_only: z.enum(['0', '1']).optional(),
});
