import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";

// crypto.ts caches the key ring at module scope keyed off env. Each test sets
// env then re-imports the module after resetModules() so the ring re-reads it.
const KEY_A = crypto.randomBytes(32).toString("base64");
const KEY_B = crypto.randomBytes(32).toString("base64");

async function freshCrypto(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return (await import("../crypto")) as typeof import("../crypto");
}

describe("PII field encryption", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("reports not configured when keys are absent", async () => {
    const c = await freshCrypto({
      PII_ENCRYPTION_KEYS: undefined,
      PII_ENCRYPTION_ACTIVE_KEY_ID: undefined,
    });
    expect(c.isEncryptionConfigured()).toBe(false);
    expect(() => c.encrypt("secret")).toThrow(/not configured/);
  });

  it("round-trips plaintext through encrypt/decrypt", async () => {
    const c = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    });
    const ct = c.encrypt("+966500000000");
    expect(c.isEncrypted(ct)).toBe(true);
    expect(ct).not.toContain("+966");
    expect(c.decrypt(ct)).toBe("+966500000000");
  });

  it("detects tampering via the GCM auth tag", async () => {
    const c = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    });
    const ct = c.encrypt("sensitive");
    // Flip a character in the ciphertext segment.
    const parts = ct.split(":");
    parts[5] = parts[5]!.slice(0, -2) + (parts[5]!.endsWith("AA") ? "BB" : "AA");
    expect(() => c.decrypt(parts.join(":"))).toThrow();
  });

  it("passes plaintext through decrypt for non-envelopes (mixed migration)", async () => {
    const c = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    });
    expect(c.decrypt("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("decrypts values written under an older key after rotation", async () => {
    // Encrypt with k1 active.
    const c1 = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    });
    const old = c1.encrypt("keep-readable");

    // Rotate: k2 active, but k1 still on the ring.
    const c2 = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A, k2: KEY_B }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k2",
    });
    expect(c2.decrypt(old)).toBe("keep-readable");
    // New writes use k2.
    const fresh = c2.encrypt("new");
    expect(fresh.split(":")[2]).toBe("k2");
  });

  it("blindIndex is deterministic and case-insensitive", async () => {
    const c = await freshCrypto({
      PII_ENCRYPTION_KEYS: JSON.stringify({ k1: KEY_A }),
      PII_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    });
    expect(c.blindIndex("User@Example.com")).toBe(c.blindIndex("user@example.com"));
    expect(c.blindIndex("a")).not.toBe(c.blindIndex("b"));
  });
});
