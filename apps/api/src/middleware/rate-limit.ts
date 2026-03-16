import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

const GENERAL_LIMIT = 100;
const GENERAL_WINDOW_SECONDS = 60;

/**
 * General API rate limiting: 100 requests/minute per authenticated user.
 * Uses KV with sliding window approximation.
 */
export const rateLimitMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    await next();
    return;
  }

  const key = `rate:api:${userId}`;
  const current = await c.env.KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= GENERAL_LIMIT) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
          retryAfter: GENERAL_WINDOW_SECONDS,
        },
      },
      429,
      { 'Retry-After': String(GENERAL_WINDOW_SECONDS) }
    );
  }

  // Increment counter — only set TTL on first write to preserve the window
  if (count === 0) {
    await c.env.KV.put(key, '1', { expirationTtl: GENERAL_WINDOW_SECONDS });
  } else {
    await c.env.KV.put(key, String(count + 1));
  }

  await next();
});

/**
 * Login rate limiting: 5 attempts per phone per 15 minutes.
 * Returns remaining attempts and lockout info.
 */
export async function checkLoginRateLimit(
  kv: KVNamespace,
  phone: string
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const key = `rate:login:${phone}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= 5) {
    return { allowed: false, remaining: 0, retryAfter: 900 };
  }

  return { allowed: true, remaining: 5 - count - 1 };
}

export async function incrementLoginAttempts(kv: KVNamespace, phone: string): Promise<void> {
  const key = `rate:login:${phone}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  // Only set TTL on first write to preserve the 15-minute window
  if (count === 0) {
    await kv.put(key, '1', { expirationTtl: 900 });
  } else {
    await kv.put(key, String(count + 1));
  }
}

export async function clearLoginAttempts(kv: KVNamespace, phone: string): Promise<void> {
  await kv.delete(`rate:login:${phone}`);
}
