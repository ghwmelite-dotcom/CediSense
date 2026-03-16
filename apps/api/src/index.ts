import { Hono } from 'hono';
import type { Env, Variables } from './types.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { auth } from './routes/auth.js';
import { users } from './routes/users.js';
import { accounts } from './routes/accounts.js';
import { categories } from './routes/categories.js';
import { categoryRules } from './routes/category-rules.js';
import { transactions } from './routes/transactions.js';
import { importRoutes } from './routes/import.js';
import { dashboard } from './routes/dashboard.js';
import { ai } from './routes/ai.js';
import { budgets } from './routes/budgets.js';
import { goals } from './routes/goals.js';
import { insights } from './routes/insights.js';
import { recurring } from './routes/recurring.js';
import { ious } from './routes/ious.js';
import { investments } from './routes/investments.js';
import { susu } from './routes/susu.js';
import { collector } from './routes/collector.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', corsMiddleware());

// Public auth routes
app.route('/api/v1/auth', auth);

// Public certificate verification (no auth required) — IP rate limited, PII stripped
app.get('/api/v1/susu/certificate/verify/:certificateId', async (c) => {
  // IP-based rate limiting: 20 requests per minute
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const rlKey = `rate:cert-verify:${ip}`;
  const rlCurrent = await c.env.KV.get(rlKey);
  const rlCount = rlCurrent ? parseInt(rlCurrent, 10) : 0;

  if (rlCount >= 20) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
      429,
      { 'Retry-After': '60' }
    );
  }

  // Only set TTL on first write to avoid resetting the window
  if (rlCount === 0) {
    await c.env.KV.put(rlKey, '1', { expirationTtl: 60 });
  } else {
    await c.env.KV.put(rlKey, String(rlCount + 1));
  }

  const certId = c.req.param('certificateId');
  const row = await c.env.DB.prepare(
    `SELECT certificate_data FROM credit_certificates WHERE id = ?`
  ).bind(certId).first<{ certificate_data: string }>();
  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Certificate not found' } }, 404);
  }

  // Strip PII — only return safe public fields
  const fullData = JSON.parse(row.certificate_data) as Record<string, unknown>;
  const holderName = typeof fullData.holder_name === 'string'
    ? fullData.holder_name.split(' ')[0]
    : undefined;

  return c.json({
    data: {
      valid: true,
      holder_first_name: holderName ?? 'Member',
      trust_score_label: fullData.trust_score_label ?? null,
      issued_date: fullData.issued_date ?? fullData.issued_at ?? null,
    },
  });
});

// Protected routes with rate limiting
app.use('/api/v1/users/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/accounts/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/categories/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/category-rules/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: /import must be registered before /transactions to prevent /:id catching /import
app.use('/api/v1/import/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/transactions/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/dashboard', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ai/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/budgets', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/budgets/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/goals/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / needs the first, POST /report needs the second.
app.use('/api/v1/insights', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/insights/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / needs the first, nested routes need the second.
app.use('/api/v1/recurring', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/recurring/*', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ious', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/ious/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET / and GET /summary need the first, nested routes need the second.
app.use('/api/v1/investments', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/investments/*', authMiddleware, rateLimitMiddleware);
// IMPORTANT: Both bare path AND wildcard required — GET /groups needs the first, nested group routes need the second.
app.use('/api/v1/susu', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/susu/*', authMiddleware, rateLimitMiddleware);
// Collector (Market Women's Digital Collector)
app.use('/api/v1/collector', authMiddleware, rateLimitMiddleware);
app.use('/api/v1/collector/*', authMiddleware, rateLimitMiddleware);

app.route('/api/v1/users', users);
app.route('/api/v1/accounts', accounts);
app.route('/api/v1/categories', categories);
app.route('/api/v1/category-rules', categoryRules);
// Mount import BEFORE transactions so /transactions/import is never ambiguous
app.route('/api/v1/import', importRoutes);
app.route('/api/v1/transactions', transactions);
app.route('/api/v1/dashboard', dashboard);
app.route('/api/v1/ai', ai);
app.route('/api/v1/budgets', budgets);
app.route('/api/v1/goals', goals);
app.route('/api/v1/insights', insights);
app.route('/api/v1/recurring', recurring);
app.route('/api/v1/ious', ious);
app.route('/api/v1/investments', investments);
app.route('/api/v1/susu', susu);
app.route('/api/v1/collector', collector);

// Health check
app.get('/api/v1/health', (c) => {
  return c.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 fallback
app.notFound((c) => {
  return c.json(
    { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500
  );
});

export default app;
