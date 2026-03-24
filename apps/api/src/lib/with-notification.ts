// apps/api/src/lib/with-notification.ts
import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types.js';
import type { NotificationEvent } from '@cedisense/shared';
import { NotificationService } from './notifications.js';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

/**
 * Factory function that receives the Hono context and the unwrapped `data`
 * field from the response JSON. Returns a NotificationEvent to emit, or null
 * to skip notification (e.g. on unexpected response shape).
 */
export type NotificationEventFactory<TData = Record<string, unknown>> = (
  c: AppContext,
  data: TData,
) => NotificationEvent | null;

/**
 * Wraps a Hono handler with automatic notification dispatch.
 *
 * Behaviour:
 * 1. Calls the original handler.
 * 2. On a 2xx response, clones the response and reads the JSON body.
 * 3. Calls `eventFactory(c, responseData.data)` to build a NotificationEvent.
 * 4. Fires `NotificationService.emit()` via `c.executionCtx.waitUntil()` — fully
 *    non-blocking so it never delays or breaks the response.
 * 5. Catches ALL errors silently — notifications must never affect the response.
 */
export function withNotification<TData = Record<string, unknown>>(
  handler: (c: AppContext, next: Next) => Promise<Response>,
  eventFactory: NotificationEventFactory<TData>,
): (c: AppContext, next: Next) => Promise<Response> {
  return async (c: AppContext, next: Next): Promise<Response> => {
    const response = await handler(c, next);

    // Only dispatch for successful responses
    if (response.status >= 200 && response.status < 300) {
      // Clone before reading — consuming the body would break the response
      const cloned = response.clone();

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const json = await cloned.json<{ data?: TData }>();
            const data = json?.data;
            if (data === undefined || data === null) return;

            const event = eventFactory(c, data as TData);
            if (!event) return;

            const svc = new NotificationService(c.env);
            await svc.emit(event);
          } catch {
            // Notifications must never break the response — swallow all errors
          }
        })(),
      );
    }

    return response;
  };
}
