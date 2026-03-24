import type { Context } from 'hono';

// Cloudflare bindings available in every Worker handler
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT_EMAIL: string;
}

// Variables injected by middleware (e.g., auth middleware sets userId)
export interface Variables {
  userId: string;
}

// Hono app type with our bindings and variables
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
