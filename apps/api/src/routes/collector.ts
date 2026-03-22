import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  createCollectorProfileSchema,
  addCollectorClientSchema,
  recordDepositSchema,
  updateCollectorClientSchema,
} from '@cedisense/shared';
import { generateId } from '../lib/db.js';

const collector = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// ─── Row types ───────────────────────────────────────────────────────────────

interface CollectorProfileRow {
  user_id: string;
  business_name: string;
  market_area: string | null;
  commission_days: number;
  is_active: number;
  total_clients: number;
  created_at: string;
}

interface CollectorClientRow {
  id: string;
  collector_id: string;
  client_name: string;
  client_phone: string | null;
  daily_amount_pesewas: number;
  cycle_days: number;
  current_cycle_start: string;
  is_active: number;
  created_at: string;
}

interface CollectorDepositRow {
  id: string;
  client_id: string;
  amount_pesewas: number;
  deposit_date: string;
  recorded_by: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapProfile(row: CollectorProfileRow) {
  return {
    ...row,
    is_active: row.is_active === 1,
  };
}

// ─── POST /profile — Become a collector ──────────────────────────────────────

collector.post('/profile', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createCollectorProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  // Check if profile already exists
  const existing = await c.env.DB.prepare(
    'SELECT user_id FROM collector_profiles WHERE user_id = ?'
  ).bind(userId).first();
  if (existing) {
    return c.json({ error: { code: 'ALREADY_EXISTS', message: 'You already have a collector profile' } }, 409);
  }

  const { business_name, market_area, commission_days } = parsed.data;
  await c.env.DB.prepare(
    `INSERT INTO collector_profiles (user_id, business_name, market_area, commission_days)
     VALUES (?, ?, ?, ?)`
  ).bind(userId, business_name, market_area ?? null, commission_days).run();

  const row = await c.env.DB.prepare(
    'SELECT * FROM collector_profiles WHERE user_id = ?'
  ).bind(userId).first<CollectorProfileRow>();

  if (!row) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: mapProfile(row) }, 201);
});

// ─── GET /dashboard — Full collector dashboard ───────────────────────────────

collector.get('/dashboard', async (c) => {
  const userId = c.get('userId');

  const profileRow = await c.env.DB.prepare(
    'SELECT * FROM collector_profiles WHERE user_id = ?'
  ).bind(userId).first<CollectorProfileRow>();

  if (!profileRow) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No collector profile found' } }, 404);
  }

  const today = todayStr();
  const profile = mapProfile(profileRow);

  // Get all active clients with cycle stats
  const clientRows = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE collector_id = ? AND is_active = 1 ORDER BY client_name'
  ).bind(userId).all<CollectorClientRow>();

  // Batch fetch: all cycle deposit stats grouped by client_id
  const clientList = clientRows.results ?? [];
  const cycleStatsMap = new Map<string, { cnt: number; total: number }>();
  const todayDepositSet = new Set<string>();

  if (clientList.length > 0) {
    // Build a single query for all clients' cycle deposits using CASE/GROUP BY
    // We need per-client cycle starts, so use a UNION approach via batch
    const cycleQueries = clientList.map((client) =>
      c.env.DB.prepare(
        `SELECT ? AS client_id, COUNT(*) AS cnt, COALESCE(SUM(amount_pesewas), 0) AS total
         FROM collector_deposits
         WHERE client_id = ? AND deposit_date >= ?`
      ).bind(client.id, client.id, client.current_cycle_start)
    );

    // Single query for all today's deposits
    const clientIds = clientList.map((c) => c.id);
    const todayPlaceholders = clientIds.map(() => '?').join(', ');
    const todayQuery = c.env.DB.prepare(
      `SELECT DISTINCT client_id FROM collector_deposits
       WHERE client_id IN (${todayPlaceholders}) AND deposit_date = ?`
    ).bind(...clientIds, today);

    // Execute all in a single batch (one round-trip)
    const batchResults = await c.env.DB.batch([...cycleQueries, todayQuery]);

    // Parse cycle stats
    for (let i = 0; i < clientList.length; i++) {
      const row = (batchResults[i].results as Array<{ client_id: string; cnt: number; total: number }>)?.[0];
      if (row) {
        cycleStatsMap.set(row.client_id, { cnt: row.cnt, total: row.total });
      }
    }

    // Parse today's deposits
    const todayResults = batchResults[clientList.length].results as Array<{ client_id: string }>;
    for (const row of todayResults) {
      todayDepositSet.add(row.client_id);
    }
  }

  const clients = clientList.map((client) => {
    const stats = cycleStatsMap.get(client.id);

    // Calculate days remaining
    const cycleEnd = new Date(client.current_cycle_start);
    cycleEnd.setDate(cycleEnd.getDate() + client.cycle_days);
    const now = new Date(today);
    const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id: client.id,
      collector_id: client.collector_id,
      client_name: client.client_name,
      client_phone: client.client_phone,
      daily_amount_pesewas: client.daily_amount_pesewas,
      cycle_days: client.cycle_days,
      current_cycle_start: client.current_cycle_start,
      is_active: client.is_active === 1,
      deposits_this_cycle: stats?.cnt ?? 0,
      total_deposited_this_cycle_pesewas: stats?.total ?? 0,
      days_remaining: daysRemaining,
      deposited_today: todayDepositSet.has(client.id),
    };
  });

  // Today's collection stats
  const todayStats = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(d.amount_pesewas), 0) as total
     FROM collector_deposits d
     JOIN collector_clients cl ON d.client_id = cl.id
     WHERE cl.collector_id = ? AND d.deposit_date = ?`
  ).bind(userId, today).first<{ cnt: number; total: number }>();

  // Cycle total across all clients
  const cycleTotal = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(d.amount_pesewas), 0) as total
     FROM collector_deposits d
     JOIN collector_clients cl ON d.client_id = cl.id
     WHERE cl.collector_id = ? AND cl.is_active = 1
       AND d.deposit_date >= cl.current_cycle_start`
  ).bind(userId).first<{ total: number }>();

  return c.json({
    data: {
      profile,
      clients,
      today_collections: todayStats?.cnt ?? 0,
      today_amount_pesewas: todayStats?.total ?? 0,
      cycle_total_pesewas: cycleTotal?.total ?? 0,
    },
  });
});

