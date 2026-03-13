import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('CalBank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'CalBank Alert: Credit GHS 6,000.00. Account: XXX2345. Ref: CAL001. Bal: GHS 15,000.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('calbank');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(600000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('CAL001');
    expect(result!.balance_after_pesewas).toBe(1500000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'CalBank Alert: Debit GHS 1,000.00. Account: XXX2345. Ref: CAL002. Bal: GHS 14,000.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('calbank');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(100000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('CAL002');
    expect(result!.balance_after_pesewas).toBe(1400000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-CalBank SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
