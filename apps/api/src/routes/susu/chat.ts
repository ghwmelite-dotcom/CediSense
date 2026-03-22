import { Hono } from 'hono';
import type { AppType } from './index.js';
import { generateId } from './index.js';
import {
  susuMessageSchema,
  messageReactionSchema,
  editMessageSchema,
} from '@cedisense/shared';

const chat = new Hono<AppType>();

// ─── GET /groups/:id/messages — fetch chat messages (cursor pagination) ───────

chat.get('/groups/:id/messages', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const limitRaw = c.req.query('limit');
  const before = c.req.query('before');
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);

  interface MessageRow {
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    attachment_key: string | null;
    attachment_type: string | null;
    attachment_name: string | null;
    attachment_size: number | null;
  }

  let query: string;
  let bindings: unknown[];

  if (before) {
    const cursorRow = await c.env.DB.prepare(
      `SELECT rowid FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(before, groupId).first<{ rowid: number }>();

    if (!cursorRow) {
      return c.json({ data: [] });
    }

    query = `
      SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
             m.reply_to_id, m.edited_at, m.deleted_at,
             m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
             rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
      FROM susu_messages m
      JOIN susu_members sm ON m.member_id = sm.id
      LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
      LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
      WHERE m.group_id = ? AND m.rowid < ?
      ORDER BY m.rowid DESC
      LIMIT ?
    `;
    bindings = [groupId, cursorRow.rowid, limit];
  } else {
    query = `
      SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
             m.reply_to_id, m.edited_at, m.deleted_at,
             m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
             rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
      FROM susu_messages m
      JOIN susu_members sm ON m.member_id = sm.id
      LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
      LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
      WHERE m.group_id = ?
      ORDER BY m.rowid DESC
      LIMIT ?
    `;
    bindings = [groupId, limit];
  }

  const { results } = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all<MessageRow>();

  // Reverse so oldest-first
  const rawMessages = [...results].reverse();

  // Enrich with reactions and read_by_count
  const messages = [];

  // Get total member count for read receipt calculation
  const memberCountRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM susu_members WHERE group_id = ?`
  ).bind(groupId).first<{ cnt: number }>();
  const totalMembers = memberCountRow?.cnt ?? 0;

  for (const msg of rawMessages) {
    // Get reactions for this message
    const { results: reactionRows } = await c.env.DB.prepare(
      `SELECT emoji, COUNT(*) AS count,
              MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
       FROM message_reactions
       WHERE message_id = ?
       GROUP BY emoji`
    ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

    // Count how many members have read up to or past this message
    const readCountRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM chat_read_receipts crr
       WHERE crr.group_id = ? AND crr.last_read_message_id IS NOT NULL
       AND (SELECT rowid FROM susu_messages WHERE id = crr.last_read_message_id) >= (SELECT rowid FROM susu_messages WHERE id = ?)`
    ).bind(groupId, msg.id).first<{ cnt: number }>();

    messages.push({
      id: msg.id,
      content: msg.deleted_at ? '' : msg.content,
      sender_name: msg.sender_name,
      sender_user_id: msg.sender_user_id,
      created_at: msg.created_at,
      reply_to_id: msg.reply_to_id,
      reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
      reply_to_sender: msg.reply_to_sender,
      edited_at: msg.edited_at,
      is_deleted: msg.deleted_at !== null,
      reactions: reactionRows.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reacted_by_me: r.reacted_by_me === 1,
      })),
      read_by_count: readCountRow?.cnt ?? 0,
      attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
      attachment_type: msg.attachment_type,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
    });
  }

  return c.json({ data: messages });
});

// ─── GET /groups/:id/messages/poll — long-poll for new messages ──────────────

chat.get('/groups/:id/messages/poll', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const afterId = c.req.query('after');
  const timeoutSec = Math.min(parseInt(c.req.query('timeout') ?? '25', 10) || 25, 25);

  interface MessageRow {
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    attachment_key: string | null;
    attachment_type: string | null;
    attachment_name: string | null;
    attachment_size: number | null;
  }

  const checkForNew = async (): Promise<MessageRow[]> => {
    if (!afterId) return [];

    const cursorRow = await c.env.DB.prepare(
      `SELECT rowid FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(afterId, groupId).first<{ rowid: number }>();

    if (!cursorRow) return [];

    const { results } = await c.env.DB.prepare(
      `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
              m.reply_to_id, m.edited_at, m.deleted_at,
              m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
              rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
       FROM susu_messages m
       JOIN susu_members sm ON m.member_id = sm.id
       LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
       LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
       WHERE m.group_id = ? AND m.rowid > ?
       ORDER BY m.rowid ASC
       LIMIT 50`
    ).bind(groupId, cursorRow.rowid).all<MessageRow>();

    return results;
  };

  // Try up to timeoutSec/2 iterations (check every 2 seconds)
  const maxChecks = Math.ceil(timeoutSec / 2);
  for (let i = 0; i < maxChecks; i++) {
    const newMsgs = await checkForNew();
    if (newMsgs.length > 0) {
      // Enrich with reactions and read_by_count
      const enriched = [];
      for (const msg of newMsgs) {
        const { results: reactionRows } = await c.env.DB.prepare(
          `SELECT emoji, COUNT(*) AS count,
                  MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
           FROM message_reactions
           WHERE message_id = ?
           GROUP BY emoji`
        ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

        const readCountRow = await c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM chat_read_receipts crr
           WHERE crr.group_id = ? AND crr.last_read_message_id IS NOT NULL
           AND (SELECT rowid FROM susu_messages WHERE id = crr.last_read_message_id) >= (SELECT rowid FROM susu_messages WHERE id = ?)`
        ).bind(groupId, msg.id).first<{ cnt: number }>();

        enriched.push({
          id: msg.id,
          content: msg.deleted_at ? '' : msg.content,
          sender_name: msg.sender_name,
          sender_user_id: msg.sender_user_id,
          created_at: msg.created_at,
          reply_to_id: msg.reply_to_id,
          reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
          reply_to_sender: msg.reply_to_sender,
          edited_at: msg.edited_at,
          is_deleted: msg.deleted_at !== null,
          reactions: reactionRows.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reacted_by_me: r.reacted_by_me === 1,
          })),
          read_by_count: readCountRow?.cnt ?? 0,
          attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
          attachment_type: msg.attachment_type,
          attachment_name: msg.attachment_name,
          attachment_size: msg.attachment_size,
        });
      }

      return c.json({ data: enriched, has_more: newMsgs.length === 50 });
    }

    // Wait 2 seconds before next check (except on last iteration)
    if (i < maxChecks - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Timeout — return empty
  return c.json({ data: [], has_more: false });
});

// ─── POST /groups/:id/typing — set typing indicator ─────────────────────────

chat.post('/groups/:id/typing', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id, display_name FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string; display_name: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Store typing state in KV as JSON object: { [memberId]: { name, timestamp } }
  const kvKey = `typing:${groupId}`;
  const existing = await c.env.KV.get<Record<string, { name: string; ts: number }>>(kvKey, 'json');
  const typingMap = existing ?? {};

  typingMap[myMember.id] = { name: myMember.display_name, ts: Date.now() };

  // Clean up entries older than 5 seconds
  const cutoff = Date.now() - 5000;
  for (const [key, val] of Object.entries(typingMap)) {
    if (val.ts < cutoff) delete typingMap[key];
  }

  await c.env.KV.put(kvKey, JSON.stringify(typingMap), { expirationTtl: 10 });

  return c.body(null, 204);
});

// ─── GET /groups/:id/typing — get typing indicators ─────────────────────────

chat.get('/groups/:id/typing', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const kvKey = `typing:${groupId}`;
  const typingMap = await c.env.KV.get<Record<string, { name: string; ts: number }>>(kvKey, 'json');

  if (!typingMap) {
    return c.json({ data: [] });
  }

  const cutoff = Date.now() - 5000;
  const typingUsers = Object.entries(typingMap)
    .filter(([memberId, val]) => val.ts >= cutoff && memberId !== myMember.id)
    .map(([memberId, val]) => ({
      member_id: memberId,
      display_name: val.name,
    }));

  return c.json({ data: typingUsers });
});

// ─── POST /groups/:id/messages/read — mark messages as read ─────────────────

chat.post('/groups/:id/messages/read', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let body: { last_message_id: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  if (!body.last_message_id || typeof body.last_message_id !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'last_message_id is required' } }, 422);
  }

  // Verify message exists in this group
  const msgExists = await c.env.DB.prepare(
    `SELECT id FROM susu_messages WHERE id = ? AND group_id = ?`
  ).bind(body.last_message_id, groupId).first<{ id: string }>();

  if (!msgExists) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  await c.env.DB.prepare(
    `INSERT INTO chat_read_receipts (member_id, group_id, last_read_message_id, last_read_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(member_id, group_id)
     DO UPDATE SET last_read_message_id = excluded.last_read_message_id, last_read_at = excluded.last_read_at`
  ).bind(myMember.id, groupId, body.last_message_id).run();

  return c.body(null, 204);
});

// ─── POST /groups/:id/messages — send a chat message ─────────────────────────

chat.post('/groups/:id/messages', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  // Verify membership and get member_id
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = susuMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  const messageId = generateId();
  const replyToId = parsed.data.reply_to_id ?? null;

  // Validate reply_to_id if provided
  if (replyToId) {
    const replyMsg = await c.env.DB.prepare(
      `SELECT id FROM susu_messages WHERE id = ? AND group_id = ?`
    ).bind(replyToId, groupId).first<{ id: string }>();
    if (!replyMsg) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Reply target message not found in this group' } }, 404);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO susu_messages (id, group_id, member_id, content, reply_to_id) VALUES (?, ?, ?, ?, ?)`
  ).bind(messageId, groupId, myMember.id, parsed.data.content, replyToId).run();

  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string;
    content: string;
    created_at: string;
    sender_name: string;
    sender_user_id: string;
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    edited_at: string | null;
    deleted_at: string | null;
  }>();

  const message = row ? {
    id: row.id,
    content: row.content,
    sender_name: row.sender_name,
    sender_user_id: row.sender_user_id,
    created_at: row.created_at,
    reply_to_id: row.reply_to_id,
    reply_to_content: row.reply_to_content ? (row.reply_to_content.length > 100 ? row.reply_to_content.slice(0, 100) + '...' : row.reply_to_content) : null,
    reply_to_sender: row.reply_to_sender,
    edited_at: row.edited_at,
    is_deleted: false,
    reactions: [] as Array<{ emoji: string; count: number; reacted_by_me: boolean }>,
    read_by_count: 0,
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    attachment_size: null,
  } : null;

  return c.json({ data: message }, 201);
});

// ─── POST /groups/:id/messages/:messageId/react — toggle emoji reaction ──────

chat.post('/groups/:id/messages/:messageId/react', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists in this group
  const msg = await c.env.DB.prepare(
    `SELECT id FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = messageReactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  const { emoji } = parsed.data;

  // Check if reaction already exists (toggle)
  const existing = await c.env.DB.prepare(
    `SELECT id FROM message_reactions WHERE message_id = ? AND member_id = ? AND emoji = ?`
  ).bind(messageId, myMember.id, emoji).first<{ id: string }>();

  if (existing) {
    // Remove reaction
    await c.env.DB.prepare(
      `DELETE FROM message_reactions WHERE id = ?`
    ).bind(existing.id).run();
  } else {
    // Add reaction
    const reactionId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO message_reactions (id, message_id, member_id, emoji) VALUES (?, ?, ?, ?)`
    ).bind(reactionId, messageId, myMember.id, emoji).run();
  }

  // Return updated reactions for this message
  const { results: reactionRows } = await c.env.DB.prepare(
    `SELECT emoji, COUNT(*) AS count,
            MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
     FROM message_reactions
     WHERE message_id = ?
     GROUP BY emoji`
  ).bind(myMember.id, messageId).all<{ emoji: string; count: number; reacted_by_me: number }>();

  const reactions = reactionRows.map((r) => ({
    emoji: r.emoji,
    count: r.count,
    reacted_by_me: r.reacted_by_me === 1,
  }));

  return c.json({ data: { message_id: messageId, reactions } });
});

// ─── PUT /groups/:id/messages/:messageId — edit a message ────────────────────

chat.put('/groups/:id/messages/:messageId', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists, belongs to sender, and is within 15 minutes
  const msg = await c.env.DB.prepare(
    `SELECT id, member_id, created_at FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string; member_id: string; created_at: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  if (msg.member_id !== myMember.id) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own messages' } }, 403);
  }

  // Check 15-minute window
  const createdAt = new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z');
  const now = new Date();
  const diffMin = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  if (diffMin > 15) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messages can only be edited within 15 minutes of sending' } }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 422);
  }

  await c.env.DB.prepare(
    `UPDATE susu_messages SET content = ?, edited_at = datetime('now') WHERE id = ?`
  ).bind(parsed.data.content, messageId).run();

  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  // Get reactions
  const { results: reactionRows } = await c.env.DB.prepare(
    `SELECT emoji, COUNT(*) AS count,
            MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
     FROM message_reactions WHERE message_id = ? GROUP BY emoji`
  ).bind(myMember.id, messageId).all<{ emoji: string; count: number; reacted_by_me: number }>();

  return c.json({
    data: {
      id: row.id,
      content: row.content,
      sender_name: row.sender_name,
      sender_user_id: row.sender_user_id,
      created_at: row.created_at,
      reply_to_id: row.reply_to_id,
      reply_to_content: row.reply_to_content ? (row.reply_to_content.length > 100 ? row.reply_to_content.slice(0, 100) + '...' : row.reply_to_content) : null,
      reply_to_sender: row.reply_to_sender,
      edited_at: row.edited_at,
      is_deleted: false,
      reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count, reacted_by_me: r.reacted_by_me === 1 })),
      read_by_count: 0,
      attachment_url: row.attachment_key ? `/susu/groups/${groupId}/messages/${row.id}/attachment` : null,
      attachment_type: row.attachment_type,
      attachment_name: row.attachment_name,
      attachment_size: row.attachment_size,
    },
  });
});

// ─── DELETE /groups/:id/messages/:messageId — soft delete a message ──────────

chat.delete('/groups/:id/messages/:messageId', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Verify message exists
  const msg = await c.env.DB.prepare(
    `SELECT id, member_id FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ id: string; member_id: string }>();

  if (!msg) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }

  // Check if sender or group creator (for moderation)
  const group = await c.env.DB.prepare(
    `SELECT creator_id FROM susu_groups WHERE id = ?`
  ).bind(groupId).first<{ creator_id: string }>();

  if (msg.member_id !== myMember.id && group?.creator_id !== userId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' } }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE susu_messages SET deleted_at = datetime('now') WHERE id = ?`
  ).bind(messageId).run();

  return c.body(null, 204);
});

