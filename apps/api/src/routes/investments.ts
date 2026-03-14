import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createInvestmentSchema, updateInvestmentSchema } from '@cedisense/shared';
import type { InvestmentType } from '@cedisense/shared';

const investments = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface InvestmentRow {
  id: string;
  user_id: string;
  type: InvestmentType;
  name: string;
  institution: string | null;
  amount_pesewas: number;
  rate_percent: number | null;
  purchase_date: string;
  maturity_date: string | null;
  current_value_pesewas: number | null;
  is_matured: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function computeReturns(row: InvestmentRow) {
  const now = Date.now();
  const purchaseMs = new Date(row.purchase_date + 'T00:00:00Z').getTime();
  const days_held = Math.floor((now - purchaseMs) / 86_400_000);

  const days_to_maturity = row.maturity_date
    ? Math.ceil((new Date(row.maturity_date + 'T00:00:00Z').getTime() - now) / 86_400_000)
    : null;

  let expected_return_pesewas: number;
  let current_value_computed_pesewas: number;

  if (row.type === 'tbill' || row.type === 'fixed_deposit') {
    const rate = row.rate_percent ?? 0;
    expected_return_pesewas = Math.round(
      row.amount_pesewas * (rate / 100) * (days_held / 365)
    );
    current_value_computed_pesewas = row.amount_pesewas + expected_return_pesewas;
  } else {
    // mutual_fund | other
    const currentValue = row.current_value_pesewas ?? row.amount_pesewas;
    expected_return_pesewas = currentValue - row.amount_pesewas;
    current_value_computed_pesewas = currentValue;
  }

  return {
    ...row,
    is_matured: row.is_matured === 1,
    expected_return_pesewas,
    current_value_computed_pesewas,
    days_held,
    days_to_maturity,
  };
}

// ─── GET / — list all investments with computed returns ──────────────────────

investments.get('/', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT id, user_id, type, name, institution, amount_pesewas, rate_percent,
            purchase_date, maturity_date, current_value_pesewas, is_matured, notes,
            created_at, updated_at
     FROM investments
     WHERE user_id = ?
     ORDER BY purchase_date DESC`
  ).bind(userId).all<InvestmentRow>();

  const data = results.map(computeReturns);

  return c.json({ data });
});

// ─── GET /summary — aggregate totals + breakdown by type ─────────────────────

investments.get('/summary', async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT id, user_id, type, name, institution, amount_pesewas, rate_percent,
            purchase_date, maturity_date, current_value_pesewas, is_matured, notes,
            created_at, updated_at
     FROM investments
     WHERE user_id = ?`
  ).bind(userId).all<InvestmentRow>();

  let total_invested_pesewas = 0;
  let total_current_value_pesewas = 0;

  const typeMap = new Map<InvestmentType, { count: number; total_pesewas: number }>();

  for (const row of results) {
    const computed = computeReturns(row);
    total_invested_pesewas += row.amount_pesewas;
    total_current_value_pesewas += computed.current_value_computed_pesewas;

    const existing = typeMap.get(row.type) ?? { count: 0, total_pesewas: 0 };
    typeMap.set(row.type, {
      count: existing.count + 1,
      total_pesewas: existing.total_pesewas + row.amount_pesewas,
    });
  }

  const by_type = Array.from(typeMap.entries()).map(([type, val]) => ({
    type,
    count: val.count,
    total_pesewas: val.total_pesewas,
  }));

  return c.json({
    data: {
      total_invested_pesewas,
      total_current_value_pesewas,
      total_returns_pesewas: total_current_value_pesewas - total_invested_pesewas,
      by_type,
    },
  });
});

// ─── POST / — create a new investment ────────────────────────────────────────

