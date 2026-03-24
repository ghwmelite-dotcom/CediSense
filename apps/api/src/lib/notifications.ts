// apps/api/src/lib/notifications.ts
import type { Env } from '../types.js';
import type {
  Notification,
  NotificationEvent,
  NotificationPreferences,
  NotificationType,
} from '@cedisense/shared';
import { sendWebPush } from './web-push.js';

interface PaginatedNotifications {
  notifications: Notification[];
  cursor: string | null;
  has_more: boolean;
}

interface MemberRow {
  user_id: string;
  display_name: string;
}

interface PreferenceRow {
  user_id: string;
  push_enabled: number;
  muted_groups: string;
}

interface PushSubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface GroupRow {
  name: string;
}

// Notification types that bypass group mute (financially important)
const FINANCIAL_TYPES: Set<NotificationType> = new Set([
  'susu_contribution',
  'susu_payout',
  'susu_vote_opened',
  'susu_vote_resolved',
  'susu_claim_filed',
]);

export class NotificationService {
  constructor(private env: Env) {}

  /**
   * Fan-out a notification event to all group members (except the actor).
   * Creates in-app notification rows and sends Web Push to eligible members.
   */
  async emit(event: NotificationEvent): Promise<void> {
    const { type, groupId, actorId, data } = event;

    // 1. Get group name + members (exclude actor)
    const [group, members] = await Promise.all([
      this.env.DB.prepare('SELECT name FROM susu_groups WHERE id = ?')
        .bind(groupId).first<GroupRow>(),
      this.env.DB.prepare(
        'SELECT user_id, display_name FROM susu_members WHERE group_id = ? AND user_id != ?'
      ).bind(groupId, actorId).all<MemberRow>(),
    ]);

    if (!group || !members.results.length) return;

    const groupName = group.name;
    const { title, body } = buildNotificationBody(type, groupName, data);

    // 2. Fetch preferences for all recipients in one query
    const recipientIds = members.results.map(m => m.user_id);
    const placeholders = recipientIds.map(() => '?').join(',');
    const prefs = await this.env.DB.prepare(
      `SELECT user_id, push_enabled, muted_groups FROM notification_preferences WHERE user_id IN (${placeholders})`
    ).bind(...recipientIds).all<PreferenceRow>();

    const prefsMap = new Map(prefs.results.map(p => [p.user_id, p]));

    // 3. Determine which members get in-app and push notifications
    const isFinancial = FINANCIAL_TYPES.has(type);
    const inAppRecipients: string[] = [];
    const pushRecipients: string[] = [];

    for (const member of members.results) {
      const pref = prefsMap.get(member.user_id);
      const mutedGroups: string[] = pref ? JSON.parse(pref.muted_groups) : [];
      const isMuted = mutedGroups.includes(groupId);

      // Financial notifications bypass mute; chat respects it
      if (isMuted && !isFinancial) continue;

      inAppRecipients.push(member.user_id);

      // Push: check master toggle
      const pushEnabled = pref ? pref.push_enabled === 1 : true; // default on
      if (pushEnabled) {
        // Chat push throttle: max 1 push per user per group per 60s
        if (type === 'susu_chat_message') {
          const throttleKey = `push-throttle:${member.user_id}:${groupId}`;
          const throttled = await this.env.KV.get(throttleKey);
          if (throttled) continue; // skip push, in-app row still created
          await this.env.KV.put(throttleKey, '1', { expirationTtl: 60 });
        }
        pushRecipients.push(member.user_id);
      }
    }

    // 4. Batch-insert notification rows
    if (inAppRecipients.length > 0) {
      const stmts = inAppRecipients.map(userId =>
        this.env.DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, group_id, reference_id, reference_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          userId,
          type,
          title,
          body,
          groupId,
          (data.referenceId as string) ?? null,
          (data.referenceType as string) ?? null,
        )
      );
      await this.env.DB.batch(stmts);
    }

