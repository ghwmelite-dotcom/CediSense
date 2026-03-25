import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';

/**
 * Admin role check middleware.
 * Must run AFTER authMiddleware (requires userId already set in context).
 * Verifies the user holds 'admin' or 'superadmin' role and sets adminRole in context.
 */
export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = c.get('userId');

  const userRow = await c.env.DB.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).bind(userId).first<{ role: string }>();

  const role = userRow?.role;

  if (role !== 'admin' && role !== 'superadmin') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      403
    );
  }

  c.set('adminRole', role as 'admin' | 'superadmin');
  await next();
});
