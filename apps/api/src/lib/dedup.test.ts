import { describe, it, expect } from 'vitest';
import { findDuplicates } from './dedup.js';
import type { RawTransaction, Transaction } from '@cedisense/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    type: 'debit',
    amount_pesewas: 10000,
    fee_pesewas: 0,
    description: 'Test',
    raw_text: 'raw',
    counterparty: 'Kwame',
    reference: 'REF001',
    balance_after_pesewas: null,
    source: 'csv_import',
    transaction_date: '2026-03-12',
    ...overrides,
  };
}

function makeExisting(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: null,
    type: 'debit',
    amount_pesewas: 10000,
    fee_pesewas: 0,
    description: 'Test',
    raw_text: 'raw',
    counterparty: 'Kwame',
    reference: 'REF001',
    source: 'csv_import',
    categorized_by: null,
    transaction_date: '2026-03-12',
    import_batch_id: null,
    created_at: '2026-03-12T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('findDuplicates', () => {
  it('detects a reference match as duplicate', () => {
    const incoming = [makeRaw({ reference: 'REF001' })];
    const existing = [makeExisting({ reference: 'REF001' })];

    const { clean, duplicates } = findDuplicates(incoming, existing);

    expect(clean).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].transaction.reference).toBe('REF001');
    expect(duplicates[0].existing.id).toBe('txn-1');
  });

  it('detects a fuzzy match (null reference) as duplicate', () => {
    const incoming = [
      makeRaw({
        reference: null,
        amount_pesewas: 5000,
        transaction_date: '2026-03-10',
        counterparty: 'Ama',
      }),
    ];
    const existing = [
      makeExisting({
        reference: null,
        amount_pesewas: 5000,
        transaction_date: '2026-03-10',
        counterparty: 'Ama',
      }),
    ];

    const { clean, duplicates } = findDuplicates(incoming, existing);

    expect(clean).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  it('passes through non-duplicate transactions in clean', () => {
    const incoming = [
      makeRaw({ reference: 'REF999', amount_pesewas: 99900 }),
    ];
    const existing = [makeExisting({ reference: 'REF001' })];

    const { clean, duplicates } = findDuplicates(incoming, existing);

    expect(clean).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  it('handles empty incoming array', () => {
    const { clean, duplicates } = findDuplicates([], [makeExisting()]);
    expect(clean).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
  });

  it('handles empty existing array', () => {
    const { clean, duplicates } = findDuplicates([makeRaw()], []);
    expect(clean).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  it('does NOT fuzzy-match when incoming has a reference (even if amounts match)', () => {
    // Incoming has a reference that is NOT in existing, but amounts/date/counterparty match.
    // It should not be flagged as a duplicate via fuzzy matching.
    const incoming = [
      makeRaw({
        reference: 'NEW_REF',
        amount_pesewas: 5000,
        transaction_date: '2026-03-10',
        counterparty: 'Ama',
      }),
    ];
    const existing = [
      makeExisting({
        reference: null,
        amount_pesewas: 5000,
        transaction_date: '2026-03-10',
        counterparty: 'Ama',
      }),
    ];

    const { clean, duplicates } = findDuplicates(incoming, existing);

    // Has a reference that doesn't match → not a ref duplicate.
    // Has a reference → skip fuzzy → should be clean.
    expect(clean).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  it('handles mixed batch of duplicates and clean transactions', () => {
    const incoming = [
      makeRaw({ reference: 'REF001' }),           // duplicate by reference
      makeRaw({ reference: 'REF002' }),           // clean
      makeRaw({ reference: null, amount_pesewas: 5000, counterparty: 'Ama', transaction_date: '2026-03-10' }), // fuzzy dup
    ];
    const existing = [
      makeExisting({ reference: 'REF001' }),
      makeExisting({ id: 'txn-2', reference: null, amount_pesewas: 5000, counterparty: 'Ama', transaction_date: '2026-03-10' }),
    ];

    const { clean, duplicates } = findDuplicates(incoming, existing);

    expect(clean).toHaveLength(1);
    expect(clean[0].reference).toBe('REF002');
    expect(duplicates).toHaveLength(2);
  });
});
