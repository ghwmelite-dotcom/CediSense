import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Fidelity Bank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'Fidelity Bank: GHS 2,000.00 credited to account XXX9012. Ref: FID001. Balance: GHS 6,200.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('fidelity');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(200000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('FID001');
    expect(result!.balance_after_pesewas).toBe(620000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'Fidelity Bank: GHS 500.00 debited from account XXX9012. Ref: FID002. Balance: GHS 5,700.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('fidelity');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(50000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('FID002');
    expect(result!.balance_after_pesewas).toBe(570000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Fidelity SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
