import { describe, it, expect } from 'vitest';
import { applyRules, type CategorizedTransaction } from './categorize.js';
import type { RawTransaction, CategoryRule } from '@cedisense/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRaw(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    type: 'debit',
    amount_pesewas: 10000,
    fee_pesewas: 0,
    description: 'AIRTEL PAYMENT',
    raw_text: 'raw',
    counterparty: 'MTN MoMo',
    reference: 'REF001',
    balance_after_pesewas: null,
    source: 'csv_import',
    transaction_date: '2026-03-12',
    provider: 'mtn_momo',
    ...overrides,
  };
}

function makeRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    match_type: 'contains',
    match_field: 'description',
    match_value: 'airtel',
    category_id: 'cat-telecom',
    priority: 10,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyRules', () => {
  it('matches a "contains" rule against the description field (case-insensitive)', () => {
    const txns = [makeRaw({ description: 'AIRTEL PAYMENT' })];
    const rules = [makeRule({ match_type: 'contains', match_value: 'airtel', category_id: 'cat-telecom' })];

    const result = applyRules(txns, rules);

    expect(result).toHaveLength(1);
    expect(result[0].category_id).toBe('cat-telecom');
    expect(result[0].categorized_by).toBe('rule');
  });

  it('matches an "exact" rule case-insensitively', () => {
    const txns = [makeRaw({ counterparty: 'GCB Bank' })];
    const rules = [
      makeRule({
        match_type: 'exact',
        match_field: 'counterparty',
        match_value: 'gcb bank',
        category_id: 'cat-banking',
      }),
    ];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBe('cat-banking');
    expect(result[0].categorized_by).toBe('rule');
  });

  it('matches a "regex" rule', () => {
    const txns = [makeRaw({ description: 'VODAFONE CASH TRANSFER' })];
    const rules = [
      makeRule({
        match_type: 'regex',
        match_field: 'description',
        match_value: '^vodafone',
        category_id: 'cat-momo',
      }),
    ];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBe('cat-momo');
    expect(result[0].categorized_by).toBe('rule');
  });

  it('returns uncategorized when no rule matches', () => {
    const txns = [makeRaw({ description: 'UNKNOWN VENDOR', counterparty: 'XYZ Corp' })];
    const rules = [makeRule({ match_value: 'airtel' })];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBeNull();
    expect(result[0].categorized_by).toBeNull();
  });

  it('respects priority ordering — highest priority rule wins', () => {
    const txns = [makeRaw({ description: 'MTN TRANSFER' })];
    const rules = [
      makeRule({ priority: 5,  match_value: 'mtn', category_id: 'cat-low',  match_type: 'contains', match_field: 'description' }),
      makeRule({ priority: 20, match_value: 'mtn', category_id: 'cat-high', match_type: 'contains', match_field: 'description', id: 'rule-2' }),
    ];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBe('cat-high');
  });

  it('matches against the "provider" field', () => {
    const txns = [makeRaw({ provider: 'mtn_momo' })];
    const rules = [
      makeRule({
        match_field: 'provider',
        match_type: 'exact',
        match_value: 'mtn_momo',
        category_id: 'cat-provider',
      }),
    ];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBe('cat-provider');
    expect(result[0].categorized_by).toBe('rule');
  });

  it('handles an empty rules array — all transactions uncategorized', () => {
    const txns = [makeRaw(), makeRaw({ description: 'SALARY' })];
    const result = applyRules(txns, []);

    result.forEach(t => {
      expect(t.category_id).toBeNull();
      expect(t.categorized_by).toBeNull();
    });
  });

  it('handles an empty transactions array', () => {
    const result = applyRules([], [makeRule()]);
    expect(result).toHaveLength(0);
  });

  it('skips rule when the matched field is null on the transaction', () => {
    const txns = [makeRaw({ counterparty: null })];
    const rules = [makeRule({ match_field: 'counterparty', match_value: 'mtn' })];

    const result = applyRules(txns, rules);

    expect(result[0].category_id).toBeNull();
  });
});
