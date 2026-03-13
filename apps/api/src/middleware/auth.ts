import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import { verifyAccessToken } from '../lib/jwt.js';

/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies signature, sets userId in context.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } },
      401
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(
      { error: { code: 'TOKEN_EXPIRED', message: 'Access token is invalid or expired' } },
      401
    );
  }

  c.set('userId', payload.sub);
  await next();
});
