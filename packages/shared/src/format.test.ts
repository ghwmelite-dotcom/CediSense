import { describe, it, expect } from 'vitest';
import { formatGHS, normalizePhone, toPesewas, toGHS, formatPesewas } from './format.js';

describe('formatGHS', () => {
  it('formats whole number', () => {
    expect(formatGHS(1000)).toBe('₵1,000.00');
  });

  it('formats decimal', () => {
    expect(formatGHS(1234.5)).toBe('₵1,234.50');
  });

  it('formats zero', () => {
    expect(formatGHS(0)).toBe('₵0.00');
  });
});

describe('normalizePhone', () => {
  it('normalizes spaced format', () => {
    expect(normalizePhone('024 123 4567')).toBe('0241234567');
  });

  it('normalizes dashed format', () => {
    expect(normalizePhone('024-123-4567')).toBe('0241234567');
  });

  it('normalizes +233 format', () => {
    expect(normalizePhone('+233241234567')).toBe('0241234567');
  });

  it('normalizes 233 format (no plus)', () => {
    expect(normalizePhone('233241234567')).toBe('0241234567');
  });

  it('passes through already normalized', () => {
    expect(normalizePhone('0241234567')).toBe('0241234567');
  });

  it('rejects invalid prefix', () => {
    expect(normalizePhone('0611234567')).toBeNull();
  });

  it('rejects too short', () => {
    expect(normalizePhone('024123456')).toBeNull();
  });

  it('rejects too long', () => {
    expect(normalizePhone('02412345678')).toBeNull();
  });
});

describe('toPesewas', () => {
  it('converts whole GHS to pesewas', () => {
    expect(toPesewas(10)).toBe(1000);
  });

  it('converts decimal GHS to pesewas', () => {
    expect(toPesewas(12.5)).toBe(1250);
  });

  it('rounds floating point correctly', () => {
    expect(toPesewas(0.1 + 0.2)).toBe(30);
  });

  it('converts zero', () => {
    expect(toPesewas(0)).toBe(0);
  });
});

describe('toGHS', () => {
  it('converts pesewas to GHS', () => {
    expect(toGHS(1000)).toBe(10);
  });

  it('converts partial pesewas', () => {
    expect(toGHS(1250)).toBe(12.5);
  });

  it('converts zero', () => {
    expect(toGHS(0)).toBe(0);
  });
});

describe('formatPesewas', () => {
  it('formats pesewas as cedis string', () => {
    expect(formatPesewas(100000)).toBe('₵1,000.00');
  });

  it('formats decimal pesewas', () => {
    expect(formatPesewas(123450)).toBe('₵1,234.50');
  });

  it('formats zero pesewas', () => {
    expect(formatPesewas(0)).toBe('₵0.00');
  });

  it('formats small amounts', () => {
    expect(formatPesewas(50)).toBe('₵0.50');
  });
});
