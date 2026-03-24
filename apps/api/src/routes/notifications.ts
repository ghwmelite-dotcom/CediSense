// apps/api/src/routes/notifications.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { NotificationService } from '../lib/notifications.js';
import {
  notificationQuerySchema,
  pushSubscriptionSchema,
  notificationPreferencesSchema,
} from '@cedisense/shared';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET / — paginated notification feed
notifications.get('/', async (c) => {
  const userId = c.get('userId');
  const raw = {
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    unread_only: c.req.query('unread_only'),
  };

  const parsed = notificationQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  const result = await service.list(userId, {
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    unreadOnly: parsed.data.unread_only === '1',
  });

  // Return cursor/has_more inside data (not in meta) because the frontend
  // api.get<T> helper unwraps ApiSuccess.data and discards meta.
  return c.json({
    data: { items: result.notifications, cursor: result.cursor, has_more: result.has_more },
  });
});

// GET /unread-count — for bell badge polling
notifications.get('/unread-count', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  const count = await service.unreadCount(userId);
  return c.json({ data: { count } });
});

// PATCH /:id/read — mark single as read
notifications.patch('/:id/read', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const service = new NotificationService(c.env);
  await service.markRead(userId, id);
  return c.json({ data: { success: true } });
});

// PATCH /read-all — mark all as read
notifications.patch('/read-all', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  await service.markAllRead(userId);
  return c.json({ data: { success: true } });
});

// POST /push/subscribe — save push subscription
notifications.post('/push/subscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  await service.subscribe(userId, parsed.data);
  return c.json({ data: { success: true } }, 201);
});

// POST /push/unsubscribe — remove push subscription
notifications.post('/push/unsubscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  if (!body.endpoint || typeof body.endpoint !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'endpoint is required' } }, 400);
  }

  const service = new NotificationService(c.env);
  await service.unsubscribe(userId, body.endpoint);
  return c.json({ data: { success: true } });
});

// GET /preferences — get notification preferences
notifications.get('/preferences', async (c) => {
  const userId = c.get('userId');
  const service = new NotificationService(c.env);
  const prefs = await service.getPreferences(userId);
  return c.json({ data: prefs });
});

// PUT /preferences — update notification preferences
notifications.put('/preferences', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = notificationPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  const service = new NotificationService(c.env);
  const updated = await service.updatePreferences(userId, parsed.data);
  return c.json({ data: updated });
});

export { notifications };