    // 5. Send Web Push to eligible members
    if (pushRecipients.length > 0) {
      const pushPlaceholders = pushRecipients.map(() => '?').join(',');
      const subs = await this.env.DB.prepare(
        `SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${pushPlaceholders})`
      ).bind(...pushRecipients).all<PushSubRow>();

      const deepLinkUrl = `/susu?group=${groupId}`;
      const staleIds: string[] = [];

      const vapid = {
        publicKey: this.env.VAPID_PUBLIC_KEY,
        privateKey: this.env.VAPID_PRIVATE_KEY,
        contactEmail: this.env.VAPID_CONTACT_EMAIL,
      };

      await Promise.allSettled(
        subs.results.map(async (sub) => {
          const success = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, data: { url: deepLinkUrl } },
            vapid,
          );
          if (!success) staleIds.push(sub.id);
        })
      );

      // Clean stale subscriptions
      if (staleIds.length > 0) {
        const delPlaceholders = staleIds.map(() => '?').join(',');
        await this.env.DB.prepare(
          `DELETE FROM push_subscriptions WHERE id IN (${delPlaceholders})`
        ).bind(...staleIds).run();
      }
    }
  }

  /**
   * Get paginated notification feed for a user.
   */
  async list(userId: string, opts: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<PaginatedNotifications> {
    const limit = opts.limit ?? 20;
    const fetchLimit = limit + 1; // fetch one extra to detect has_more

    let query: string;
    const binds: unknown[] = [userId];

    if (opts.cursor) {
      const { ts, id } = JSON.parse(atob(opts.cursor));
      if (opts.unreadOnly) {
        query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0
                 AND (created_at < ? OR (created_at = ? AND id < ?))
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
        binds.push(ts, ts, id, fetchLimit);
      } else {
        query = `SELECT * FROM notifications WHERE user_id = ?
                 AND (created_at < ? OR (created_at = ? AND id < ?))
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
        binds.push(ts, ts, id, fetchLimit);
      }
    } else {
      if (opts.unreadOnly) {
        query = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
      } else {
        query = `SELECT * FROM notifications WHERE user_id = ?
                 ORDER BY created_at DESC, id DESC LIMIT ?`;
      }
      binds.push(fetchLimit);
    }

    const result = await this.env.DB.prepare(query).bind(...binds).all<Notification>();
    const rows = result.results;
    const has_more = rows.length > limit;
    const notifications = has_more ? rows.slice(0, limit) : rows;

    // String-coerce IDs for TypeScript consistency (D1 returns numbers)
    const mapped = notifications.map(n => ({
      ...n,
      id: String(n.id),
      user_id: String(n.user_id),
      group_id: n.group_id ? String(n.group_id) : null,
      reference_id: n.reference_id ? String(n.reference_id) : null,
    }));

    const lastItem = mapped[mapped.length - 1];
    const cursor = lastItem
      ? btoa(JSON.stringify({ ts: lastItem.created_at, id: lastItem.id }))
      : null;

    return { notifications: mapped, cursor: has_more ? cursor : null, has_more };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).bind(notificationId, userId).run();
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).bind(userId).run();
  }

  /**
   * Get total unread count.
   */
  async unreadCount(userId: string): Promise<number> {
    const row = await this.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first<{ count: number }>();
    return row?.count ?? 0;
  }

  /**
   * Save a Web Push subscription.
   */
  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?`
    ).bind(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userId, sub.keys.p256dh, sub.keys.auth).run();
  }

  /**
   * Remove a Web Push subscription.
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.env.DB.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
    ).bind(userId, endpoint).run();
  }

  /**
   * Get notification preferences (creates default row if missing).
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const row = await this.env.DB.prepare(
      'SELECT push_enabled, muted_groups FROM notification_preferences WHERE user_id = ?'
    ).bind(userId).first<PreferenceRow>();

    if (!row) {
      return { push_enabled: true, muted_groups: [] };
    }

    return {
      push_enabled: row.push_enabled === 1,
      muted_groups: JSON.parse(row.muted_groups),
    };
  }

  /**
   * Update notification preferences (upsert).
   */
  async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = {
      push_enabled: prefs.push_enabled ?? current.push_enabled,
      muted_groups: prefs.muted_groups ?? current.muted_groups,
    };

    await this.env.DB.prepare(
      `INSERT INTO notification_preferences (user_id, push_enabled, muted_groups, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET push_enabled = ?, muted_groups = ?, updated_at = datetime('now')`
    ).bind(
      userId,
      updated.push_enabled ? 1 : 0,
      JSON.stringify(updated.muted_groups),
      updated.push_enabled ? 1 : 0,
      JSON.stringify(updated.muted_groups),
    ).run();

    return updated;
  }

  /**
   * Purge notifications older than N days. Returns count deleted.
   */
  async purgeExpired(daysOld: number): Promise<number> {
    const result = await this.env.DB.prepare(
      `DELETE FROM notifications WHERE created_at < datetime('now', '-' || ? || ' days')`
    ).bind(daysOld).run();
    return result.meta.changes ?? 0;
  }
}

// ── Notification body builder ───────────────────────────

function buildNotificationBody(
  type: NotificationType,
  groupName: string,
  data: Record<string, unknown>,
): { title: string; body: string } {
  const actorName = (data.actorName as string) ?? 'A member';
  const amount = data.amount_pesewas
    ? `GHS ${((data.amount_pesewas as number) / 100).toFixed(2)}`
    : '';
  const round = data.round ? ` (Round ${data.round})` : '';

  switch (type) {
    case 'susu_contribution':
      return { title: 'New Contribution', body: `${actorName} contributed ${amount} to ${groupName}${round}` };
    case 'susu_payout':
      return { title: 'Payout Processed', body: `${(data.recipientName as string) ?? actorName} received ${amount} from ${groupName}${round}` };
    case 'susu_vote_opened':
      return { title: 'Vote Needed', body: `${actorName} requested an early payout from ${groupName} — vote now` };
    case 'susu_vote_resolved':
      return { title: 'Vote Resolved', body: `${(data.outcome as string) ?? 'Request'} ${(data.status as string) ?? 'resolved'} in ${groupName}` };
    case 'susu_member_joined':
      return { title: 'New Member', body: `${actorName} joined ${groupName}` };
    case 'susu_chat_message':
      return { title: 'New Message', body: `${actorName} in ${groupName}: ${(data.preview as string) ?? ''}`.slice(0, 120) };
    case 'susu_claim_filed':
      return { title: 'Claim Filed', body: `${(data.claimType as string) ?? 'A'} claim filed in ${groupName} — review needed` };
    default:
      return { title: 'Notification', body: `Activity in ${groupName}` };
  }
}