// ─── GET /clients — List all clients ─────────────────────────────────────────

collector.get('/clients', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const rows = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE collector_id = ? ORDER BY client_name LIMIT ? OFFSET ?'
  ).bind(userId, limit, offset).all<CollectorClientRow>();

  const clients = (rows.results ?? []).map((r) => ({
    ...r,
    is_active: r.is_active === 1,
  }));

  return c.json({ data: clients, meta: { limit, offset } });
});

// ─── POST /clients — Add a client ───────────────────────────────────────────

collector.post('/clients', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = addCollectorClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  // Verify collector profile exists
  const profile = await c.env.DB.prepare(
    'SELECT user_id FROM collector_profiles WHERE user_id = ?'
  ).bind(userId).first();
  if (!profile) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Create a collector profile first' } }, 404);
  }

  const { client_name, client_phone, daily_amount_pesewas, cycle_days } = parsed.data;

  // Check for duplicate phone before INSERT (NULL phones are allowed to coexist)
  if (client_phone) {
    const existingPhone = await c.env.DB.prepare(
      'SELECT id FROM collector_clients WHERE collector_id = ? AND client_phone = ?'
    ).bind(userId, client_phone).first();
    if (existingPhone) {
      return c.json({ error: { code: 'CONFLICT', message: 'A client with this phone number already exists' } }, 409);
    }
  }

  const id = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO collector_clients (id, collector_id, client_name, client_phone, daily_amount_pesewas, cycle_days)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, client_name, client_phone ?? null, daily_amount_pesewas, cycle_days).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'A client with this phone number already exists' } }, 409);
    }
    throw err;
  }

  // Update total_clients count
  await c.env.DB.prepare(
    `UPDATE collector_profiles SET total_clients = (
       SELECT COUNT(*) FROM collector_clients WHERE collector_id = ? AND is_active = 1
     ) WHERE user_id = ?`
  ).bind(userId, userId).run();

  const row = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE id = ?'
  ).bind(id).first<CollectorClientRow>();

  if (!row) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: { ...row, is_active: true } }, 201);
});

// ─── PUT /clients/:id — Update client ────────────────────────────────────────

