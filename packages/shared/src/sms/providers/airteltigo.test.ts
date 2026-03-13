import { describe, it, expect } from 'vitest';
import { parseSMS } from '../index';

describe('AirtelTigo SMS patterns', () => {
  it('parses transfer sent', () => {
    const result = parseSMS(
      'AirtelTigo Money: You sent GHS 75.00 to YAW BOATENG (027XXXXXXX). Fee: GHS 0.50. TxnID: AT123456. Bal: GHS 425.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('airteltigo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(7500);
    expect(result!.fee_pesewas).toBe(50);
    expect(result!.counterparty).toBe('YAW BOATENG');
    expect(result!.reference).toBe('AT123456');
    expect(result!.balance_after_pesewas).toBe(42500);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses transfer received', () => {
    const result = parseSMS(
      'AirtelTigo Money: You received GHS 150.00 from EFUA MENSAH (026XXXXXXX). TxnID: AT234567. Bal: GHS 575.00. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('airteltigo');
    expect(result!.type).toBe('credit');
    expect(result!.amount_pesewas).toBe(15000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('EFUA MENSAH');
    expect(result!.reference).toBe('AT234567');
    expect(result!.balance_after_pesewas).toBe(57500);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses withdrawal (cash out)', () => {
    const result = parseSMS(
      'AirtelTigo Money: Cash out GHS 200.00. Fee: GHS 1.50. TxnID: AT345678. Bal: GHS 373.50. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('airteltigo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(20000);
    expect(result!.fee_pesewas).toBe(150);
    expect(result!.reference).toBe('AT345678');
    expect(result!.balance_after_pesewas).toBe(37350);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('parses payment', () => {
    const result = parseSMS(
      'AirtelTigo Money: Payment GHS 60.00 to GAME STORES. TxnID: AT456789. Fee: GHS 0.00. Bal: GHS 313.50. 12/03/2026',
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('airteltigo');
    expect(result!.type).toBe('debit');
    expect(result!.amount_pesewas).toBe(6000);
    expect(result!.fee_pesewas).toBe(0);
    expect(result!.counterparty).toBe('GAME STORES');
    expect(result!.reference).toBe('AT456789');
    expect(result!.balance_after_pesewas).toBe(31350);
    expect(result!.transaction_date).toBe('2026-03-12');
  });

  it('returns null for non-AirtelTigo SMS', () => {
    const result = parseSMS('Your OTP is 123456. Do not share with anyone.');
    expect(result).toBeNull();
  });
});
