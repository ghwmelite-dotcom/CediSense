/**
 * Cloudflare Pages advanced-mode worker.
 *
 * Why this exists: Pages `_redirects` can only proxy (status 200) to same-site
 * internal paths, NOT to an external origin. The old
 * `/api/v1/* -> cedisense-api.ghwmelite.workers.dev 200` rule therefore never
 * proxied — every /api/* request fell through to the SPA fallback, so GET
 * returned index.html and POST (login/register) returned 405. That broke auth.
 *
 * This worker forwards every /api/* request to the backend Worker, keeping the
 * API same-origin from the browser's point of view. That matters for auth: the
 * refresh cookie is `SameSite=Strict`, so it only works first-party — a direct
 * cross-origin call to the Worker would drop it. All other requests serve static
 * assets, with an index.html SPA fallback for client-side routes.
 */
const API_ORIGIN = 'https://cedisense-api.ghwmelite.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Same-origin API proxy — preserve method, headers (Cookie/Authorization), body.
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      return fetch(new Request(target, request));
    }

    // Static assets.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    // SPA fallback for client-side routes.
    return env.ASSETS.fetch(new URL('/index.html', url.origin));
  },
};
