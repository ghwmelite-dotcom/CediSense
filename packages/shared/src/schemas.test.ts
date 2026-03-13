import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, createAccountSchema, updateAccountSchema, updateUserSchema, pinSchema } from './schemas.js';

describe('pinSchema', () => {
  it('accepts valid PIN', () => {
    expect(pinSchema.safeParse('5839').success).toBe(true);
  });

  it('rejects non-numeric', () => {
    expect(pinSchema.safeParse('abcd').success).toBe(false);
  });

  it('rejects too short', () => {
    expect(pinSchema.safeParse('123').success).toBe(false);
  });

  it('rejects weak PIN 1234', () => {
    const result = pinSchema.safeParse('1234');
    expect(result.success).toBe(false);
  });

  it('rejects repeated digits 0000', () => {
    expect(pinSchema.safeParse('0000').success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      phone: '0241234567',
      name: 'Kwame Asante',
      pin: '5839',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone prefix', () => {
    const result = registerSchema.safeParse({
      phone: '0611234567',
      name: 'Test',
      pin: '5839',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short name', () => {
    const result = registerSchema.safeParse({
      phone: '0241234567',
      name: 'K',
      pin: '5839',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login (even weak PIN)', () => {
    const result = loginSchema.safeParse({
      phone: '0241234567',
      pin: '1234',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone', () => {
    const result = loginSchema.safeParse({
      phone: '0611234567',
      pin: '1234',
    });
    expect(result.success).toBe(false);
  });
});

describe('createAccountSchema', () => {
  it('accepts valid momo account', () => {
    const result = createAccountSchema.safeParse({
      name: 'MTN MoMo',
      type: 'momo',
      provider: 'mtn',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = createAccountSchema.safeParse({
      name: 'Test',
      type: 'crypto',
    });
    expect(result.success).toBe(false);
  });

  it('defaults balance to 0', () => {
    const result = createAccountSchema.safeParse({
      name: 'Cash',
      type: 'cash',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.balance_pesewas).toBe(0);
    }
  });
});

describe('updateAccountSchema', () => {
  it('accepts partial update', () => {
    const result = updateAccountSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    const result = updateAccountSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative balance', () => {
    const result = updateAccountSchema.safeParse({ balance_pesewas: -100 });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts partial update', () => {
    const result = updateUserSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts language update', () => {
    const result = updateUserSchema.safeParse({ preferred_language: 'tw' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid language', () => {
    const result = updateUserSchema.safeParse({ preferred_language: 'fr' });
    expect(result.success).toBe(false);
  });

  it('rejects negative income', () => {
    const result = updateUserSchema.safeParse({ monthly_income_ghs: -500 });
    expect(result.success).toBe(false);
  });
});
