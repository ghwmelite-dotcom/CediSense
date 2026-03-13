import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Stanbic Bank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'Stanbic: Your account XXX3456 credited GHS 4,000.00. Reference: STB001. Balance: GHS 10,000.00. 2026-03-12',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('stanbic');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(400000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('STB001');
    expect(result!.balance_after_pesewas).toBe(1000000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'Stanbic: Your account XXX3456 debited GHS 800.00. Reference: STB002. Balance: GHS 9,200.00. 2026-03-12',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('stanbic');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(80000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('STB002');
    expect(result!.balance_after_pesewas).toBe(920000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Stanbic SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
