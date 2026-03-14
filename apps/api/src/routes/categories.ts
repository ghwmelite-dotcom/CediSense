import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createCategorySchema, updateCategorySchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const categories = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// GET /api/v1/categories
// Returns system categories (user_id IS NULL) plus the user's custom categories
categories.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY sort_order ASC'
  ).bind(userId).all();

  return c.json({ data: results });
});

// POST /api/v1/categories
categories.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);

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
    `INSERT INTO categories (id, user_id, name, icon, color, type, parent_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    data.name,
    data.icon ?? null,
    data.color ?? null,
    data.type,
    data.parent_id ?? null,
    data.sort_order,
  ).run();

  const category = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first();

  return c.json({ data: category }, 201);
});

// PUT /api/v1/categories/:id
categories.put('/:id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);

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

  // Verify ownership — only user-owned categories can be updated
  const existing = await c.env.DB.prepare(
    'SELECT id FROM categories WHERE id = ? AND user_id = ?'
  ).bind(categoryId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Category not found or not editable' } },
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
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (updates.sort_order !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(updates.sort_order);
  }

  if (setClauses.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
      400
    );
  }

  values.push(categoryId);

  await c.env.DB.prepare(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const category = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(categoryId).first();

  return c.json({ data: category });
});

// DELETE /api/v1/categories/:id
categories.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('id');

  // Verify ownership — only user-owned categories can be deleted
  const existing = await c.env.DB.prepare(
    'SELECT id FROM categories WHERE id = ? AND user_id = ?'
  ).bind(categoryId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Category not found or not deletable' } },
      404
    );
  }

  // Null out category_id on all transactions that reference this category
  await c.env.DB.prepare(
    'UPDATE transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?'
  ).bind(categoryId, userId).run();

  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();

  return c.body(null, 204);
});

export { categories };
