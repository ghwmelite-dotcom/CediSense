import type { Env } from '../types.js';

/**
 * Response envelope helpers for consistent API responses.
 */
export function success<T>(data: T, status = 200) {
  return { data, _status: status };
}

export function created<T>(data: T) {
  return { data, _status: 201 };
}

export function error(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return {
    error: { code, message, ...(details ? { details } : {}) },
    _status: status,
  };
}

/**
 * Generate a random ID matching D1 default: lower(hex(randomblob(16)))
 */
export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
