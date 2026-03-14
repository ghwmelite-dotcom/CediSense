import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { confirmCandidateSchema, updateRecurringSchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { detectRecurringPatterns, computeNextDueDate } from '../lib/recurring-detection.js';

const recurring = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// POST /api/v1/recurring/scan — detect recurring patterns from last 6 months of debits
recurring.post('/scan', async (c) => {
  const userId = c.get('userId');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
  const cutoffDate = sixMonthsAgo.toISOString().slice(0, 10);

  // Fetch debit transactions from last 6 months
  const { results: txnRows } = await c.env.DB.prepare(
    `SELECT counterparty, amount_pesewas, category_id, transaction_date
     FROM transactions
     WHERE user_id = ? AND type = 'debit' AND transaction_date >= ?`
  ).bind(userId, cutoffDate).all<{
    counterparty: string | null;
    amount_pesewas: number;
    category_id: string | null;
    transaction_date: string;
  }>();

  // Fetch confirmed counterparties (already in recurring_transactions)
  const { results: confirmedRows } = await c.env.DB.prepare(
    `SELECT LOWER(counterparty) as cp FROM recurring_transactions WHERE user_id = ?`
  ).bind(userId).all<{ cp: string }>();

  // Fetch dismissed counterparties
  const { results: dismissedRows } = await c.env.DB.prepare(
    `SELECT LOWER(counterparty) as cp FROM recurring_candidates WHERE user_id = ? AND dismissed = 1`
  ).bind(userId).all<{ cp: string }>();

  const confirmedSet = new Set(confirmedRows.map(r => r.cp));
  const dismissedSet = new Set(dismissedRows.map(r => r.cp));

  const candidates = detectRecurringPatterns(txnRows, confirmedSet, dismissedSet);

  // Upsert candidates — skip dismissed ones via WHERE dismissed = 0
  for (const candidate of candidates) {
    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO recurring_candidates
         (id, user_id, counterparty, category_id, avg_amount_pesewas, frequency, occurrence_count, last_occurrence_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, counterparty) DO UPDATE SET
         avg_amount_pesewas = excluded.avg_amount_pesewas,
         frequency = excluded.frequency,
         occurrence_count = excluded.occurrence_count,
         last_occurrence_date = excluded.last_occurrence_date,
         updated_at = datetime('now')
       WHERE dismissed = 0`
    ).bind(
      id,
      userId,
      candidate.counterparty,
      candidate.category_id,
      candidate.avg_amount_pesewas,
      candidate.frequency,
      candidate.occurrence_count,
      candidate.last_occurrence_date,
    ).run();
  }

  // Return non-dismissed candidates
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM recurring_candidates WHERE user_id = ? AND dismissed = 0 ORDER BY occurrence_count DESC`
  ).bind(userId).all();

  return c.json({ data: results });
});

// GET /api/v1/recurring/candidates — list non-dismissed candidates
recurring.get('/candidates', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT id, user_id, counterparty, category_id, avg_amount_pesewas, frequency,
            occurrence_count, last_occurrence_date, dismissed, created_at, updated_at
     FROM recurring_candidates
     WHERE user_id = ? AND dismissed = 0
     ORDER BY occurrence_count DESC`
  ).bind(userId).all();

  return c.json({ data: results });
});

// POST /api/v1/recurring/candidates/:id/confirm — promote candidate to recurring_transaction
recurring.post('/candidates/:id/confirm', async (c) => {
  const userId = c.get('userId');
  const candidateId = c.req.param('id');

  const body = await c.req.json();
  const parsed = confirmCandidateSchema.safeParse(body);

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

  const candidate = await c.env.DB.prepare(
    `SELECT * FROM recurring_candidates WHERE id = ? AND user_id = ? AND dismissed = 0`
  ).bind(candidateId, userId).first<{
    id: string;
    user_id: string;
    counterparty: string;
    category_id: string | null;
    avg_amount_pesewas: number;
    frequency: string;
    occurrence_count: number;
    last_occurrence_date: string;
  }>();

  if (!candidate) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Candidate not found' } },
      404
    );
  }

  const nextDueDate = computeNextDueDate(candidate.last_occurrence_date, candidate.frequency);
  const id = generateId();
  const reminderDaysBefore = parsed.data.reminder_days_before;

  await c.env.DB.prepare(
    `INSERT INTO recurring_transactions
       (id, user_id, counterparty, category_id, expected_amount_pesewas, frequency, next_due_date, reminder_days_before, last_detected_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    candidate.counterparty,
    candidate.category_id,
    candidate.avg_amount_pesewas,
    candidate.frequency,
    nextDueDate,
    reminderDaysBefore,
    candidate.last_occurrence_date,
  ).run();

  // Remove the candidate after confirmation
  await c.env.DB.prepare(
    `DELETE FROM recurring_candidates WHERE id = ?`
  ).bind(candidateId).run();

  const created = await c.env.DB.prepare(
    `SELECT * FROM recurring_transactions WHERE id = ?`
  ).bind(id).first();

  return c.json({ data: created }, 201);
});

