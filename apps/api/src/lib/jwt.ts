const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeJson(obj: object): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Create a signed JWT access token.
 */
export async function signAccessToken(userId: string, secret: string): Promise<string> {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeJson({
    sub: userId,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  });

  const signingInput = `${header}.${payload}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * Verify a JWT access token. Returns payload if valid, null otherwise.
 */
export async function verifyAccessToken(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const signingInput = `${header}.${payload}`;

    const key = await getSigningKey(secret);
    const signatureBuffer = fromBase64Url(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload))
    ) as JwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token (32 bytes, base64url-encoded).
 */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes.buffer);
}

/**
 * Hash a refresh token for KV storage (SHA-256).
 */
export async function hashRefreshToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return toBase64Url(buffer);
}
