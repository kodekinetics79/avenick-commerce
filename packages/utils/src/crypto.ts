/**
 * Application-level field encryption for PII at rest (AES-256-GCM).
 *
 * Postgres/Neon already encrypt data on disk at the storage layer, but that does
 * not protect against a leaked DB dump, an over-broad SELECT, or a compromised
 * read replica — the reader sees plaintext. Field-level encryption keeps
 * sensitive columns (phone, address lines, tax IDs) ciphertext *inside* the
 * database, decryptable only by a process holding the key. Defense in depth.
 *
 * Format of an encrypted value (a single self-describing string):
 *
 *   enc:v1:<keyId>:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 *   - "enc:v1" prefix makes encrypted values recognisable and lets us evolve the
 *     scheme without ambiguity.
 *   - keyId names which key encrypted it, so keys can be rotated: add a new key,
 *     encrypt new writes with it, and old values still decrypt with their key.
 *   - GCM gives authenticated encryption: tampering is detected on decrypt.
 *
 * Keys come from PII_ENCRYPTION_KEYS (JSON: {"<keyId>":"<base64 32-byte key>"})
 * and PII_ENCRYPTION_ACTIVE_KEY_ID (which key to encrypt new data with). When
 * unset, isEncryptionConfigured() is false and callers should store plaintext
 * (dev/pilot) — encrypt() throws rather than silently returning plaintext, so
 * you never think data is encrypted when it isn't.
 */
import crypto from "crypto";

const PREFIX = "enc:v1";
const ALGO = "aes-256-gcm";

interface KeyRing {
  keys: Record<string, Buffer>;
  activeKeyId: string;
}

let cachedRing: KeyRing | null | undefined;

function loadKeyRing(): KeyRing | null {
  if (cachedRing !== undefined) return cachedRing;
  const raw = process.env.PII_ENCRYPTION_KEYS?.trim();
  const activeKeyId = process.env.PII_ENCRYPTION_ACTIVE_KEY_ID?.trim();
  if (!raw || !activeKeyId) {
    cachedRing = null;
    return null;
  }
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PII_ENCRYPTION_KEYS is not valid JSON");
  }
  const keys: Record<string, Buffer> = {};
  for (const [id, b64] of Object.entries(parsed)) {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 32) throw new Error(`PII key "${id}" must be 32 bytes (base64), got ${buf.length}`);
    keys[id] = buf;
  }
  if (!keys[activeKeyId]) throw new Error(`PII_ENCRYPTION_ACTIVE_KEY_ID "${activeKeyId}" not present in PII_ENCRYPTION_KEYS`);
  cachedRing = { keys, activeKeyId };
  return cachedRing;
}

/** True when encryption keys are configured. */
export function isEncryptionConfigured(): boolean {
  return loadKeyRing() !== null;
}

/** True if a stored value is one of our encrypted envelopes. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

/**
 * Encrypt a plaintext string into the self-describing envelope. Throws if no key
 * is configured (never silently returns plaintext). Use encryptOptional() for
 * nullable fields.
 */
export function encrypt(plaintext: string): string {
  const ring = loadKeyRing();
  if (!ring) throw new Error("Encryption is not configured (PII_ENCRYPTION_KEYS unset)");
  const key = ring.keys[ring.activeKeyId]!;
  const iv = crypto.randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, ring.activeKeyId, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/**
 * Decrypt an envelope back to plaintext. If the value is not an encrypted
 * envelope it is returned as-is — so a column mid-migration (mixed plaintext and
 * ciphertext) reads correctly. Throws on a tampered/undecryptable envelope.
 */
export function decrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  const parts = value.split(":");
  // enc : v1 : keyId : iv : tag : ct
  if (parts.length !== 6) throw new Error("Malformed encrypted value");
  const [, , keyId, ivB64, tagB64, ctB64] = parts;
  const ring = loadKeyRing();
  if (!ring) throw new Error("Encryption is not configured; cannot decrypt");
  const key = ring.keys[keyId!];
  if (!key) throw new Error(`No key "${keyId}" available to decrypt`);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64!, "base64")), decipher.final()]).toString("utf8");
}

/** Encrypt a nullable value; passes through null/undefined unchanged. */
export function encryptOptional(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") return value;
  return encrypt(value);
}

/** Decrypt a nullable value; passes through null/undefined unchanged. */
export function decryptOptional(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") return value;
  return decrypt(value);
}

/**
 * Deterministic keyed hash (HMAC-SHA256) for values that must be *searchable*
 * while encrypted — e.g. look up a user by phone without storing the phone in
 * plaintext. Store enc(phone) for display + hmac(phone) for equality lookup.
 * Not reversible; uses the active key as the HMAC secret.
 */
export function blindIndex(value: string): string {
  const ring = loadKeyRing();
  if (!ring) throw new Error("Encryption is not configured");
  return crypto.createHmac("sha256", ring.keys[ring.activeKeyId]!).update(value.trim().toLowerCase()).digest("hex");
}