// POST /api/v1/recurring/candidates/:id/dismiss — soft-delete candidate
recurring.post('/candidates/:id/dismiss', async (c) => {
  const userId = c.get('userId');
  const candidateId = c.req.param('id');

  const { meta } = await c.env.DB.prepare(
    `UPDATE recurring_candidates SET dismissed = 1, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).bind(candidateId, userId).run();

  if (meta.changes === 0) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Candidate not found' } },
      404
    );
  }

  return c.body(null, 204);
});

// GET /api/v1/recurring/upcoming — upcoming active recurring transactions
recurring.get('/upcoming', async (c) => {
  const userId = c.get('userId');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10) || 5)) : 5;

  const { results } = await c.env.DB.prepare(
    `SELECT rt.id, rt.user_id, rt.counterparty, rt.category_id, rt.expected_amount_pesewas,
            rt.amount_tolerance_percent, rt.frequency, rt.next_due_date, rt.reminder_days_before,
            rt.is_active, rt.last_detected_date, rt.created_at, rt.updated_at,
            c.name as category_name, COALESCE(c.icon, '📦') as category_icon,
            COALESCE(c.color, '#888888') as category_color
     FROM recurring_transactions rt
     LEFT JOIN categories c ON rt.category_id = c.id
     WHERE rt.user_id = ? AND rt.is_active = 1
     ORDER BY rt.next_due_date ASC
     LIMIT ?`
  ).bind(userId, limit).all<{
    id: string;
    user_id: string;
    counterparty: string;
    category_id: string | null;
    expected_amount_pesewas: number;
    amount_tolerance_percent: number;
    frequency: string;
    next_due_date: string;
    reminder_days_before: number;
    is_active: number;
    last_detected_date: string | null;
    created_at: string;
    updated_at: string;
    category_name: string | null;
    category_icon: string;
    category_color: string;
  }>();

  const enriched = results.map(row => {
    const daysDiff = Math.ceil(
      (new Date(row.next_due_date + 'T23:59:59').getTime() - Date.now()) / 86400000
    );
    const status =
      daysDiff < 0
        ? 'overdue'
        : daysDiff <= row.reminder_days_before
        ? 'due_soon'
        : 'upcoming';
    return { ...row, is_active: row.is_active === 1, days_until_due: daysDiff, status };
  });

  return c.json({ data: enriched });
});

// GET /api/v1/recurring — list all recurring transactions with status
recurring.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT rt.id, rt.user_id, rt.counterparty, rt.category_id, rt.expected_amount_pesewas,
            rt.amount_tolerance_percent, rt.frequency, rt.next_due_date, rt.reminder_days_before,
            rt.is_active, rt.last_detected_date, rt.created_at, rt.updated_at,
            c.name as category_name, COALESCE(c.icon, '📦') as category_icon,
            COALESCE(c.color, '#888888') as category_color
     FROM recurring_transactions rt
     LEFT JOIN categories c ON rt.category_id = c.id
     WHERE rt.user_id = ?
     ORDER BY rt.next_due_date ASC`
  ).bind(userId).all<{
    id: string;
    user_id: string;
    counterparty: string;
    category_id: string | null;
    expected_amount_pesewas: number;
    amount_tolerance_percent: number;
    frequency: string;
    next_due_date: string;
    reminder_days_before: number;
    is_active: number;
    last_detected_date: string | null;
    created_at: string;
    updated_at: string;
    category_name: string | null;
    category_icon: string;
    category_color: string;
  }>();

  const enriched = results.map(row => {
    const daysDiff = Math.ceil(
      (new Date(row.next_due_date + 'T23:59:59').getTime() - Date.now()) / 86400000
    );
    const status =
      daysDiff < 0
        ? 'overdue'
        : daysDiff <= row.reminder_days_before
        ? 'due_soon'
        : 'upcoming';
    return { ...row, is_active: row.is_active === 1, days_until_due: daysDiff, status };
  });

  return c.json({ data: enriched });
});

// PUT /api/v1/recurring/:id — update recurring transaction
recurring.put('/:id', async (c) => {
  const userId = c.get('userId');
  const recurringId = c.req.param('id');

  const body = await c.req.json();
  const parsed = updateRecurringSchema.safeParse(body);

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

  const existing = await c.env.DB.prepare(
    `SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?`
  ).bind(recurringId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Recurring transaction not found' } },
      404
    );
  }

  const data = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (data.expected_amount_pesewas !== undefined) {
    setClauses.push('expected_amount_pesewas = ?');
    values.push(data.expected_amount_pesewas);
  }
  if (data.frequency !== undefined) {
    setClauses.push('frequency = ?');
    values.push(data.frequency);
  }
  if (data.reminder_days_before !== undefined) {
    setClauses.push('reminder_days_before = ?');
    values.push(data.reminder_days_before);
  }
  if (data.next_due_date !== undefined) {
    setClauses.push('next_due_date = ?');
    values.push(data.next_due_date);
  }
  if (data.is_active !== undefined) {
    setClauses.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }

  if (setClauses.length === 0) {
    const row = await c.env.DB.prepare(
      `SELECT * FROM recurring_transactions WHERE id = ?`
    ).bind(recurringId).first();
    return c.json({ data: row });
  }

  setClauses.push(`updated_at = datetime('now')`);
  values.push(recurringId);

  await c.env.DB.prepare(
    `UPDATE recurring_transactions SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare(
    `SELECT * FROM recurring_transactions WHERE id = ?`
  ).bind(recurringId).first();

  return c.json({ data: updated });
});

// DELETE /api/v1/recurring/:id — delete recurring transaction
recurring.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const recurringId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?`
  ).bind(recurringId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Recurring transaction not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    `DELETE FROM recurring_transactions WHERE id = ?`
  ).bind(recurringId).run();

  return c.body(null, 204);
});

export { recurring };
