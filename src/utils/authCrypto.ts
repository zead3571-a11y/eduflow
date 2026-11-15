// PROTOTYPE-ONLY: Client-side SHA-256 + per-user salt password hashing via Web Crypto.
// For production deployment with Supabase/backend, replace with server-side Auth / Argon2id or bcrypt.

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto SubtleCrypto غير متاح في هذه البيئة');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(byteLength = 16): string {
  const buf = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(buf);
}

/**
 * PROTOTYPE-ONLY SHA-256(salt + ":" + password) using Web Crypto.
 */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const digest = await subtle.digest('SHA-256', encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`);
}

export async function createPasswordCredential(
  password: string
): Promise<{ salt: string; passwordHash: string }> {
  const salt = generateSalt();
  const passwordHash = await hashPasswordWithSalt(password, salt);
  return { salt, passwordHash };
}

export async function verifyPasswordWithSalt(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const computed = await hashPasswordWithSalt(password, salt);
  if (computed.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) {
    diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Deterministic fallback hash helper used purely for initial static seed generation.
 * Matches SHA-256(salt + ":" + "EduFlow@2026") for pre-seeded demo accounts.
 */
export const PROTOTYPE_DEMO_PASSWORD_PLAIN = 'EduFlow@2026';
export const PROTOTYPE_SEED_SALTS = {
  u1: 'eduflow-salt-u1-owner',
  u2: 'eduflow-salt-u2-admin',
  u3: 'eduflow-salt-u3-acc',
  u4: 'eduflow-salt-u4-rec',
  u5: 'eduflow-salt-u5-tch',
  u6: 'eduflow-salt-u6-parent',
} as const;
