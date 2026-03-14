import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
} from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const transactions = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// POST /api/v1/transactions
transactions.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createTransactionSchema.safeParse(body);

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

  // Verify account ownership
  const account = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(data.account_id, userId).first();

  if (!account) {
    return c.json(
      { error: { code: 'INVALID_ACCOUNT', message: 'Account not found or not accessible' } },
      400
    );
  }

  // Verify category_id if provided
  if (data.category_id) {
    const category = await c.env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
    ).bind(data.category_id, userId).first();

    if (!category) {
      return c.json(
        { error: { code: 'INVALID_CATEGORY', message: 'Category not found or not accessible' } },
        400
      );
    }
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO transactions (
       id, user_id, account_id, category_id, type, amount_pesewas, fee_pesewas,
       description, counterparty, reference, source, categorized_by, transaction_date
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    data.account_id,
    data.category_id ?? null,
    data.type,
    data.amount_pesewas,
    data.fee_pesewas,
    data.description ?? null,
    data.counterparty ?? null,
    data.reference ?? null,
    data.source,
    data.category_id ? 'user' : null,
    data.transaction_date,
  ).run();

  const transaction = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: transaction }, 201);
});

// GET /api/v1/transactions
transactions.get('/', async (c) => {
  const userId = c.get('userId');
  const queryParams = {
    account_id: c.req.query('account_id'),
    category_id: c.req.query('category_id'),
    type: c.req.query('type'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  };

  const parsed = transactionQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const q = parsed.data;
  const search = c.req.query('search');

  // Build WHERE clauses using prepared statement parameters — no string concatenation of user input
  const whereClauses: string[] = ['t.user_id = ?'];
  const values: unknown[] = [userId];

  if (q.account_id) {
    whereClauses.push('t.account_id = ?');
    values.push(q.account_id);
  }
  if (q.category_id) {
    whereClauses.push('t.category_id = ?');
    values.push(q.category_id);
  }
  if (q.type) {
    whereClauses.push('t.type = ?');
    values.push(q.type);
  }
  if (q.from) {
    whereClauses.push('t.transaction_date >= ?');
    values.push(q.from);
  }
  if (q.to) {
    whereClauses.push('t.transaction_date <= ?');
    values.push(q.to);
  }
  if (search) {
    // Escape LIKE wildcards in the search term to prevent injection via pattern characters
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    whereClauses.push('(t.description LIKE ? ESCAPE \'\\\' OR t.counterparty LIKE ? ESCAPE \'\\\')');
    const pattern = `%${escaped}%`;
    values.push(pattern, pattern);
  }

  const where = whereClauses.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  // Count total matching rows
  const countValues = [...values];
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM transactions t WHERE ${where}`
  ).bind(...countValues).first<{ total: number }>();

  const total = countResult?.total ?? 0;

  // Fetch paginated results
  const listValues = [...values, q.limit, offset];
  const { results } = await c.env.DB.prepare(
    `SELECT t.* FROM transactions t WHERE ${where} ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...listValues).all();

  return c.json({
    data: results,
    meta: { total, page: q.page, limit: q.limit },
  });
});

// GET /api/v1/transactions/:id
transactions.get('/:id', async (c) => {
  const userId = c.get('userId');
  const transactionId = c.req.param('id');

  const transaction = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(transactionId, userId).first();

  if (!transaction) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    );
  }

  return c.json({ data: transaction });
});

// PUT /api/v1/transactions/:id
transactions.put('/:id', async (c) => {
  const userId = c.get('userId');
  const transactionId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTransactionSchema.safeParse(body);

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
    'SELECT id, category_id FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(transactionId, userId).first<{ id: string; category_id: string | null }>();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    );
  }

  const updates = parsed.data;

  // Validate new category_id if changing it
  if (updates.category_id !== undefined && updates.category_id !== null) {
    const category = await c.env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
    ).bind(updates.category_id, userId).first();

    if (!category) {
      return c.json(
        { error: { code: 'INVALID_CATEGORY', message: 'Category not found or not accessible' } },
        400
      );
    }
  }

  // Explicit per-field SET clauses — no Object.entries
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.category_id !== undefined) {
    setClauses.push('category_id = ?');
    values.push(updates.category_id);
    // Changing category sets categorized_by = 'user'
    setClauses.push('categorized_by = ?');
    values.push(updates.category_id !== null ? 'user' : null);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.counterparty !== undefined) {
    setClauses.push('counterparty = ?');
    values.push(updates.counterparty);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(transactionId);

  await c.env.DB.prepare(
    `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const transaction = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ?'
  ).bind(transactionId).first();

  return c.json({ data: transaction });
});

// DELETE /api/v1/transactions/:id
transactions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const transactionId = c.req.param('id');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM transactions WHERE id = ? AND user_id = ?'
  ).bind(transactionId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
      404
    );
  }

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(transactionId).run();

  return c.body(null, 204);
});

export { transactions };
