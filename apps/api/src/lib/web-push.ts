/**
 * Web Push utility for Cloudflare Workers.
 *
 * Implements RFC 8291 (aes128gcm payload encryption) and RFC 8292 (VAPID).
 * Uses only Web Crypto API — no Node.js crypto dependency.
 *
 * VAPID keys are expected in the format produced by `web-push generate-vapid-keys`:
 *   - Public key:  65-byte uncompressed EC point (0x04 || x[32] || y[32]), base64url-encoded
 *   - Private key: 32-byte raw scalar (the JWK `d` parameter), base64url-encoded
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushSubscription {
  endpoint: string;
  p256dh: string; // base64url-encoded client public key (65 bytes uncompressed)
  auth: string;   // base64url-encoded auth secret (16 bytes)
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface VapidKeys {
  publicKey: string;  // base64url-encoded uncompressed P-256 point
  privateKey: string; // base64url-encoded raw P-256 scalar
  contactEmail: string;
}

// ---------------------------------------------------------------------------
// Base64url helpers (consistent with jwt.ts)
// ---------------------------------------------------------------------------

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a base64url string to a Uint8Array backed by a plain ArrayBuffer. */
function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Ensure the underlying buffer is a plain ArrayBuffer, not SharedArrayBuffer
  return new Uint8Array(bytes.buffer.slice(0) as ArrayBuffer);
}

/** Wrap any Uint8Array so its .buffer is a plain ArrayBuffer. */
function ensurePlainBuffer(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// VAPID JWT (ES256)
// ---------------------------------------------------------------------------

/**
 * Convert a DER-encoded ECDSA signature (ASN.1 SEQUENCE) to raw r||s (64 bytes).
 * Web Crypto returns DER for ECDSA; JWT requires the raw IEEE P1363 format.
 */
function derToRaw(der: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(der);
  // Structure: 0x30 <len> 0x02 <rLen> r... 0x02 <sLen> s...
  let offset = 2; // skip SEQUENCE tag + length
  // r
  offset++; // skip 0x02 INTEGER tag
  const rLen = bytes[offset++];
  const r = bytes.slice(offset, offset + rLen);
  offset += rLen;
  // s
  offset++; // skip 0x02 INTEGER tag
  const sLen = bytes[offset++];
  const s = bytes.slice(offset, offset + sLen);

  // Each component may be 33 bytes (leading 0x00 padding for positive integer).
  // We need the last 32 bytes of each.
  const raw = new Uint8Array(64);
  raw.set(r.slice(-32), 0);
  raw.set(s.slice(-32), 32);
  return raw.buffer.slice(0) as ArrayBuffer;
}

function encodeJsonB64(obj: object): string {
  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  return toBase64Url(encoded.buffer.slice(0) as ArrayBuffer);
}

/**
 * Import the VAPID private key from its raw base64url-encoded 32-byte form.
 * Derives x/y from the raw public key bytes so we can build a full JWK.
 */
async function importVapidPrivateKey(
  rawPrivateB64: string,
  rawPublicB64: string
): Promise<CryptoKey> {
  const pubBytes = fromBase64Url(rawPublicB64);
  // Uncompressed point: 0x04 | x[32] | y[32]
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('VAPID public key must be a 65-byte uncompressed EC point (0x04 prefix)');
  }
  const x = toBase64Url(pubBytes.buffer.slice(1, 33) as ArrayBuffer);
  const y = toBase64Url(pubBytes.buffer.slice(33, 65) as ArrayBuffer);
  const d = rawPrivateB64; // already base64url-encoded 32 bytes

  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x, y, d };
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Build and sign the VAPID JWT for the given push endpoint audience.
 * Returns the compact serialisation (header.payload.signature).
 */
async function buildVapidJwt(
  endpoint: string,
  vapid: VapidKeys
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = encodeJsonB64({ alg: 'ES256', typ: 'JWT' });
  const payload = encodeJsonB64({
    aud: audience,
    exp: now + 12 * 3600, // 12-hour validity
    sub: `mailto:${vapid.contactEmail}`,
  });

  const signingInput = `${header}.${payload}`;
  const key = await importVapidPrivateKey(vapid.privateKey, vapid.publicKey);
  const signingBytes = new TextEncoder().encode(signingInput);
  const derSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    ensurePlainBuffer(signingBytes)
  );

  const rawSig = derToRaw(derSig);
  return `${signingInput}.${toBase64Url(rawSig)}`;
}

// ---------------------------------------------------------------------------
// RFC 8291 — aes128gcm payload encryption
// ---------------------------------------------------------------------------

/**
 * HKDF-Extract: PRK = HMAC-SHA256(salt, ikm)
 */
