import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('UBA SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'UBA: Acct XXX6789 credited GHS 2,500.00. Ref: UBA001. Bal: GHS 7,500.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('uba');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(250000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('UBA001');
    expect(result!.balance_after_pesewas).toBe(750000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'UBA: Acct XXX6789 debited GHS 350.00. Ref: UBA002. Bal: GHS 7,150.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('uba');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(35000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('UBA002');
    expect(result!.balance_after_pesewas).toBe(715000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-UBA SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
