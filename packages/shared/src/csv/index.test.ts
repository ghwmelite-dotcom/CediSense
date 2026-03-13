import { describe, it, expect } from 'vitest';
import { parseCSV, getCSVFormats } from './index.js';

describe('parseCSV', () => {
  it('parses GCB bank CSV with header', () => {
    const csv = `Date,Description,Debit,Credit,Reference,Balance\n12/03/2026,ATM WITHDRAWAL,200.00,,TXN001,1800.00\n12/03/2026,SALARY CREDIT,,5000.00,TXN002,6800.00`;
    const result = parseCSV(csv, 'gcb_bank');
    expect(result).toHaveLength(2);
    expect(result[0].amount_pesewas).toBe(20000);
    expect(result[0].type).toBe('debit');
    expect(result[0].reference).toBe('TXN001');
    expect(result[1].amount_pesewas).toBe(500000);
    expect(result[1].type).toBe('credit');
  });

  it('parses MTN MoMo CSV with single amount column', () => {
    const csv = `Date,Description,Amount,Reference,Balance\n12/03/2026,TRANSFER TO KWAME,-50.00,REF123,450.00\n12/03/2026,RECEIVED FROM AMA,100.00,REF456,550.00`;
    const result = parseCSV(csv, 'mtn_momo');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('debit');
    expect(result[0].amount_pesewas).toBe(5000);
    expect(result[1].type).toBe('credit');
  });

  it('throws on unknown format', () => {
    expect(() => parseCSV('data', 'unknown')).toThrow('Unknown CSV format');
  });

  it('returns empty array for empty CSV', () => {
    expect(parseCSV('', 'gcb_bank')).toEqual([]);
  });
});

describe('getCSVFormats', () => {
  it('returns all available formats', () => {
    const f = getCSVFormats();
    expect(f.length).toBeGreaterThanOrEqual(11);
  });
});
