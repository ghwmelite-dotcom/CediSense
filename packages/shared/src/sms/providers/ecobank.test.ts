import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Ecobank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'Ecobank: Credit of GHS 3,000.00 to your account XXX5678. Ref: ECO001. Bal: GHS 8,500.00. 12-Mar-2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('ecobank');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(300000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ECO001');
    expect(result!.balance_after_pesewas).toBe(850000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'Ecobank: Debit of GHS 150.00 from your account XXX5678. Ref: ECO002. Bal: GHS 8,350.00. 12-Mar-2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('ecobank');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(15000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ECO002');
    expect(result!.balance_after_pesewas).toBe(835000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Ecobank SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
