import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createAccountSchema, updateAccountSchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const accounts = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// POST /api/v1/accounts
accounts.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);

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

  const data = parsed.data;
  const id = generateId();

  // If setting as primary, unset other primary accounts first
  if (data.is_primary) {
    await c.env.DB.prepare(
      'UPDATE accounts SET is_primary = 0 WHERE user_id = ? AND is_primary = 1'
    ).bind(userId).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO accounts (id, user_id, name, type, provider, account_number, balance_ghs, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, data.name, data.type,
    data.provider ?? null, data.account_number ?? null,
    data.balance_ghs, data.is_primary ? 1 : 0
  ).run();

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: account }, 201);
});

// GET /api/v1/accounts
accounts.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
  ).bind(userId).all();

  return c.json({ data: results });
});

// PUT /api/v1/accounts/:id
accounts.put('/:id', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateAccountSchema.safeParse(body);

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

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Account not found' } },
      404
    );
  }

  const updates = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.balance_ghs !== undefined) {
    setClauses.push('balance_ghs = ?');
    values.push(updates.balance_ghs);
  }
  if (updates.is_primary !== undefined) {
    if (updates.is_primary) {
      await c.env.DB.prepare(
        'UPDATE accounts SET is_primary = 0 WHERE user_id = ? AND is_primary = 1'
      ).bind(userId).run();
    }
    setClauses.push('is_primary = ?');
    values.push(updates.is_primary ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(accountId);

  await c.env.DB.prepare(
    `UPDATE accounts SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ?'
  ).bind(accountId).first();

  return c.json({ data: account });
});

// DELETE /api/v1/accounts/:id
accounts.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.param('id');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Account not found' } },
      404
    );
  }

  // Prevent deleting last account
  const { count } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM accounts WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>() ?? { count: 0 };

  if (count <= 1) {
    return c.json(
      { error: { code: 'LAST_ACCOUNT', message: 'Cannot delete your last account' } },
      400
    );
  }

  await c.env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();

  return c.body(null, 204);
});

export { accounts };
