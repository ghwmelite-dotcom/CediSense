import { describe, it, expect } from 'vitest';
import { parseGhanaDate } from './parse-date';

describe('parseGhanaDate', () => {
  it('parses DD/MM/YYYY', () => { expect(parseGhanaDate('12/03/2026')).toBe('2026-03-12'); });
  it('parses DD-MM-YYYY', () => { expect(parseGhanaDate('12-03-2026')).toBe('2026-03-12'); });
  it('parses DD-Mon-YYYY', () => { expect(parseGhanaDate('12-Mar-2026')).toBe('2026-03-12'); expect(parseGhanaDate('05-Jan-2026')).toBe('2026-01-05'); });
  it('parses YYYY-MM-DD (ISO)', () => { expect(parseGhanaDate('2026-03-12')).toBe('2026-03-12'); });
  it('parses DD/MM/YY (2-digit year)', () => { expect(parseGhanaDate('12/03/26')).toBe('2026-03-12'); });
  it('returns fallback date for unparseable input', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(parseGhanaDate('not a date')).toBe(today);
    expect(parseGhanaDate('')).toBe(today);
  });
});
