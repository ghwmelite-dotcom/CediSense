import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Zenith Bank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'Zenith Bank: GHS 3,500.00 has been credited to your account XXX0123. Ref: ZEN001. Balance: GHS 9,000.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('zenith');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(350000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ZEN001');
    expect(result!.balance_after_pesewas).toBe(900000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'Zenith Bank: GHS 700.00 has been debited from your account XXX0123. Ref: ZEN002. Balance: GHS 8,300.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('zenith');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(70000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ZEN002');
    expect(result!.balance_after_pesewas).toBe(830000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Zenith SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
