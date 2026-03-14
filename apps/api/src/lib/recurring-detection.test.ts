import { describe, it, expect } from 'vitest';
import { detectRecurringPatterns, computeNextDueDate, classifyFrequency } from './recurring-detection.js';
import type { TransactionForDetection } from './recurring-detection.js';

function makeTxn(counterparty: string, amount: number, date: string, categoryId?: string): TransactionForDetection {
  return { counterparty, amount_pesewas: amount, category_id: categoryId ?? null, transaction_date: date };
}

describe('classifyFrequency', () => {
  it('classifies weekly (5-9 days)', () => {
    expect(classifyFrequency(7)).toBe('weekly');
    expect(classifyFrequency(5)).toBe('weekly');
    expect(classifyFrequency(9)).toBe('weekly');
  });

  it('classifies biweekly (12-16 days)', () => {
    expect(classifyFrequency(14)).toBe('biweekly');
    expect(classifyFrequency(12)).toBe('biweekly');
    expect(classifyFrequency(16)).toBe('biweekly');
  });

  it('classifies monthly (25-35 days)', () => {
    expect(classifyFrequency(30)).toBe('monthly');
    expect(classifyFrequency(25)).toBe('monthly');
    expect(classifyFrequency(35)).toBe('monthly');
  });

  it('returns null for irregular intervals', () => {
    expect(classifyFrequency(3)).toBeNull();
    expect(classifyFrequency(10)).toBeNull();
    expect(classifyFrequency(20)).toBeNull();
    expect(classifyFrequency(40)).toBeNull();
  });
});

describe('computeNextDueDate', () => {
  it('forward-rolls monthly past today', () => {
    const result = computeNextDueDate('2025-01-15', 'monthly');
    const today = new Date().toISOString().slice(0, 10);
    expect(result > today).toBe(true);
  });

  it('forward-rolls weekly past today', () => {
    const result = computeNextDueDate('2025-01-01', 'weekly');
    const today = new Date().toISOString().slice(0, 10);
    expect(result > today).toBe(true);
  });

  it('keeps future dates as-is (one advance)', () => {
    const farFuture = '2099-01-01';
    const result = computeNextDueDate(farFuture, 'monthly');
    expect(result).toBe('2099-02-01');
  });
});

describe('detectRecurringPatterns', () => {
  it('detects monthly pattern', () => {
    const txns = [
      makeTxn('ECG Prepaid', 20000, '2025-10-15', 'cat-util'),
      makeTxn('ECG Prepaid', 21000, '2025-11-14', 'cat-util'),
      makeTxn('ECG Prepaid', 19500, '2025-12-15', 'cat-util'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].counterparty).toBe('ECG Prepaid');
    expect(result[0].frequency).toBe('monthly');
    expect(result[0].occurrence_count).toBe(3);
    expect(result[0].category_id).toBe('cat-util');
  });

  it('detects weekly pattern', () => {
    const txns = [
      makeTxn('Trotro', 500, '2025-12-01'),
      makeTxn('Trotro', 500, '2025-12-08'),
      makeTxn('Trotro', 500, '2025-12-15'),
      makeTxn('Trotro', 500, '2025-12-22'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].frequency).toBe('weekly');
  });

  it('skips irregular intervals', () => {
    const txns = [
      makeTxn('Random Shop', 5000, '2025-10-01'),
      makeTxn('Random Shop', 5000, '2025-10-20'),
      makeTxn('Random Shop', 5000, '2025-12-05'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(0);
  });

  it('filters amount outliers', () => {
    const txns = [
      makeTxn('Vodafone', 5000, '2025-10-01'),
      makeTxn('Vodafone', 5200, '2025-10-31'),
      makeTxn('Vodafone', 50000, '2025-11-15'), // outlier
      makeTxn('Vodafone', 4800, '2025-11-30'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].occurrence_count).toBe(3); // outlier filtered
  });

  it('skips confirmed counterparties', () => {
    const txns = [
      makeTxn('ECG', 20000, '2025-10-15'),
      makeTxn('ECG', 20000, '2025-11-15'),
      makeTxn('ECG', 20000, '2025-12-15'),
    ];
    const result = detectRecurringPatterns(txns, new Set(['ecg']), new Set());
    expect(result).toHaveLength(0);
  });

  it('skips dismissed counterparties', () => {
    const txns = [
      makeTxn('ECG', 20000, '2025-10-15'),
      makeTxn('ECG', 20000, '2025-11-15'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set(['ecg']));
    expect(result).toHaveLength(0);
  });

  it('skips groups with only 1 transaction', () => {
    const txns = [makeTxn('OneTime', 10000, '2025-12-01')];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(0);
  });

  it('handles case-insensitive counterparty grouping', () => {
    const txns = [
      makeTxn('ECG Prepaid', 20000, '2025-10-15'),
      makeTxn('ecg prepaid', 20000, '2025-11-15'),
      makeTxn('ECG PREPAID', 20000, '2025-12-15'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(1);
  });

  it('skips null counterparties', () => {
    const txns = [
      makeTxn(null as unknown as string, 5000, '2025-10-01'),
      makeTxn(null as unknown as string, 5000, '2025-11-01'),
    ];
    const result = detectRecurringPatterns(txns, new Set(), new Set());
    expect(result).toHaveLength(0);
  });
});
