import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  importSmsSchema,
  importCsvSchema,
  importConfirmSchema,
  parseSMS,
  parseCSV,
  type RawTransaction,
  type Transaction,
  type CategoryRule,
  type Category,
} from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { findDuplicates } from '../lib/dedup.js';
import { applyRules, categorizeWithAI, type CategorizedTransaction } from '../lib/categorize.js';

const importRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Auth middleware applied in index.ts — not duplicated here

// KV key prefix and TTL for pending import batches
const KV_PREFIX = 'import:';
const KV_TTL_SECONDS = 15 * 60; // 15 minutes

interface PendingImport {
  userId: string;
  accountId: string;
  parsed: CategorizedTransaction[];
  duplicates: Array<{ transaction: RawTransaction; existing: Transaction }>;
}

/**
 * Shared pipeline: dedup against existing account transactions,
 * apply category rules, then attempt AI categorization for uncategorized items.
 */
async function processImport(
  env: Env,
  userId: string,
  accountId: string,
  rawTransactions: RawTransaction[],
): Promise<{
  batchId: string;
  parsed: CategorizedTransaction[];
  duplicates: Array<{ transaction: RawTransaction; existing: Transaction }>;
}> {
  // Load existing transactions for this account (for dedup)
  const { results: existingRows } = await env.DB.prepare(
    'SELECT * FROM transactions WHERE account_id = ? AND user_id = ?'
  ).bind(accountId, userId).all<Transaction>();

  const { clean, duplicates } = findDuplicates(rawTransactions, existingRows);

  // Load user's category rules
  const { results: ruleRows } = await env.DB.prepare(
    'SELECT * FROM category_rules WHERE user_id = ? ORDER BY priority DESC'
  ).bind(userId).all<CategoryRule>();

  // Load system categories for AI categorization
  const { results: categoryRows } = await env.DB.prepare(
    "SELECT * FROM categories WHERE user_id IS NULL"
  ).bind().all<Category>();

  // Apply rules first, then AI for uncategorized
  const afterRules = applyRules(clean, ruleRows as CategoryRule[]);
  const categorized = await categorizeWithAI(afterRules, categoryRows as Category[], env.AI);

  const batchId = generateId();

  // Store in KV with 15-minute TTL
  const pending: PendingImport = { userId, accountId, parsed: categorized, duplicates };
  await env.KV.put(`${KV_PREFIX}${batchId}`, JSON.stringify(pending), {
    expirationTtl: KV_TTL_SECONDS,
  });

  return { batchId, parsed: categorized, duplicates };
}

// POST /api/v1/import/sms
importRoutes.post('/sms', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importSmsSchema.safeParse(body);

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

  // Parse each SMS message server-side
  const rawTransactions: RawTransaction[] = [];
  for (const msg of data.messages) {
    const result = parseSMS(msg.body);
    if (result) {
      // Use the sender timestamp if parseSMS did not extract a date
      rawTransactions.push({
        ...result,
        account_id: data.account_id,
        transaction_date: result.transaction_date || msg.timestamp.slice(0, 10),
      });
    }
  }

  const { batchId, parsed: categorized, duplicates } = await processImport(
    c.env,
    userId,
    data.account_id,
    rawTransactions,
  );

  return c.json({
    data: {
      import_id: batchId,
      parsed: categorized,
      duplicates,
      total_received: data.messages.length,
      total_parsed: rawTransactions.length,
    },
  }, 200);
});

// POST /api/v1/import/csv
importRoutes.post('/csv', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importCsvSchema.safeParse(body);

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

  let rawTransactions: RawTransaction[];
  try {
    rawTransactions = parseCSV(data.csv_data, data.format).map(t => ({
      ...t,
      account_id: data.account_id,
    }));
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'PARSE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to parse CSV',
        },
      },
      400
    );
  }

  const { batchId, parsed: categorized, duplicates } = await processImport(
    c.env,
    userId,
    data.account_id,
    rawTransactions,
  );

  return c.json({
    data: {
      import_id: batchId,
      parsed: categorized,
      duplicates,
      total_rows: rawTransactions.length,
    },
  }, 200);
});

// POST /api/v1/import/confirm
importRoutes.post('/confirm', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = importConfirmSchema.safeParse(body);

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

  // Retrieve pending import from KV
  const raw = await c.env.KV.get(`${KV_PREFIX}${data.batch_id}`);
  if (!raw) {
    return c.json(
      { error: { code: 'IMPORT_EXPIRED', message: 'Import session not found or expired' } },
      404
    );
  }

  const pending = JSON.parse(raw) as PendingImport;

  // Verify this import belongs to the authenticated user
  if (pending.userId !== userId) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Import session not found or expired' } },
      404
    );
  }

  // Verify account ownership
  const account = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(pending.accountId, userId).first();

  if (!account) {
    return c.json(
      { error: { code: 'INVALID_ACCOUNT', message: 'Account not found or not accessible' } },
      400
    );
  }

  // Apply any per-transaction overrides before inserting
  const overrideMap = new Map<number, { category_id?: string; description?: string }>();
  for (const override of data.overrides ?? []) {
    overrideMap.set(override.index, override);
  }

  // All parsed transactions are confirmed unless overridden
  const toInsert = pending.parsed.map((txn, idx) => {
    const override = overrideMap.get(idx);
    return {
      ...txn,
      category_id: override?.category_id !== undefined ? override.category_id : txn.category_id,
      description: override?.description !== undefined ? override.description : txn.description,
    };
  });

  const importBatchId = generateId();
  let insertedCount = 0;

  for (const txn of toInsert) {
    const id = generateId();

    try {
      await c.env.DB.prepare(
        `INSERT INTO transactions (
           id, user_id, account_id, category_id, type, amount_pesewas, fee_pesewas,
           description, raw_text, counterparty, reference, source, categorized_by,
           transaction_date, import_batch_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        userId,
        pending.accountId,
        txn.category_id ?? null,
        txn.type,
        txn.amount_pesewas,
        txn.fee_pesewas,
        txn.description ?? null,
        txn.raw_text ?? null,
        txn.counterparty ?? null,
        txn.reference ?? null,
        txn.source,
        txn.categorized_by ?? null,
        txn.transaction_date,
        importBatchId,
      ).run();

      insertedCount++;
    } catch {
      // Skip duplicate key violations silently — dedup catches most, but race conditions are possible
    }
  }

  // Clean up KV after successful confirm
  await c.env.KV.delete(`${KV_PREFIX}${data.batch_id}`);

  return c.json({
    data: {
      import_batch_id: importBatchId,
      inserted: insertedCount,
      total: toInsert.length,
    },
  }, 201);
});

export { importRoutes };
