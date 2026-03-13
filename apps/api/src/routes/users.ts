import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { updateUserSchema } from '@cedisense/shared';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/users/me
users.get('/me', async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    `SELECT id, phone, name, monthly_income_ghs, preferred_language, onboarding_completed, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(userId).first();

  if (!user) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'User not found' } },
      404
    );
  }

  return c.json({ data: user });
});

// PUT /api/v1/users/me
users.put('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.monthly_income_ghs !== undefined) {
    setClauses.push('monthly_income_ghs = ?');
    values.push(updates.monthly_income_ghs);
  }
  if (updates.preferred_language !== undefined) {
    setClauses.push('preferred_language = ?');
    values.push(updates.preferred_language);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(userId);

  await c.env.DB.prepare(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const user = await c.env.DB.prepare(
    `SELECT id, phone, name, monthly_income_ghs, preferred_language, onboarding_completed, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(userId).first();

  return c.json({ data: user });
});

// PUT /api/v1/users/me/onboarding
users.put('/me/onboarding', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  if (body?.completed !== true) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Body must contain { completed: true }' } },
      400
    );
  }

  await c.env.DB.prepare(
    'UPDATE users SET onboarding_completed = 1 WHERE id = ?'
  ).bind(userId).run();

  return c.body(null, 204);
});

export { users };
