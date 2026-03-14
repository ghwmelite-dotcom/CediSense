const API_WORKER = 'https://cedisense-api.ghwmelite.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const apiUrl = `${API_WORKER}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const response = await fetch(apiUrl, {
    method: context.request.method,
    headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD'
      ? context.request.body
      : undefined,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('set-cookie');

  // Forward set-cookie headers
  const cookies = response.headers.getAll?.('set-cookie') ?? [];

  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });

  // Re-add cookies
  for (const cookie of cookies) {
    newResponse.headers.append('set-cookie', cookie);
  }

  return newResponse;
};