investments.post('/', async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = createInvestmentSchema.safeParse(body);

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

  const {
    type,
    name,
    institution,
    amount_pesewas,
    rate_percent,
    purchase_date,
    maturity_date,
    current_value_pesewas,
    notes,
  } = parsed.data;

  await c.env.DB.prepare(
    `INSERT INTO investments
       (user_id, type, name, institution, amount_pesewas, rate_percent,
        purchase_date, maturity_date, current_value_pesewas, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId,
    type,
    name,
    institution ?? null,
    amount_pesewas,
    rate_percent ?? null,
    purchase_date,
    maturity_date ?? null,
    current_value_pesewas ?? null,
    notes ?? null,
  ).run();

  const created = await c.env.DB.prepare(
    `SELECT id, user_id, type, name, institution, amount_pesewas, rate_percent,
            purchase_date, maturity_date, current_value_pesewas, is_matured, notes,
            created_at, updated_at
     FROM investments
     WHERE user_id = ? AND name = ? AND purchase_date = ? AND amount_pesewas = ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(userId, name, purchase_date, amount_pesewas).first<InvestmentRow>();

  return c.json({ data: computeReturns(created!) }, 201);
});

// ─── PUT /:id — update mutable fields ────────────────────────────────────────

investments.put('/:id', async (c) => {
  const userId = c.get('userId');
  const investmentId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id FROM investments WHERE id = ? AND user_id = ?`
  ).bind(investmentId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Investment not found' } },
      404
    );
  }

  const body = await c.req.json();
  const parsed = updateInvestmentSchema.safeParse(body);

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

  const { current_value_pesewas, maturity_date, notes } = parsed.data;

  // Build SET clauses explicitly to handle nullable maturity_date correctly
  const setClauses: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (current_value_pesewas !== undefined) {
    setClauses.push('current_value_pesewas = ?');
    bindings.push(current_value_pesewas);
  }
  if (maturity_date !== undefined) {
    setClauses.push('maturity_date = ?');
    bindings.push(maturity_date); // may be null to clear it
  }
  if (notes !== undefined) {
    setClauses.push('notes = ?');
    bindings.push(notes);
  }
  bindings.push(investmentId);

  await c.env.DB.prepare(
    `UPDATE investments SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...bindings).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, user_id, type, name, institution, amount_pesewas, rate_percent,
            purchase_date, maturity_date, current_value_pesewas, is_matured, notes,
            created_at, updated_at
     FROM investments WHERE id = ?`
  ).bind(investmentId).first<InvestmentRow>();

  return c.json({ data: computeReturns(updated!) });
});

// ─── POST /:id/mature — mark an investment as matured ────────────────────────

investments.post('/:id/mature', async (c) => {
  const userId = c.get('userId');
  const investmentId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id, amount_pesewas, rate_percent, purchase_date, current_value_pesewas, type
     FROM investments WHERE id = ? AND user_id = ?`
  ).bind(investmentId, userId).first<{
    id: string;
    amount_pesewas: number;
    rate_percent: number | null;
    purchase_date: string;
    current_value_pesewas: number | null;
    type: InvestmentType;
  }>();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Investment not found' } },
      404
    );
  }

  // Compute final value from rate if current_value_pesewas is not set and type supports it
  let finalValue: number | null = existing.current_value_pesewas;
  if (finalValue === null && (existing.type === 'tbill' || existing.type === 'fixed_deposit') && existing.rate_percent !== null) {
    const purchaseMs = new Date(existing.purchase_date + 'T00:00:00Z').getTime();
    const daysHeld = Math.floor((Date.now() - purchaseMs) / 86_400_000);
    const expectedReturn = Math.round(
      existing.amount_pesewas * (existing.rate_percent / 100) * (daysHeld / 365)
    );
    finalValue = existing.amount_pesewas + expectedReturn;
  }

  await c.env.DB.prepare(
    `UPDATE investments
     SET is_matured = 1,
         current_value_pesewas = COALESCE(?, current_value_pesewas),
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(finalValue, investmentId).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, user_id, type, name, institution, amount_pesewas, rate_percent,
            purchase_date, maturity_date, current_value_pesewas, is_matured, notes,
            created_at, updated_at
     FROM investments WHERE id = ?`
  ).bind(investmentId).first<InvestmentRow>();

  return c.json({ data: computeReturns(updated!) });
});

// ─── DELETE /:id — delete an investment ──────────────────────────────────────

investments.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const investmentId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    `SELECT id FROM investments WHERE id = ? AND user_id = ?`
  ).bind(investmentId, userId).first();

  if (!existing) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Investment not found' } },
      404
    );
  }

  await c.env.DB.prepare(
    `DELETE FROM investments WHERE id = ?`
  ).bind(investmentId).run();

  return c.body(null, 204);
});

export { investments };
