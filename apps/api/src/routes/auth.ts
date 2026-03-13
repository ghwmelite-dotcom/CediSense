import { Hono } from 'hono';
import type { Env, Variables, AppContext } from '../types.js';
import { registerSchema, loginSchema, normalizePhone } from '@cedisense/shared';
import { hashPin, verifyPin } from '../lib/hash.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../lib/jwt.js';
import { generateId } from '../lib/db.js';
import {
  checkLoginRateLimit,
  incrementLoginAttempts,
  clearLoginAttempts,
} from '../middleware/rate-limit.js';
import { authMiddleware } from '../middleware/auth.js';
import type { PinCredential, PublicUser } from '@cedisense/shared';

const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function setRefreshCookie(c: AppContext, token: string) {
  const isProduction = c.env.ENVIRONMENT === 'production';
  const cookie = [
    `refreshToken=${token}`,
    'Path=/api/v1/auth',
    'HttpOnly',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    `Max-Age=${REFRESH_TOKEN_TTL}`,
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
  c.header('Set-Cookie', cookie);
}

function clearRefreshCookie(c: AppContext) {
  const isProduction = c.env.ENVIRONMENT === 'production';
  const cookie = [
    'refreshToken=',
    'Path=/api/v1/auth',
    'HttpOnly',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    'Max-Age=0',
    ...(isProduction ? ['Secure'] : []),
  ].join('; ');
  c.header('Set-Cookie', cookie);
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

// POST /api/v1/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const { name, pin } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid Ghana phone number' } },
      400
    );
  }

  // Check if phone already registered
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE phone = ?'
  ).bind(phone).first();

  if (existing) {
    return c.json(
      { error: { code: 'PHONE_EXISTS', message: 'This phone number is already registered' } },
      409
    );
  }

  // Hash PIN
  const { hash, salt } = await hashPin(pin);
  const credential: PinCredential = { hash, salt };

  // Create user + auth method in a batch
  const userId = generateId();
  const authMethodId = generateId();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO users (id, phone, name) VALUES (?, ?, ?)'
    ).bind(userId, phone, name),
    c.env.DB.prepare(
      'INSERT INTO auth_methods (id, user_id, type, credential, is_primary) VALUES (?, ?, ?, ?, ?)'
    ).bind(authMethodId, userId, 'pin', JSON.stringify(credential), 1),
  ]);

  // Generate tokens
  const accessToken = await signAccessToken(userId, c.env.JWT_SECRET);
  const refreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);

  // Store refresh token hash in KV
  await c.env.KV.put(
    `refresh:${refreshHash}`,
    JSON.stringify({ userId, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  // Set cookie and respond
  setRefreshCookie(c, refreshToken);

  const user: PublicUser = { id: userId, name, phone };
  return c.json({ data: { accessToken, user } }, 201);
});

// POST /api/v1/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      400
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid Ghana phone number' } },
      400
    );
  }

  // Check rate limit
  const rateLimit = await checkLoginRateLimit(c.env.KV, phone);
  if (!rateLimit.allowed) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
          retryAfter: rateLimit.retryAfter,
        },
      },
      429,
      { 'Retry-After': String(rateLimit.retryAfter) }
    );
  }

  // Lookup user and auth method
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.phone, am.credential
     FROM users u
     JOIN auth_methods am ON am.user_id = u.id AND am.type = 'pin' AND am.is_primary = 1
     WHERE u.phone = ?`
  ).bind(phone).first<{ id: string; name: string; phone: string; credential: string }>();

  if (!row) {
    await incrementLoginAttempts(c.env.KV, phone);
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone number or PIN' } },
      401,
      { 'X-RateLimit-Remaining': String(rateLimit.remaining) }
    );
  }

  // Verify PIN
  const { hash, salt } = JSON.parse(row.credential) as PinCredential;
  const valid = await verifyPin(parsed.data.pin, hash, salt);

  if (!valid) {
    await incrementLoginAttempts(c.env.KV, phone);
    return c.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone number or PIN' } },
      401,
      { 'X-RateLimit-Remaining': String(rateLimit.remaining) }
    );
  }

  // Success — clear rate limit
  await clearLoginAttempts(c.env.KV, phone);

  // Generate tokens
  const accessToken = await signAccessToken(row.id, c.env.JWT_SECRET);
  const refreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);

  await c.env.KV.put(
    `refresh:${refreshHash}`,
    JSON.stringify({ userId: row.id, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  setRefreshCookie(c, refreshToken);

  const user: PublicUser = { id: row.id, name: row.name, phone: row.phone };
  return c.json({ data: { accessToken, user } });
});

// POST /api/v1/auth/refresh
auth.post('/refresh', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const refreshToken = getCookieValue(cookieHeader, 'refreshToken');

  if (!refreshToken) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'No refresh token' } },
      401
    );
  }

  const tokenHash = await hashRefreshToken(refreshToken);
  const stored = await c.env.KV.get(`refresh:${tokenHash}`);

  if (!stored) {
    clearRefreshCookie(c);
    return c.json(
      { error: { code: 'TOKEN_EXPIRED', message: 'Refresh token is invalid or expired' } },
      401
    );
  }

  const { userId } = JSON.parse(stored) as { userId: string };

  // Delete old token (single-use rotation)
  await c.env.KV.delete(`refresh:${tokenHash}`);

  // Generate new token pair
  const newAccessToken = await signAccessToken(userId, c.env.JWT_SECRET);
  const newRefreshToken = generateRefreshToken();
  const newRefreshHash = await hashRefreshToken(newRefreshToken);

  await c.env.KV.put(
    `refresh:${newRefreshHash}`,
    JSON.stringify({ userId, createdAt: new Date().toISOString() }),
    { expirationTtl: REFRESH_TOKEN_TTL }
  );

  setRefreshCookie(c, newRefreshToken);

  return c.json({ data: { accessToken: newAccessToken } });
});

// POST /api/v1/auth/logout (protected)
auth.post('/logout', authMiddleware, async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const refreshToken = getCookieValue(cookieHeader, 'refreshToken');

  if (refreshToken) {
    const tokenHash = await hashRefreshToken(refreshToken);
    await c.env.KV.delete(`refresh:${tokenHash}`);
  }

  clearRefreshCookie(c);
  return c.body(null, 204);
});

export { auth };
