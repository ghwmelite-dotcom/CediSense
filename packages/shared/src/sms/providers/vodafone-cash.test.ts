import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('Vodafone Cash SMS patterns', () => {
  it('parses send money', () => {
    const result = parseSMS(
      'You have sent GHS 100.00 to KOFI MENSAH (020XXXXXXX). Fee: GHS 0.75. Ref: VC1234567. Balance: GHS 350.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('vodafone_cash');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(10000);
    expect(result!.fee_pesewas).toBe(75);
    expect(result!.counterparty).toBe('KOFI MENSAH');
    expect(result!.reference).toBe('VC1234567');
    expect(result!.balance_after_pesewas).toBe(35000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses receive money', () => {
    const result = parseSMS(
      'You have received GHS 200.00 from ABENA OWUSU (020XXXXXXX). Ref: VC2345678. Balance: GHS 550.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('vodafone_cash');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(20000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('ABENA OWUSU');
    expect(result!.reference).toBe('VC2345678');
    expect(result!.balance_after_pesewas).toBe(55000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses payment', () => {
    const result = parseSMS(
      'Payment of GHS 45.00 to MELCOM LTD. Ref: VC3456789. Fee: GHS 0.00. Balance: GHS 505.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('vodafone_cash');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(4500);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('MELCOM LTD');
    expect(result!.reference).toBe('VC3456789');
    expect(result!.balance_after_pesewas).toBe(50500);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses withdrawal', () => {
    const result = parseSMS(
      'Cash withdrawal of GHS 300.00. Fee: GHS 2.00. Ref: VC4567890. Balance: GHS 203.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('vodafone_cash');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(30000);
    expect(result!.fee_pesewas).toBe(200);
    expect(result!.reference).toBe('VC4567890');
    expect(result!.balance_after_pesewas).toBe(20300);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses deposit', () => {
    const result = parseSMS(
      'Cash deposit of GHS 500.00 received. Ref: VC5678901. Balance: GHS 703.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('vodafone_cash');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(50000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('VC5678901');
    expect(result!.balance_after_pesewas).toBe(70300);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-Vodafone Cash SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
