import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createCategoryRuleSchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const categoryRules = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/category-rules
categoryRules.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE user_id = ? ORDER BY priority DESC'
  ).bind(userId).all();

  return c.json({ data: results });
});

// POST /api/v1/category-rules
categoryRules.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createCategoryRuleSchema.safeParse(body);

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

  // Verify category_id is valid (system category OR user-owned category)
  const category = await c.env.DB.prepare(
    'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
  ).bind(data.category_id, userId).first();

  if (!category) {
    return c.json(
      { error: { code: 'INVALID_CATEGORY', message: 'Category not found or not accessible' } },
      400
    );
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO category_rules (id, user_id, match_type, match_field, match_value, category_id, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    data.match_type,
    data.match_field,
    data.match_value,
    data.category_id,
    data.priority,
  ).run();

  const rule = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: rule }, 201);
});

// PUT /api/v1/category-rules/:id
categoryRules.put('/:id', async (c) => {
  const userId = c.get('userId');
  const ruleId = c.req.param('id');
  const body = await c.req.json();
  const parsed = createCategoryRuleSchema.partial().safeParse(body);

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
    'SELECT id FROM category_rules WHERE id = ? AND user_id = ?'
  ).bind(ruleId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Category rule not found' } },
      404
    );
  }

  const updates = parsed.data;

  // If category_id is changing, verify the new category is valid
  if (updates.category_id !== undefined) {
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

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.match_type !== undefined) {
    setClauses.push('match_type = ?');
    values.push(updates.match_type);
  }
  if (updates.match_field !== undefined) {
    setClauses.push('match_field = ?');
    values.push(updates.match_field);
  }
  if (updates.match_value !== undefined) {
    setClauses.push('match_value = ?');
    values.push(updates.match_value);
  }
  if (updates.category_id !== undefined) {
    setClauses.push('category_id = ?');
    values.push(updates.category_id);
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    values.push(updates.priority);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(ruleId);

  await c.env.DB.prepare(
    `UPDATE category_rules SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const rule = await c.env.DB.prepare(
    'SELECT * FROM category_rules WHERE id = ?'
  ).bind(ruleId).first();

  return c.json({ data: rule });
});

// DELETE /api/v1/category-rules/:id
categoryRules.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const ruleId = c.req.param('id');

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM category_rules WHERE id = ? AND user_id = ?'
  ).bind(ruleId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Category rule not found' } },
      404
    );
  }

  await c.env.DB.prepare('DELETE FROM category_rules WHERE id = ?').bind(ruleId).run();

  return c.body(null, 204);
});

export { categoryRules };
