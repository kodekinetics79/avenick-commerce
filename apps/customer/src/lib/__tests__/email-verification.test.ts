import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintPasswordResetToken, verifyPasswordResetToken } from "../password-reset";
import { mintInviteToken, verifyInviteToken } from "../invite-token";
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  EmailVerificationSecretMissingError,
  emailVerificationTtlLabel,
  mintEmailVerificationToken,
  verifyEmailVerificationToken,
} from "../email-verification";

const SECRET = "test-signing-secret-that-is-long-enough";
const HASH = "$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const UID = "cuser0000000001";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("email-verification tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_SECRET", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  /**
   * THE PROPERTY THE DERIVED KEY EXISTS FOR.
   *
   * All three mailed credentials on this portal are HMACs minted from the SAME
   * deployment secret. If they were separated only by a `p` claim they would be
   * interchangeable, because password-reset.ts's PayloadSchema is a non-strict
   * zod object and ignores unknown keys — so a token that merely lets a stranger
   * CONFIRM an address would also let them CLAIM the account and activate it.
   *
   * These are the tests that fail the moment somebody "simplifies" the key
   * derivation into a shared signer with a purpose argument.
   */
  describe("the three token families are not interchangeable", () => {
    it("a confirmation does not verify as an invitation", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      expect(verifyEmailVerificationToken(token, NOW).ok).toBe(true);

      const crossed = verifyInviteToken(token, NOW);
      expect(crossed.ok).toBe(false);
      if (crossed.ok) return;
      // Rejected on the SIGNATURE, before anything inside it is parsed.
      expect(crossed.reason).toBe("signature");
    });

    it("an invitation does not verify as a confirmation", () => {
      const token = mintInviteToken({ uid: UID, passwordHash: null }, NOW);
      expect(verifyInviteToken(token, NOW).ok).toBe(true);

      const crossed = verifyEmailVerificationToken(token, NOW);
      expect(crossed.ok).toBe(false);
      if (crossed.ok) return;
      expect(crossed.reason).toBe("signature");
    });

    it("a password reset verifies as neither", () => {
      const token = mintPasswordResetToken({ uid: UID, passwordHash: HASH }, NOW);
      expect(verifyPasswordResetToken(token, NOW).ok).toBe(true);
      expect(verifyInviteToken(token, NOW).ok).toBe(false);
      expect(verifyEmailVerificationToken(token, NOW).ok).toBe(false);
    });

    it("and a confirmation does not verify as a password reset", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      expect(verifyPasswordResetToken(token, NOW).ok).toBe(false);
    });
  });

  describe("round trip", () => {
    it("states its uid and expiry", () => {
      const result = verifyEmailVerificationToken(mintEmailVerificationToken(UID, NOW), NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.uid).toBe(UID);
      expect(result.payload.p).toBe("email-verification");
      expect(result.payload.exp).toBe(Math.floor(NOW / 1000) + EMAIL_VERIFICATION_TTL_SECONDS);
    });

    it("carries NO password fingerprint", () => {
      // Deliberate, and the one real difference from an invitation: the
      // applicant already chose a password when they applied, so a hash
      // fingerprint would never change and would buy nothing. Single use comes
      // from the join request's own state machine instead.
      const result = verifyEmailVerificationToken(mintEmailVerificationToken(UID, NOW), NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload).not.toHaveProperty("hf");
    });
  });

  describe("refusals", () => {
    it("refuses a token one second past its expiry", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      const result = verifyEmailVerificationToken(token, NOW + (EMAIL_VERIFICATION_TTL_SECONDS + 1) * 1000);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("expired");
    });

    it("rejects a tampered payload", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      const signature = token.split(".")[1];
      const forged = Buffer.from(
        JSON.stringify({ v: 1, p: "email-verification", uid: "cuser0000000002", exp: Math.floor(NOW / 1000) + 600 }),
        "utf8",
      ).toString("base64url");
      const result = verifyEmailVerificationToken(`${forged}.${signature}`, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("signature");
    });

    it("rejects malformed input without throwing", () => {
      for (const bad of ["", "no-dot", "a.b.c", "!!.??", `${"x".repeat(5000)}.y`]) {
        expect(verifyEmailVerificationToken(bad, NOW).ok).toBe(false);
      }
    });

    it("refuses to mint without a secret rather than signing under an empty key", () => {
      vi.stubEnv("AUTH_SECRET", "");
      vi.stubEnv("NEXTAUTH_SECRET", "");
      expect(() => mintEmailVerificationToken(UID, NOW)).toThrow(EmailVerificationSecretMissingError);
      const result = verifyEmailVerificationToken("anything.atall", NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("no-secret");
    });

    it("treats a whitespace-only secret as unset", () => {
      vi.stubEnv("AUTH_SECRET", "   ");
      vi.stubEnv("NEXTAUTH_SECRET", "");
      expect(() => mintEmailVerificationToken(UID, NOW)).toThrow(EmailVerificationSecretMissingError);
    });

    it("does not verify a token minted under a different deployment secret", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      vi.stubEnv("AUTH_SECRET", "a-completely-different-deployment-secret");
      const result = verifyEmailVerificationToken(token, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("signature");
    });
  });

  describe("ttl label", () => {
    it("states the TTL the way the mail that quotes it does", () => {
      expect(emailVerificationTtlLabel()).toBe("1 day");
      expect(emailVerificationTtlLabel(2 * 86400)).toBe("2 days");
      expect(emailVerificationTtlLabel(2 * 3600)).toBe("2 hours");
      expect(emailVerificationTtlLabel(30 * 60)).toBe("30 minutes");
      expect(emailVerificationTtlLabel(45)).toBe("45 seconds");
    });
  });
});
