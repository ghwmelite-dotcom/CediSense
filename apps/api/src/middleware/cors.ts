import { cors } from 'hono/cors';
import type { Env, Variables } from '../types.js';

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const env = c.env as Env;
      const allowed = [
        'https://cedisense.com',
        'https://www.cedisense.com',
        'https://cedisense.pages.dev',
      ];

      // Allow Pages preview deploys
      if (origin?.endsWith('.cedisense.pages.dev')) {
        return origin;
      }

      // Allow localhost in development
      if (env.ENVIRONMENT === 'development' && origin?.startsWith('http://localhost')) {
        return origin;
      }

      if (allowed.includes(origin ?? '')) {
        return origin!;
      }

      return '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
}