// ─── GET /groups/:id/messages/search — search messages ───────────────────────

chat.get('/groups/:id/messages/search', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  const q = c.req.query('q') ?? '';
  if (q.length < 2) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' } }, 422);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.group_id = ? AND m.deleted_at IS NULL AND m.content LIKE ?
     ORDER BY m.created_at DESC
     LIMIT 20`
  ).bind(groupId, `%${q}%`).all<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  const messages = [];
  for (const msg of results) {
    const { results: reactionRows } = await c.env.DB.prepare(
      `SELECT emoji, COUNT(*) AS count,
              MAX(CASE WHEN member_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
       FROM message_reactions WHERE message_id = ? GROUP BY emoji`
    ).bind(myMember.id, msg.id).all<{ emoji: string; count: number; reacted_by_me: number }>();

    messages.push({
      id: msg.id,
      content: msg.content,
      sender_name: msg.sender_name,
      sender_user_id: msg.sender_user_id,
      created_at: msg.created_at,
      reply_to_id: msg.reply_to_id,
      reply_to_content: msg.reply_to_content ? (msg.reply_to_content.length > 100 ? msg.reply_to_content.slice(0, 100) + '...' : msg.reply_to_content) : null,
      reply_to_sender: msg.reply_to_sender,
      edited_at: msg.edited_at,
      is_deleted: false,
      reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count, reacted_by_me: r.reacted_by_me === 1 })),
      read_by_count: 0,
      attachment_url: msg.attachment_key ? `/susu/groups/${groupId}/messages/${msg.id}/attachment` : null,
      attachment_type: msg.attachment_type,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
    });
  }

  return c.json({ data: messages });
});

// ─── POST /groups/:id/messages/upload — upload file and create message ────────

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
]);
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB

chat.post('/groups/:id/messages/upload', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');

  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Expected multipart/form-data' } }, 400);
  }

  const file = formData.get('file');
  const contentText = (formData.get('content') as string | null) ?? '';

  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No file provided' } }, 400);
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'File type not allowed. Accepted: JPEG, PNG, GIF, PDF' } }, 400);
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 5 MB' } }, 400);
  }

  const messageId = generateId();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `chat/${groupId}/${messageId}/${safeFilename}`;

  // Upload to R2
  await c.env.R2.put(r2Key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  // Insert message with attachment fields
  const messageContent = contentText.trim().slice(0, 500);
  await c.env.DB.prepare(
    `INSERT INTO susu_messages (id, group_id, member_id, content, attachment_key, attachment_type, attachment_name, attachment_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(messageId, groupId, myMember.id, messageContent, r2Key, file.type, file.name, file.size).run();

  // Fetch the created message
  const row = await c.env.DB.prepare(
    `SELECT m.id, m.content, m.created_at, sm.display_name AS sender_name, sm.user_id AS sender_user_id,
            m.reply_to_id, m.edited_at, m.deleted_at,
            m.attachment_key, m.attachment_type, m.attachment_name, m.attachment_size,
            rm.content AS reply_to_content, rsm.display_name AS reply_to_sender
     FROM susu_messages m
     JOIN susu_members sm ON m.member_id = sm.id
     LEFT JOIN susu_messages rm ON m.reply_to_id = rm.id
     LEFT JOIN susu_members rsm ON rm.member_id = rsm.id
     WHERE m.id = ?`
  ).bind(messageId).first<{
    id: string; content: string; created_at: string; sender_name: string; sender_user_id: string;
    reply_to_id: string | null; reply_to_content: string | null; reply_to_sender: string | null;
    edited_at: string | null; deleted_at: string | null;
    attachment_key: string | null; attachment_type: string | null; attachment_name: string | null; attachment_size: number | null;
  }>();

  const message = row ? {
    id: row.id,
    content: row.content,
    sender_name: row.sender_name,
    sender_user_id: row.sender_user_id,
    created_at: row.created_at,
    reply_to_id: row.reply_to_id,
    reply_to_content: null,
    reply_to_sender: null,
    edited_at: null,
    is_deleted: false,
    reactions: [] as Array<{ emoji: string; count: number; reacted_by_me: boolean }>,
    read_by_count: 0,
    attachment_url: `/susu/groups/${groupId}/messages/${row.id}/attachment`,
    attachment_type: row.attachment_type,
    attachment_name: row.attachment_name,
    attachment_size: row.attachment_size,
  } : null;

  return c.json({ data: message }, 201);
});

// ─── GET /groups/:id/messages/:messageId/attachment — stream attachment from R2 ──

chat.get('/groups/:id/messages/:messageId/attachment', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');

  // Verify membership
  const myMember = await c.env.DB.prepare(
    `SELECT id FROM susu_members WHERE group_id = ? AND user_id = ?`
  ).bind(groupId, userId).first<{ id: string }>();

  if (!myMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
  }

  // Get attachment info
  const msg = await c.env.DB.prepare(
    `SELECT attachment_key, attachment_type, attachment_name FROM susu_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
  ).bind(messageId, groupId).first<{ attachment_key: string | null; attachment_type: string | null; attachment_name: string | null }>();

  if (!msg?.attachment_key) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Attachment not found' } }, 404);
  }

  const object = await c.env.R2.get(msg.attachment_key);
  if (!object) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'File not found in storage' } }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', msg.attachment_type ?? 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${msg.attachment_name ?? 'attachment'}"`);
  headers.set('Cache-Control', 'private, max-age=3600');

  return new Response(object.body, { headers });
});

