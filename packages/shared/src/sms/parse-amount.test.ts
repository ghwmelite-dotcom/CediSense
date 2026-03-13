import { describe, it, expect } from 'vitest';
import { parseAmount } from './parse-amount';

describe('parseAmount', () => {
  it('parses plain number', () => expect(parseAmount('1234.56')).toBe(1234.56));
  it('parses with commas', () => expect(parseAmount('1,234.56')).toBe(1234.56));
  it('parses integer', () => expect(parseAmount('500')).toBe(500));
  it('returns 0 for invalid', () => expect(parseAmount('abc')).toBe(0));
});