collector.put('/clients/:id', async (c) => {
  const userId = c.get('userId');
  const clientId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCollectorClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  // Verify ownership
  const client = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE id = ? AND collector_id = ?'
  ).bind(clientId, userId).first<CollectorClientRow>();
  if (!client) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  const data = parsed.data;

  if (data.client_name !== undefined) { updates.push('client_name = ?'); values.push(data.client_name); }
  if (data.client_phone !== undefined) { updates.push('client_phone = ?'); values.push(data.client_phone); }
  if (data.daily_amount_pesewas !== undefined) { updates.push('daily_amount_pesewas = ?'); values.push(data.daily_amount_pesewas); }
  if (data.cycle_days !== undefined) { updates.push('cycle_days = ?'); values.push(data.cycle_days); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

  if (updates.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400);
  }

  values.push(clientId);
  await c.env.DB.prepare(
    `UPDATE collector_clients SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  // Update total_clients count
  await c.env.DB.prepare(
    `UPDATE collector_profiles SET total_clients = (
       SELECT COUNT(*) FROM collector_clients WHERE collector_id = ? AND is_active = 1
     ) WHERE user_id = ?`
  ).bind(userId, userId).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE id = ?'
  ).bind(clientId).first<CollectorClientRow>();

  if (!updated) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } }, 500);
  }

  return c.json({ data: { ...updated, is_active: updated.is_active === 1 } });
});

// ─── DELETE /clients/:id — Remove client ─────────────────────────────────────

collector.delete('/clients/:id', async (c) => {
  const userId = c.get('userId');
  const clientId = c.req.param('id');

  const client = await c.env.DB.prepare(
    'SELECT id FROM collector_clients WHERE id = ? AND collector_id = ?'
  ).bind(clientId, userId).first();
  if (!client) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM collector_clients WHERE id = ?').bind(clientId).run();

  // Update total_clients count
  await c.env.DB.prepare(
    `UPDATE collector_profiles SET total_clients = (
       SELECT COUNT(*) FROM collector_clients WHERE collector_id = ? AND is_active = 1
     ) WHERE user_id = ?`
  ).bind(userId, userId).run();

  return c.body(null, 204);
});

// ─── POST /clients/:id/deposit — Record today's deposit ─────────────────────

collector.post('/clients/:id/deposit', async (c) => {
  const userId = c.get('userId');
  const clientId = c.req.param('id');
  const body = await c.req.json();
  const parsed = recordDepositSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }, 400);
  }

  // Verify ownership
  const client = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE id = ? AND collector_id = ?'
  ).bind(clientId, userId).first<CollectorClientRow>();
  if (!client) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
  }

  const depositDate = parsed.data.deposit_date ?? todayStr();
  const id = generateId();

  try {
    await c.env.DB.prepare(
      `INSERT INTO collector_deposits (id, client_id, amount_pesewas, deposit_date, recorded_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, clientId, parsed.data.amount_pesewas, depositDate, userId).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return c.json({ error: { code: 'CONFLICT', message: 'Deposit already recorded for this date' } }, 409);
    }
    throw err;
  }

  const row = await c.env.DB.prepare(
    'SELECT id, client_id, amount_pesewas, deposit_date FROM collector_deposits WHERE id = ?'
  ).bind(id).first<{ id: string; client_id: string; amount_pesewas: number; deposit_date: string }>();

  return c.json({ data: row }, 201);
});

// ─── GET /clients/:id/deposits — Deposit history for a client ────────────────

collector.get('/clients/:id/deposits', async (c) => {
  const userId = c.get('userId');
  const clientId = c.req.param('id');

  // Verify ownership
  const client = await c.env.DB.prepare(
    'SELECT id FROM collector_clients WHERE id = ? AND collector_id = ?'
  ).bind(clientId, userId).first();
  if (!client) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, client_id, amount_pesewas, deposit_date
     FROM collector_deposits
     WHERE client_id = ?
     ORDER BY deposit_date DESC
     LIMIT 100`
  ).bind(clientId).all<{ id: string; client_id: string; amount_pesewas: number; deposit_date: string }>();

  return c.json({ data: rows.results ?? [] });
});

// ─── POST /clients/:id/payout — End-of-cycle payout ─────────────────────────

collector.post('/clients/:id/payout', async (c) => {
  const userId = c.get('userId');
  const clientId = c.req.param('id');

  // Verify ownership
  const client = await c.env.DB.prepare(
    'SELECT * FROM collector_clients WHERE id = ? AND collector_id = ?'
  ).bind(clientId, userId).first<CollectorClientRow>();
  if (!client) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
  }

  // Get collector profile for commission_days
  const profile = await c.env.DB.prepare(
    'SELECT commission_days FROM collector_profiles WHERE user_id = ?'
  ).bind(userId).first<{ commission_days: number }>();
  if (!profile) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Collector profile not found' } }, 404);
  }

  const cycleStart = client.current_cycle_start;
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + client.cycle_days);
  const cycleEndStr = cycleEnd.toISOString().slice(0, 10);

  // Calculate total deposited in this cycle
  const depositStats = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_pesewas), 0) as total
     FROM collector_deposits
     WHERE client_id = ? AND deposit_date >= ?`
  ).bind(clientId, cycleStart).first<{ total: number }>();

  const totalDeposited = depositStats?.total ?? 0;
  if (totalDeposited === 0) {
    return c.json({ error: { code: 'NO_DEPOSITS', message: 'No deposits recorded this cycle' } }, 400);
  }

  // Commission = daily_amount * commission_days
  const commissionPesewas = client.daily_amount_pesewas * profile.commission_days;
  const payoutPesewas = Math.max(0, totalDeposited - commissionPesewas);

  const payoutId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO collector_payouts (id, client_id, cycle_start, cycle_end, total_deposited_pesewas, commission_pesewas, payout_pesewas)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(payoutId, clientId, cycleStart, cycleEndStr, totalDeposited, commissionPesewas, payoutPesewas).run();

  // Start a new cycle
  const newCycleStart = todayStr();
  await c.env.DB.prepare(
    'UPDATE collector_clients SET current_cycle_start = ? WHERE id = ?'
  ).bind(newCycleStart, clientId).run();

  return c.json({
    data: {
      id: payoutId,
      client_id: clientId,
      cycle_start: cycleStart,
      cycle_end: cycleEndStr,
      total_deposited_pesewas: totalDeposited,
      commission_pesewas: commissionPesewas,
      payout_pesewas: payoutPesewas,
    },
  }, 201);
});

export { collector };
