import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RESET_TTL_SECONDS,
  PasswordResetSecretMissingError,
  fingerprintMatches,
  mintPasswordResetToken,
  passwordHashFingerprint,
  passwordResetTtlLabel,
  resolvePasswordResetSecret,
  verifyPasswordResetToken,
} from "../password-reset";

const SECRET = "test-signing-secret-that-is-long-enough";
const HASH = "$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OTHER_HASH = "$2a$12$zyxwvutsrqponmlkjihgfeZYXWVUTSRQPONMLKJIHGFEDCBA9876543210";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

/** A token whose payload we choose, signed with the real key — for shape tests. */
function forge(payload: unknown, secret = SECRET): string {
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = createHmac("sha256", secret).update(bytes).digest();
  return `${bytes.toString("base64url")}.${sig.toString("base64url")}`;
}

describe("password reset tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_SECRET", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips: a minted token verifies and states uid, expiry and fingerprint", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    const result = verifyPasswordResetToken(token, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.uid).toBe("cuser0000000001");
    expect(result.payload.exp).toBe(Math.floor(NOW / 1000) + PASSWORD_RESET_TTL_SECONDS);
    expect(result.payload.hf).toBe(passwordHashFingerprint(HASH));
    expect(fingerprintMatches(result.payload.hf, HASH)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    const [payload, sig] = token.split(".") as [string, string];
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(verifyPasswordResetToken(`${payload}.${flipped}`, NOW)).toEqual({ ok: false, reason: "signature" });
    // Truncated signature: a length mismatch must answer, not throw.
    expect(verifyPasswordResetToken(`${payload}.${sig.slice(0, 10)}`, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a tampered payload — the uid cannot be swapped under a valid signature", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    const [, sig] = token.split(".") as [string, string];
    const swapped = Buffer.from(
      JSON.stringify({ v: 1, uid: "cvictim000000001", exp: Math.floor(NOW / 1000) + PASSWORD_RESET_TTL_SECONDS, hf: passwordHashFingerprint(HASH) }),
      "utf8",
    ).toString("base64url");
    expect(verifyPasswordResetToken(`${swapped}.${sig}`, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    vi.stubEnv("AUTH_SECRET", "another-deployment-entirely");
    expect(verifyPasswordResetToken(token, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("expires exactly at the TTL", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    const ttlMs = PASSWORD_RESET_TTL_SECONDS * 1000;
    expect(verifyPasswordResetToken(token, NOW + ttlMs - 1000).ok).toBe(true);
    expect(verifyPasswordResetToken(token, NOW + ttlMs)).toEqual({ ok: false, reason: "expired" });
    expect(verifyPasswordResetToken(token, NOW + ttlMs * 10)).toEqual({ ok: false, reason: "expired" });
  });

  it("is single-use through the fingerprint: a changed hash no longer matches", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    const result = verifyPasswordResetToken(token, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Redeeming writes a new hash; the same token is then refused by the caller.
    expect(fingerprintMatches(result.payload.hf, OTHER_HASH)).toBe(false);
    expect(fingerprintMatches(result.payload.hf, null)).toBe(false);
  });

  it("fingerprints an account with no password yet, without leaking the hash into the token", () => {
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: null }, NOW);
    expect(token).not.toContain(HASH.slice(0, 12));
    const result = verifyPasswordResetToken(token, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fingerprintMatches(result.payload.hf, null)).toBe(true);
    expect(fingerprintMatches(result.payload.hf, HASH)).toBe(false);
    // The hash itself never appears in a token minted against it.
    const withHash = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    expect(Buffer.from(withHash.split(".")[0]!, "base64url").toString("utf8")).not.toContain(HASH);
  });

  it("refuses to mint or verify without a signing secret", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(resolvePasswordResetSecret()).toBeUndefined();
    expect(() => mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW)).toThrow(
      PasswordResetSecretMissingError,
    );
    expect(verifyPasswordResetToken(forge({ v: 1, uid: "x", exp: 1, hf: "0".repeat(16) }), NOW)).toEqual({
      ok: false,
      reason: "no-secret",
    });
  });

  it("treats a whitespace-only secret as unset and falls back to NEXTAUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "   ");
    vi.stubEnv("NEXTAUTH_SECRET", SECRET);
    expect(resolvePasswordResetSecret()).toBe(SECRET);
    const token = mintPasswordResetToken({ uid: "cuser0000000001", passwordHash: HASH }, NOW);
    expect(verifyPasswordResetToken(token, NOW).ok).toBe(true);
  });

  it("answers 'malformed' for anything that is not a token, without throwing", () => {
    for (const bad of ["", "abc", "a.b.c", "not base64!.sig", "..", "x".repeat(5000)]) {
      expect(verifyPasswordResetToken(bad, NOW)).toEqual({ ok: false, reason: "malformed" });
    }
    expect(verifyPasswordResetToken(undefined as unknown as string, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("checks the signature before trusting the payload's shape", () => {
    // Correctly signed, but not a statement this version understands.
    const future = Math.floor(NOW / 1000) + PASSWORD_RESET_TTL_SECONDS;
    expect(verifyPasswordResetToken(forge({ v: 2, uid: "cuser0000000001", exp: future, hf: "0".repeat(16) }), NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyPasswordResetToken(forge({ v: 1, uid: "", exp: future, hf: "0".repeat(16) }), NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyPasswordResetToken(forge({ v: 1, uid: "cuser0000000001", exp: future, hf: "not-hex" }), NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
    // Signed JSON that is not an object at all.
    expect(verifyPasswordResetToken(forge("just a string"), NOW)).toEqual({ ok: false, reason: "malformed" });
    // The same shape, unsigned, is a signature failure — never parsed.
    expect(verifyPasswordResetToken(forge({ v: 2 }, "wrong-secret"), NOW)).toEqual({ ok: false, reason: "signature" });
  });
});

describe("passwordResetTtlLabel", () => {
  it("derives the promise printed in the UI from the enforced constant", () => {
    const minutes = PASSWORD_RESET_TTL_SECONDS / 60;
    expect(PASSWORD_RESET_TTL_SECONDS % 60).toBe(0);
    expect(passwordResetTtlLabel()).toBe(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  });

  it("names whole hours and whole minutes, and refuses to round anything else", () => {
    expect(passwordResetTtlLabel(3600)).toBe("1 hour");
    expect(passwordResetTtlLabel(7200)).toBe("2 hours");
    expect(passwordResetTtlLabel(60)).toBe("1 minute");
    expect(passwordResetTtlLabel(900)).toBe("15 minutes");
    expect(passwordResetTtlLabel(90)).toBe("90 seconds");
    expect(passwordResetTtlLabel(1)).toBe("1 second");
  });
});
