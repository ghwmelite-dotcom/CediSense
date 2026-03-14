import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createGoalSchema,
  updateGoalSchema,
  contributeSchema,
} from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const goals = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/goals
goals.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, target_pesewas, current_pesewas, deadline, created_at
     FROM savings_goals
     WHERE user_id = ?
     ORDER BY
       CASE WHEN current_pesewas >= target_pesewas THEN 1 ELSE 0 END ASC,
       current_pesewas * 1.0 / target_pesewas DESC`
  ).bind(userId).all();

  const enriched = results.map((row) => {
    const current = row.current_pesewas as number;
    const target = row.target_pesewas as number;
    const percentage = Math.min(Math.round((current / target) * 1000) / 10, 100);
    let days_remaining: number | null = null;
    if (row.deadline) {
      const deadlineDate = new Date((row.deadline as string) + 'T23:59:59');
      days_remaining = Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000);
    }
    return {
      ...row,
      percentage,
      days_remaining,
      is_complete: current >= target,
    };
  });

  return c.json({ data: enriched });
});

// POST /api/v1/goals
goals.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createGoalSchema.safeParse(body);

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

  await c.env.DB.prepare(
    `INSERT INTO savings_goals (id, user_id, name, target_pesewas, current_pesewas, deadline)
     VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(
    id,
    userId,
    data.name,
    data.target_pesewas,
    data.deadline ?? null,
  ).run();

  const goal = await c.env.DB.prepare(
    'SELECT * FROM savings_goals WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: goal }, 201);
});

// PUT /api/v1/goals/:id
goals.put('/:id', async (c) => {
  const userId = c.get('userId');
  const goalId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateGoalSchema.safeParse(body);

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

  // Ownership check
  const existing = await c.env.DB.prepare(
    'SELECT id FROM savings_goals WHERE id = ? AND user_id = ?'
  ).bind(goalId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Goal not found' } },
      404
    );
  }

  const updates = parsed.data;

  // Explicit per-field SET clauses — no Object.entries
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.target_pesewas !== undefined) {
    setClauses.push('target_pesewas = ?');
    values.push(updates.target_pesewas);
  }
  if (updates.deadline !== undefined) {
    setClauses.push('deadline = ?');
    values.push(updates.deadline);
  }

  if (setClauses.length === 1) {
    // Only updated_at — no actual fields to update
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(goalId);

  await c.env.DB.prepare(
    `UPDATE savings_goals SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const goal = await c.env.DB.prepare(
    'SELECT * FROM savings_goals WHERE id = ?'
  ).bind(goalId).first();

  return c.json({ data: goal });
});

// POST /api/v1/goals/:id/contribute
goals.post('/:id/contribute', async (c) => {
  const userId = c.get('userId');
  const goalId = c.req.param('id');
  const body = await c.req.json();
  const parsed = contributeSchema.safeParse(body);

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

  // Ownership check
  const existing = await c.env.DB.prepare(
    'SELECT id FROM savings_goals WHERE id = ? AND user_id = ?'
  ).bind(goalId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Goal not found' } },
      404
    );
  }

  const { amount_pesewas } = parsed.data;

  // MIN cap is idempotent — no pre-check for completeness needed
  await c.env.DB.prepare(
    `UPDATE savings_goals
     SET current_pesewas = MIN(current_pesewas + ?, target_pesewas),
         updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).bind(amount_pesewas, goalId, userId).run();

  const goal = await c.env.DB.prepare(
    'SELECT * FROM savings_goals WHERE id = ?'
  ).bind(goalId).first();

  return c.json({ data: goal });
});

// DELETE /api/v1/goals/:id
goals.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const goalId = c.req.param('id');

  // Ownership check
  const existing = await c.env.DB.prepare(
    'SELECT id FROM savings_goals WHERE id = ? AND user_id = ?'
  ).bind(goalId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Goal not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    'DELETE FROM savings_goals WHERE id = ?'
  ).bind(goalId).run();

  return c.body(null, 204);
});

export { goals };
