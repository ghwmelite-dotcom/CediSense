// apps/api/src/routes/admin/index.ts
import { Hono } from 'hono';
import type { Env, Variables } from '../../types.js';
import dashboard from './dashboard.js';
import users from './users.js';
import groups from './groups.js';
import audit from './audit.js';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

admin.route('/', dashboard);
admin.route('/', users);
admin.route('/', groups);
admin.route('/', audit);

export { admin };
