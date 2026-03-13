import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from './jwt.js';

const TEST_SECRET = 'test-secret-key-for-testing-only-min-32-chars!!';

describe('signAccessToken', () => {
  it('creates a valid JWT string', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyAccessToken', () => {
  it('returns userId for valid token', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-123');
  });

  it('returns null for tampered token', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifyAccessToken(tampered, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('returns null for wrong secret', async () => {
    const token = await signAccessToken('user-123', TEST_SECRET);
    const payload = await verifyAccessToken(token, 'wrong-secret-key-that-is-long-enough-chars!!');
    expect(payload).toBeNull();
  });
});

describe('generateRefreshToken', () => {
  it('produces a non-empty base64url string', () => {
    const token = generateRefreshToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    // base64url: no +, /, or = characters
    expect(token).not.toMatch(/[+/=]/);
  });

  it('produces unique tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });
});

describe('hashRefreshToken', () => {
  it('produces a deterministic hash', async () => {
    const token = 'test-token-value';
    const hash1 = await hashRefreshToken(token);
    const hash2 = await hashRefreshToken(token);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different tokens', async () => {
    const hash1 = await hashRefreshToken('token-a');
    const hash2 = await hashRefreshToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});
