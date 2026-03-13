import { describe, it, expect } from 'vitest';
import { formatGHS, normalizePhone } from './format.js';

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
