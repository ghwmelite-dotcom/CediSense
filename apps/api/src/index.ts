import { Hono } from 'hono';
import type { Env, Variables } from './types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default app;
