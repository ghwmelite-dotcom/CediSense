import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Absa Bank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'Absa: GHS 1,500.00 credited to XXX7890. Ref: ABS001. Balance: GHS 4,500.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('absa');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(150000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ABS001');
    expect(result!.balance_after_pesewas).toBe(450000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'Absa: GHS 250.00 debited from XXX7890. Ref: ABS002. Balance: GHS 4,250.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('absa');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(25000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('ABS002');
    expect(result!.balance_after_pesewas).toBe(425000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Absa SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
