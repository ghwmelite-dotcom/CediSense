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

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', corsMiddleware());

// Public auth routes
app.route('/api/v1/auth', auth);

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