async function hkdfExtract(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const saltKey = await crypto.subtle.importKey(
    'raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const prk = await crypto.subtle.sign('HMAC', saltKey, ikm);
  return crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
}

/**
 * HKDF-Expand: OKM = T(1) where T(1) = HMAC-SHA256(PRK, info || 0x01)
 * Produces exactly `length` bytes (max 32 for SHA-256).
 */
async function hkdfExpand(
  prk: CryptoKey,
  info: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const t1Input = new Uint8Array(info.length + 1) as Uint8Array<ArrayBuffer>;
  t1Input.set(info);
  t1Input[info.length] = 0x01;
  const t1 = await crypto.subtle.sign('HMAC', prk, t1Input);
  return new Uint8Array(t1.slice(0, length)) as Uint8Array<ArrayBuffer>;
}

/**
 * Encrypt plaintext per RFC 8291 using aes128gcm content encoding.
 *
 * Returns the full encrypted body including the aes128gcm header block.
 */
async function encryptPayload(
  plaintext: Uint8Array<ArrayBuffer>,
  clientPublicKeyB64: string, // p256dh — 65-byte uncompressed point, base64url
  authSecretB64: string        // auth   — 16-byte secret, base64url
): Promise<ArrayBuffer> {
  // 1. Generate ephemeral sender key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // 2. Import client's public key
  const clientPubBytes = fromBase64Url(clientPublicKeyB64);
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPubBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. ECDH shared secret (32 bytes)
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits) as Uint8Array<ArrayBuffer>;

  // 4. Export local public key in raw uncompressed form (65 bytes)
  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  ) as Uint8Array<ArrayBuffer>;

  // 5. Auth secret
  const authSecret = fromBase64Url(authSecretB64);

  // 6. Derive IKM via HKDF
  //    info = "WebPush: info\x00" || clientPublicKey || localPublicKey
  const webPushInfoLabel = new TextEncoder().encode('WebPush: info\x00');
  const ikmInfo = new Uint8Array(
    webPushInfoLabel.length + clientPubBytes.length + localPubRaw.length
  ) as Uint8Array<ArrayBuffer>;
  ikmInfo.set(webPushInfoLabel, 0);
  ikmInfo.set(clientPubBytes, webPushInfoLabel.length);
  ikmInfo.set(localPubRaw, webPushInfoLabel.length + clientPubBytes.length);

  const ikmPrk = await hkdfExtract(authSecret, sharedSecret);
  const ikm = await hkdfExpand(ikmPrk, ikmInfo, 32);

  // 7. Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;

  // 8. Derive content encryption key (16 bytes) and nonce (12 bytes)
  const cekPrk = await hkdfExtract(salt, ikm);

  const cekInfoRaw = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
  const cekInfo = ensurePlainBuffer(cekInfoRaw);
  const cek = await hkdfExpand(cekPrk, cekInfo, 16);

  const nonceInfoRaw = new TextEncoder().encode('Content-Encoding: nonce\x00');
  const nonceInfo = ensurePlainBuffer(nonceInfoRaw);
  const nonce = await hkdfExpand(cekPrk, nonceInfo, 12);

  // 9. Pad plaintext: plaintext || 0x02 (delimiter, no additional padding)
  const paddedPlaintext = new Uint8Array(plaintext.length + 1) as Uint8Array<ArrayBuffer>;
  paddedPlaintext.set(plaintext);
  paddedPlaintext[plaintext.length] = 0x02;

  // 10. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPlaintext
  );

  // 11. Build aes128gcm record:
  //     salt[16] + rs[4 big-endian] + idlen[1] + keyid[localPubRaw] + ciphertext
  const rs = 4096;
  const idlen = localPubRaw.length; // 65
  const headerSize = 16 + 4 + 1 + idlen;
  const body = new Uint8Array(headerSize + ciphertext.byteLength);
  let pos = 0;

  body.set(salt, pos); pos += 16;

  // rs as 4-byte big-endian uint32
  new DataView(body.buffer).setUint32(pos, rs, false); pos += 4;

  body[pos++] = idlen;
  body.set(localPubRaw, pos); pos += idlen;
  body.set(new Uint8Array(ciphertext), pos);

  return body.buffer.slice(0) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a Web Push notification to a single subscriber.
 *
 * Returns:
 *   `true`  — push delivered (2xx) or delivery accepted
 *   `false` — subscription is stale (410/404) and should be deleted from DB
 *
 * Transient errors (5xx, network failures) are logged but do not throw —
 * push is best-effort and must not crash the calling request.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
  vapid: VapidKeys
): Promise<boolean> {
  try {
    const plaintextRaw = new TextEncoder().encode(
      JSON.stringify({ title: payload.title, body: payload.body, data: payload.data ?? {} })
    );
    const plaintext = ensurePlainBuffer(plaintextRaw);

    const body = await encryptPayload(plaintext, subscription.p256dh, subscription.auth);

    const jwt = await buildVapidJwt(subscription.endpoint, vapid);
    const authHeader = `vapid t=${jwt}, k=${vapid.publicKey}`;

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400', // 24 hours
      },
      body,
    });

    if (response.ok || response.status === 201) {
      return true;
    }

    if (response.status === 404 || response.status === 410) {
      // Subscription is gone — caller should delete it
      console.info('[web-push] stale subscription, endpoint returned', response.status, subscription.endpoint);
      return false;
    }

    // Transient error — log and treat as best-effort success
    console.warn(
      '[web-push] transient error sending push',
      response.status,
      subscription.endpoint
    );
    return true;
  } catch (err) {
    console.error('[web-push] unexpected error sending push', err);
    // Do not throw — push is best-effort
    return true;
  }
}
