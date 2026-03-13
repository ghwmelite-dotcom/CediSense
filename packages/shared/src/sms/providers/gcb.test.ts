import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('GCB Bank SMS patterns', () => {
  it('parses credit alert', () => {
    const result = parseSMS(
      'GCB Bank: Your account XXX1234 has been credited with GHS 5,000.00. Ref: GCB001. Balance: GHS 12,500.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('gcb');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(500000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('GCB001');
    expect(result!.balance_after_pesewas).toBe(1250000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses debit alert', () => {
    const result = parseSMS(
      'GCB Bank: Your account XXX1234 has been debited with GHS 200.00. Ref: GCB002. Balance: GHS 12,300.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('gcb');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(20000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('GCB002');
    expect(result!.balance_after_pesewas).toBe(1230000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-GCB SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
