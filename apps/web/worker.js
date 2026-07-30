const API_WORKER = 'https://cedisense-api.ghwmelite.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy /api/* requests to the API Worker
    if (url.pathname.startsWith('/api/')) {
      const apiUrl = `${API_WORKER}${url.pathname}${url.search}`;

      const headers = new Headers(request.headers);
      headers.delete('host');

      const apiResponse = await fetch(apiUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body
          : undefined,
        redirect: 'follow',
      });

      const responseHeaders = new Headers(apiResponse.headers);

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: responseHeaders,
      });
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};
