import type { RawTransaction, Transaction } from '@cedisense/shared';

interface DedupResult {
  clean: RawTransaction[];
  duplicates: Array<{ transaction: RawTransaction; existing: Transaction }>;
}

/**
 * Identify duplicate incoming transactions against a set of existing ones.
 *
 * Deduplication strategy (applied in order):
 * 1. Reference match — if both sides have a reference, compare directly.
 * 2. Fuzzy match — for transactions without a reference, match on
 *    `amount_pesewas | transaction_date | counterparty`.
 *
 * Transactions that are not duplicates are returned in `clean`.
 */
export function findDuplicates(
  incoming: RawTransaction[],
  existing: Transaction[],
): DedupResult {
  const refSet = new Set<string>();
  const fuzzySet = new Set<string>();
  const refMap = new Map<string, Transaction>();
  const fuzzyMap = new Map<string, Transaction>();

  for (const txn of existing) {
    if (txn.reference) {
      refSet.add(txn.reference);
      refMap.set(txn.reference, txn);
    }
    const fuzzyKey = `${txn.amount_pesewas}|${txn.transaction_date}|${txn.counterparty ?? ''}`;
    fuzzySet.add(fuzzyKey);
    fuzzyMap.set(fuzzyKey, txn);
  }

  const clean: RawTransaction[] = [];
  const duplicates: DedupResult['duplicates'] = [];

  for (const raw of incoming) {
    // 1. Reference-based dedup
    if (raw.reference && refSet.has(raw.reference)) {
      duplicates.push({ transaction: raw, existing: refMap.get(raw.reference)! });
      continue;
    }

    // 2. Fuzzy dedup (only for transactions without a reference)
    if (!raw.reference) {
      const fuzzyKey = `${raw.amount_pesewas}|${raw.transaction_date}|${raw.counterparty ?? ''}`;
      if (fuzzySet.has(fuzzyKey)) {
        duplicates.push({ transaction: raw, existing: fuzzyMap.get(fuzzyKey)! });
        continue;
      }
    }

    clean.push(raw);
  }

  return { clean, duplicates };
}
