const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(pin: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
}

/**
 * Hash a PIN using PBKDF2-SHA256 with a random salt.
 * Returns base64-encoded hash and salt for storage.
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hashBuffer = await deriveKey(pin, salt.buffer);

  return {
    hash: toBase64(hashBuffer),
    salt: toBase64(salt.buffer),
  };
}

/**
 * Verify a PIN against a stored hash and salt.
 */
export async function verifyPin(pin: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const salt = fromBase64(storedSalt);
  const hashBuffer = await deriveKey(pin, salt);
  const computedHash = toBase64(hashBuffer);

  // Constant-time comparison
  if (computedHash.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}
