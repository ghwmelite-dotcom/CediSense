import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createIOUSchema } from '@cedisense/shared';

const ious = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/ious — list IOUs with meta totals
// Query param: settled = 'false' (default) | 'true' | 'all'
ious.get('/', async (c) => {
  const userId = c.get('userId');
  const settledParam = c.req.query('settled') ?? 'false';

  let whereClause = 'WHERE user_id = ?';
  const bindings: unknown[] = [userId];

  if (settledParam === 'false') {
    whereClause += ' AND is_settled = 0';
  } else if (settledParam === 'true') {
    whereClause += ' AND is_settled = 1';
  }
  // 'all' — no extra filter

  const { results } = await c.env.DB.prepare(
    `SELECT id, user_id, person_name, description, amount_pesewas, direction,
            is_settled, transaction_id, settled_at, created_at
     FROM ious
     ${whereClause}
     ORDER BY created_at DESC`
  ).bind(...bindings).all<{
    id: string;
    user_id: string;
    person_name: string;
    description: string | null;
    amount_pesewas: number;
    direction: 'owed_to_me' | 'i_owe';
    is_settled: number;
    transaction_id: string | null;
    settled_at: string | null;
    created_at: string;
  }>();

  // Map is_settled from 0/1 to boolean
  const data = results.map(row => ({
    ...row,
    is_settled: row.is_settled === 1,
  }));

  // Compute meta totals over the filtered set
  const totalOwedToMe = data
    .filter(r => r.direction === 'owed_to_me' && !r.is_settled)
    .reduce((sum, r) => sum + r.amount_pesewas, 0);

  const totalIOwe = data
    .filter(r => r.direction === 'i_owe' && !r.is_settled)
    .reduce((sum, r) => sum + r.amount_pesewas, 0);

  return c.json({
    data,
    meta: {
      total_owed_to_me: totalOwedToMe,
      total_i_owe: totalIOwe,
      net: totalOwedToMe - totalIOwe,
    },
  });
});

// POST /api/v1/ious — create a new IOU
ious.post('/', async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = createIOUSchema.safeParse(body);

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

  const { person_name, amount_pesewas, direction, description, transaction_id } = parsed.data;

  // If transaction_id provided, verify ownership
  if (transaction_id) {
    const txn = await c.env.DB.prepare(
      `SELECT id FROM transactions WHERE id = ? AND user_id = ?`
    ).bind(transaction_id, userId).first();

    if (!txn) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'Transaction not found or access denied' } },
        404
      );
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO ious (user_id, person_name, description, amount_pesewas, direction, transaction_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    userId,
    person_name,
    description ?? null,
    amount_pesewas,
    direction,
    transaction_id ?? null,
  ).run();

  // Fetch the newly created row (D1 doesn't return lastInsertRowId reliably for TEXT PKs)
  const created = await c.env.DB.prepare(
    `SELECT id, user_id, person_name, description, amount_pesewas, direction,
            is_settled, transaction_id, settled_at, created_at
     FROM ious
     WHERE user_id = ? AND person_name = ? AND amount_pesewas = ? AND direction = ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(userId, person_name, amount_pesewas, direction).first<{
    id: string;
    user_id: string;
    person_name: string;
    description: string | null;
    amount_pesewas: number;
    direction: 'owed_to_me' | 'i_owe';
    is_settled: number;
    transaction_id: string | null;
    settled_at: string | null;
    created_at: string;
  }>();

  return c.json(
    { data: { ...created!, is_settled: created!.is_settled === 1 } },
    201
  );
});

// POST /api/v1/ious/:id/settle — mark an IOU as settled
ious.post('/:id/settle', async (c) => {
  const userId = c.get('userId');
  const iouId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id FROM ious WHERE id = ? AND user_id = ?`
  ).bind(iouId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'IOU not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    `UPDATE ious SET is_settled = 1, settled_at = datetime('now') WHERE id = ?`
  ).bind(iouId).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, user_id, person_name, description, amount_pesewas, direction,
            is_settled, transaction_id, settled_at, created_at
     FROM ious WHERE id = ?`
  ).bind(iouId).first<{
    id: string;
    user_id: string;
    person_name: string;
    description: string | null;
    amount_pesewas: number;
    direction: 'owed_to_me' | 'i_owe';
    is_settled: number;
    transaction_id: string | null;
    settled_at: string | null;
    created_at: string;
  }>();

  return c.json({ data: { ...updated!, is_settled: updated!.is_settled === 1 } });
});

// DELETE /api/v1/ious/:id — delete an IOU
ious.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const iouId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id FROM ious WHERE id = ? AND user_id = ?`
  ).bind(iouId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'IOU not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    `DELETE FROM ious WHERE id = ?`
  ).bind(iouId).run();

  return c.body(null, 204);
});

export { ious };
