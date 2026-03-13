import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('MTN MoMo SMS patterns', () => {
  it('parses cash-out', () => {
    const result = parseSMS(
      'You have cashed out GHS 200.00 from your MoMo account. Fee charged: GHS 1.50. Reference: 1234567890. Balance: GHS 450.00. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(20000);
    expect(result!.fee_pesewas).toBe(150);
    expect(result!.reference).toBe('1234567890');
    expect(result!.balance_after_pesewas).toBe(45000);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses transfer sent', () => {
    const result = parseSMS(
      'You have sent GHS 50.00 to KWAME ASANTE (024XXXXXXX). Reference: 9876543210. Fee: GHS 0.50. Balance: GHS 399.50. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(5000);
    expect(result!.fee_pesewas).toBe(50);
    expect(result!.counterparty).toBe('KWAME ASANTE');
    expect(result!.reference).toBe('9876543210');
    expect(result!.balance_after_pesewas).toBe(39950);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses transfer received', () => {
    const result = parseSMS(
      'You have received GHS 100.00 from AMA MENSAH (025XXXXXXX). Reference: 5678901234. Balance: GHS 549.50. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(10000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('AMA MENSAH');
    expect(result!.reference).toBe('5678901234');
    expect(result!.balance_after_pesewas).toBe(54950);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses merchant payment', () => {
    const result = parseSMS(
      'You have paid GHS 35.00 to SHOPRITE ACCRA MALL. Reference: 1122334455. Fee: GHS 0.00. Balance: GHS 514.50. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(3500);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('SHOPRITE ACCRA MALL');
    expect(result!.reference).toBe('1122334455');
    expect(result!.balance_after_pesewas).toBe(51450);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses airtime purchase', () => {
    const result = parseSMS(
      'You have bought GHS 10.00 airtime. Reference: 6677889900. Balance: GHS 504.50. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(1000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('6677889900');
    expect(result!.balance_after_pesewas).toBe(50450);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses cash deposit (cash-in)', () => {
    const result = parseSMS(
      'You have received GHS 500.00 cash deposit. Reference: 4455667788. Balance: GHS 1,004.50. Date: 12/03/2026.',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mtn_momo');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(50000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.reference).toBe('4455667788');
    expect(result!.balance_after_pesewas).toBe(100450);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-MoMo SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
