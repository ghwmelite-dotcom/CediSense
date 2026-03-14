import type { ApiSuccess, ApiError } from '@cedisense/shared';
import { getCachedResponse, setCachedResponse, addToSyncQueue } from './offline-db';

const API_BASE = '/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const CACHE_TTLS: Record<string, number> = {
  '/dashboard': 300000,
  '/transactions': 300000,
  '/accounts': 1800000,
  '/categories': 3600000,
  '/budgets': 300000,
  '/goals': 300000,
  '/recurring': 300000,
  '/insights': 300000,
};

function getCacheTTL(path: string): number {
  for (const [prefix, ttl] of Object.entries(CACHE_TTLS)) {
    if (path.startsWith(prefix)) return ttl;
  }
  return 300000; // 5 min default
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // If online, try the network
  if (navigator.onLine) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (response.status === 204) {
        return undefined as T;
      }

      const json = await response.json();

      if (!response.ok) {
        const error = json as ApiError;
        throw new ApiRequestError(
          error.error.message,
          error.error.code,
          response.status,
          error.error.details
        );
      }

      const data = (json as ApiSuccess<T>).data;

      // Cache GET responses in IndexedDB
      if (isGet) {
        setCachedResponse(path, data, getCacheTTL(path)).catch(() => {});
      }

      return data;
    } catch (err) {
      // If it's an ApiRequestError, rethrow (server responded with error)
      if (err instanceof ApiRequestError) throw err;
      // Network error while supposedly online — fall through to offline logic
    }
  }

  // Offline (or network error) handling
  if (isGet) {
    // Try IndexedDB cache
    const cached = await getCachedResponse<T>(path);
    if (cached !== null) return cached;
    throw new ApiRequestError('You\'re offline and this data isn\'t cached yet', 'OFFLINE', 0);
  }

  // Offline mutation — add to sync queue
  await addToSyncQueue({
    method: method as 'POST' | 'PUT' | 'DELETE',
    path,
    body: options.body ? JSON.parse(options.body as string) : undefined,
    timestamp: Date.now(),
  });

  return undefined as T;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
