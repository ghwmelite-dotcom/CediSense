import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createBudgetSchema, updateBudgetSchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { currentMonth, lastDayOfMonth } from '../lib/dashboard-queries.js';

const budgets = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/budgets — List budgets with current month spending
budgets.get('/', async (c) => {
  const userId = c.get('userId');
  const month = currentMonth();
  const startDate = `${month}-01`;
  const endDate = lastDayOfMonth(month);

  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.category_id, b.amount_pesewas,
            c.name as category_name, COALESCE(c.icon, '📦') as category_icon,
            COALESCE(c.color, '#888888') as category_color,
            COALESCE(s.spent, 0) as spent_pesewas
     FROM budgets b
     JOIN categories c ON b.category_id = c.id
     LEFT JOIN (
       SELECT category_id, SUM(amount_pesewas) as spent
       FROM transactions
       WHERE user_id = ? AND type = 'debit'
         AND transaction_date >= ? AND transaction_date <= ?
       GROUP BY category_id
     ) s ON b.category_id = s.category_id
     WHERE b.user_id = ?
     ORDER BY COALESCE(s.spent, 0) * 1.0 / b.amount_pesewas DESC`
  ).bind(userId, startDate, endDate, userId).all();

  const enriched = results.map(row => {
    const spent = (row.spent_pesewas as number) ?? 0;
    const amount = row.amount_pesewas as number;
    const percentage = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
    const status = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'on_track';
    return { ...row, percentage, status, remaining_pesewas: amount - spent };
  });

  return c.json({ data: enriched });
});

// POST /api/v1/budgets — Create budget
budgets.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createBudgetSchema.safeParse(body);

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

  // Verify category exists, is accessible to the user, and is expense-type
  const category = await c.env.DB.prepare(
    `SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?) AND type = 'expense'`
  ).bind(data.category_id, userId).first();

  if (!category) {
    return c.json(
      {
        error: {
          code: 'INVALID_CATEGORY',
          message: 'Category not found, not accessible, or not an expense category',
        },
      },
      400
    );
  }

  const id = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO budgets (id, user_id, category_id, amount_pesewas) VALUES (?, ?, ?, ?)`
    ).bind(id, userId, data.category_id, data.amount_pesewas).run();
  } catch (err: unknown) {
    // D1 surfaces UNIQUE constraint violations in the error message
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('unique')) {
      return c.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'A budget for this category already exists',
          },
        },
        409
      );
    }
    throw err;
  }

  const budget = await c.env.DB.prepare(
    'SELECT * FROM budgets WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: budget }, 201);
});

// PUT /api/v1/budgets/:id — Update budget amount
budgets.put('/:id', async (c) => {
  const userId = c.get('userId');
  const budgetId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateBudgetSchema.safeParse(body);

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
    'SELECT id FROM budgets WHERE id = ? AND user_id = ?'
  ).bind(budgetId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Budget not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    `UPDATE budgets SET amount_pesewas = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(parsed.data.amount_pesewas, budgetId).run();

  const budget = await c.env.DB.prepare(
    'SELECT * FROM budgets WHERE id = ?'
  ).bind(budgetId).first();

  return c.json({ data: budget });
});

// DELETE /api/v1/budgets/:id — Delete budget
budgets.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const budgetId = c.req.param('id');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM budgets WHERE id = ? AND user_id = ?'
  ).bind(budgetId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Budget not found' } },
      404
    );
  }

  await c.env.DB.prepare('DELETE FROM budgets WHERE id = ?').bind(budgetId).run();

  return c.body(null, 204);
});

export { budgets };
