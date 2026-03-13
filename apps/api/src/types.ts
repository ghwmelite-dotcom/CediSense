import type { Context } from 'hono';

// Cloudflare bindings available in every Worker handler
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// Variables injected by middleware (e.g., auth middleware sets userId)
export interface Variables {
  userId: string;
}

// Hono app type with our bindings and variables
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