// ─── GET /unread-total — total unread messages across all groups ─────────────

chat.get('/unread-total', async (c) => {
  const userId = c.get('userId');

  // Get all groups the user is a member of
  const { results: memberships } = await c.env.DB.prepare(
    `SELECT sm.id AS member_id, sm.group_id
     FROM susu_members sm
     WHERE sm.user_id = ?`
  ).bind(userId).all<{ member_id: string; group_id: string }>();

  if (memberships.length === 0) {
    return c.json({ data: { total: 0 } });
  }

  let total = 0;

  for (const mem of memberships) {
    const receipt = await c.env.DB.prepare(
      `SELECT last_read_message_id FROM chat_read_receipts WHERE member_id = ? AND group_id = ?`
    ).bind(mem.member_id, mem.group_id).first<{ last_read_message_id: string | null }>();

    if (receipt?.last_read_message_id) {
      const cursorRow = await c.env.DB.prepare(
        `SELECT rowid FROM susu_messages WHERE id = ?`
      ).bind(receipt.last_read_message_id).first<{ rowid: number }>();

      if (cursorRow) {
        const countRow = await c.env.DB.prepare(
          `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND rowid > ? AND deleted_at IS NULL`
        ).bind(mem.group_id, cursorRow.rowid).first<{ cnt: number }>();
        total += countRow?.cnt ?? 0;
      }
    } else {
      // No read receipt — all messages are unread
      const countRow = await c.env.DB.prepare(
        `SELECT COUNT(*) AS cnt FROM susu_messages WHERE group_id = ? AND deleted_at IS NULL`
      ).bind(mem.group_id).first<{ cnt: number }>();
      total += countRow?.cnt ?? 0;
    }
  }

  return c.json({ data: { total } });
});

export default chat;
