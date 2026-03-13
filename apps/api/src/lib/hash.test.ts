import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from './hash.js';

describe('hashPin', () => {
  it('returns hash and salt as base64 strings', async () => {
    const result = await hashPin('5839');
    expect(result.hash).toBeTruthy();
    expect(result.salt).toBeTruthy();
    // base64 encoded strings
    expect(typeof result.hash).toBe('string');
    expect(typeof result.salt).toBe('string');
  });

  it('produces different salts for same PIN', async () => {
    const a = await hashPin('5839');
    const b = await hashPin('5839');
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('verifyPin', () => {
  it('returns true for correct PIN', async () => {
    const { hash, salt } = await hashPin('5839');
    const result = await verifyPin('5839', hash, salt);
    expect(result).toBe(true);
  });

  it('returns false for wrong PIN', async () => {
    const { hash, salt } = await hashPin('5839');
    const result = await verifyPin('9999', hash, salt);
    expect(result).toBe(false);
  });
});
