import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INVITE_TTL_SECONDS,
  InviteTokenSecretMissingError,
  inviteTtlLabel,
  mintInviteToken,
  verifyInviteToken,
} from "../invite-token";
import {
  mintPasswordResetToken,
  passwordHashFingerprint,
  verifyPasswordResetToken,
} from "../password-reset";

const SECRET = "test-signing-secret-that-is-long-enough";
const HASH = "$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const UID = "cinvitee0000001";

/** A token whose payload we choose, signed with the real invite key. */
function forge(payload: unknown, secret = SECRET): string {
  const key = createHmac("sha256", secret).update("avenick:invite-token:v1", "utf8").digest();
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = createHmac("sha256", key).update(bytes).digest();
  return `${bytes.toString("base64url")}.${sig.toString("base64url")}`;
}

describe("invitation acceptance tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_SECRET", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips: a minted token states its purpose, uid, expiry and fingerprint", () => {
    const token = mintInviteToken({ uid: UID, passwordHash: null }, NOW);
    const result = verifyInviteToken(token, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.p).toBe("invite");
    expect(result.payload.uid).toBe(UID);
    expect(result.payload.exp).toBe(Math.floor(NOW / 1000) + INVITE_TTL_SECONDS);
    // An invitee has no password, so the fingerprint is the one taken over the
    // literal "none" — the case that makes single use work without a column.
    expect(result.payload.hf).toBe(passwordHashFingerprint(null));
    expect(result.payload.hf).toBe(passwordHashFingerprint(undefined));
  });

  it("refuses to mint without a signing secret rather than sign with an empty key", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "   ");
    expect(() => mintInviteToken({ uid: UID, passwordHash: null }, NOW)).toThrow(InviteTokenSecretMissingError);
    expect(verifyInviteToken("anything.at-all", NOW)).toEqual({ ok: false, reason: "no-secret" });
  });

  it("expires exactly at the TTL", () => {
    const token = mintInviteToken({ uid: UID, passwordHash: null }, NOW);
    const ttlMs = INVITE_TTL_SECONDS * 1000;
    expect(verifyInviteToken(token, NOW + ttlMs - 1000).ok).toBe(true);
    expect(verifyInviteToken(token, NOW + ttlMs)).toEqual({ ok: false, reason: "expired" });
    expect(verifyInviteToken(token, NOW + ttlMs * 10)).toEqual({ ok: false, reason: "expired" });
  });

  it("promises the expiry it enforces", () => {
    expect(inviteTtlLabel()).toBe("7 days");
    expect(inviteTtlLabel(86_400)).toBe("1 day");
    expect(inviteTtlLabel(2 * 3600)).toBe("2 hours");
    expect(inviteTtlLabel(90)).toBe("90 seconds");
  });

  it("rejects a tampered signature, a tampered payload and a foreign secret", () => {
    const token = mintInviteToken({ uid: UID, passwordHash: null }, NOW);
    const [payload, sig] = token.split(".") as [string, string];

    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(verifyInviteToken(`${payload}.${flipped}`, NOW)).toEqual({ ok: false, reason: "signature" });
    // A length mismatch must answer, not throw out of timingSafeEqual.
    expect(verifyInviteToken(`${payload}.${sig.slice(0, 10)}`, NOW)).toEqual({ ok: false, reason: "signature" });

    // The uid cannot be swapped under a signature that was made for another one.
    const swapped = Buffer.from(
      JSON.stringify({ v: 1, p: "invite", uid: "cvictim00000001", exp: Math.floor(NOW / 1000) + INVITE_TTL_SECONDS, hf: passwordHashFingerprint(null) }),
      "utf8",
    ).toString("base64url");
    expect(verifyInviteToken(`${swapped}.${sig}`, NOW)).toEqual({ ok: false, reason: "signature" });

    vi.stubEnv("AUTH_SECRET", "another-deployment-entirely");
    expect(verifyInviteToken(token, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects garbage without trusting anything inside it", () => {
    for (const bad of ["", "no-dot", "a.b.c", "!!!.???", `${"x".repeat(5000)}.y`]) {
      const result = verifyInviteToken(bad, NOW);
      expect(result.ok).toBe(false);
    }
    // Signed by us, but not the statement this module makes.
    expect(verifyInviteToken(forge({ v: 1, p: "reset", uid: UID, exp: Math.floor(NOW / 1000) + 60, hf: passwordHashFingerprint(null) }), NOW))
      .toEqual({ ok: false, reason: "malformed" });
    expect(verifyInviteToken(forge({ v: 1, uid: UID, exp: Math.floor(NOW / 1000) + 60, hf: passwordHashFingerprint(null) }), NOW))
      .toEqual({ ok: false, reason: "malformed" });
  });

  /**
   * The whole reason the invite key is derived rather than reused. Without it,
   * a password-reset token would be an acceptance token — every reset link ever
   * mailed would gain the power to activate a pending account — and an
   * acceptance token would be a reset link. Both directions are pinned because
   * a future refactor could break either one alone.
   */
  it("is not interchangeable with a password-reset token, in either direction", () => {
    const invite = mintInviteToken({ uid: UID, passwordHash: null }, NOW);
    const reset = mintPasswordResetToken({ uid: UID, passwordHash: HASH }, NOW);

    expect(verifyPasswordResetToken(invite, NOW)).toEqual({ ok: false, reason: "signature" });
    expect(verifyInviteToken(reset, NOW)).toEqual({ ok: false, reason: "signature" });

    // And not merely because the payloads differ: a reset payload signed with
    // the reset key stays unusable here even when it carries the invite claim.
    const resetKeyed = (() => {
      const bytes = Buffer.from(
        JSON.stringify({ v: 1, p: "invite", uid: UID, exp: Math.floor(NOW / 1000) + 60, hf: passwordHashFingerprint(null) }),
        "utf8",
      );
      const sig = createHmac("sha256", SECRET).update(bytes).digest();
      return `${bytes.toString("base64url")}.${sig.toString("base64url")}`;
    })();
    expect(verifyInviteToken(resetKeyed, NOW)).toEqual({ ok: false, reason: "signature" });
  });
});
