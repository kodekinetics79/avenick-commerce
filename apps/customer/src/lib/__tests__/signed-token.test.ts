import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintPasswordResetToken, verifyPasswordResetToken } from "../password-reset";
import {
  SignedTokenSecretMissingError,
  TOKEN_TTL_SECONDS,
  mintSignedToken,
  ttlLabel,
  verifySignedToken,
} from "../signed-token";
import { INVITATION_TTL_SECONDS, mintInvitationToken, verifyInvitationToken } from "../invitation";
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  mintEmailVerificationToken,
  verifyEmailVerificationToken,
} from "../email-verification";

const SECRET = "test-signing-secret-that-is-long-enough";
const HASH = "$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const UID = "cuser0000000001";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("signed tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_SECRET", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  /**
   * THE PROPERTY THIS MODULE EXISTS FOR.
   *
   * Every mailed credential on this portal is an HMAC under the SAME deployment
   * secret. Without the per-purpose domain tag, a token that merely lets a
   * stranger confirm an email address would also let them claim the account and
   * activate it — same key, same payload shape, same account. These are the
   * tests that would fail the moment somebody "simplifies" the tag away.
   */
  describe("purposes are not interchangeable", () => {
    it("an invitation does not verify as an email confirmation", () => {
      const token = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      expect(verifyInvitationToken(token, NOW).ok).toBe(true);

      const crossed = verifyEmailVerificationToken(token, NOW);
      expect(crossed.ok).toBe(false);
      if (crossed.ok) return;
      expect(crossed.reason).toBe("signature");
    });

    it("an email confirmation does not verify as an invitation", () => {
      const token = mintEmailVerificationToken(UID, NOW);
      expect(verifyEmailVerificationToken(token, NOW).ok).toBe(true);

      const crossed = verifyInvitationToken(token, NOW);
      expect(crossed.ok).toBe(false);
      if (crossed.ok) return;
      expect(crossed.reason).toBe("signature");
    });

    it("a password-reset token verifies as neither", () => {
      // lib/password-reset signs the BARE payload with no tag, which is exactly
      // why it can never collide with a tagged one.
      const token = mintPasswordResetToken({ uid: UID, passwordHash: HASH }, NOW);
      expect(verifyPasswordResetToken(token, NOW).ok).toBe(true);
      expect(verifyInvitationToken(token, NOW).ok).toBe(false);
      expect(verifyEmailVerificationToken(token, NOW).ok).toBe(false);
    });

    it("and neither verifies as a password reset", () => {
      const invitation = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      const confirmation = mintEmailVerificationToken(UID, NOW);
      expect(verifyPasswordResetToken(invitation, NOW).ok).toBe(false);
      expect(verifyPasswordResetToken(confirmation, NOW).ok).toBe(false);
    });
  });

  describe("round trip", () => {
    it("an invitation states its uid, expiry and password fingerprint", () => {
      const token = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      const result = verifyInvitationToken(token, NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.uid).toBe(UID);
      expect(result.payload.exp).toBe(Math.floor(NOW / 1000) + INVITATION_TTL_SECONDS);
      // The fingerprint is what makes it single-use: it is present even for an
      // account that has never had a password.
      expect(result.payload.hf).toMatch(/^[0-9a-f]{16}$/);
    });

    it("an email confirmation carries NO fingerprint", () => {
      // Deliberate: the applicant already has a password, so a hash fingerprint
      // would never change and would buy nothing. Single use comes from the
      // request's own state machine instead.
      const result = verifyEmailVerificationToken(mintEmailVerificationToken(UID, NOW), NOW);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Checked on the object rather than through `result.payload.hf`: the
      // email-verification payload type no longer carries `hf` at all, so the
      // property access stopped compiling. That is the guarantee getting
      // STRONGER — absence is now enforced by the type — and the runtime
      // assertion is kept anyway, because the type says what this code believes
      // and the test says what the token actually contains.
      expect(Object.hasOwn(result.payload, "hf")).toBe(false);
      expect(result.payload.exp).toBe(Math.floor(NOW / 1000) + EMAIL_VERIFICATION_TTL_SECONDS);
    });
  });

  describe("expiry", () => {
    it("refuses a token one second past its expiry", () => {
      const token = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      const justAfter = NOW + (INVITATION_TTL_SECONDS + 1) * 1000;
      const result = verifyInvitationToken(token, justAfter);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("expired");
    });

    it("an invitation outlives a confirmation, because it is read on somebody else's schedule", () => {
      expect(INVITATION_TTL_SECONDS).toBeGreaterThan(EMAIL_VERIFICATION_TTL_SECONDS);
    });
  });

  describe("refusals", () => {
    it("rejects a tampered payload", () => {
      const token = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      const [payload, signature] = token.split(".");
      const forged = Buffer.from(
        JSON.stringify({ v: 1, uid: "cuser0000000002", exp: Math.floor(NOW / 1000) + 600, hf: "0".repeat(16) }),
        "utf8",
      ).toString("base64url");
      expect(payload).toBeDefined();
      const result = verifySignedToken("invitation", `${forged}.${signature}`, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("signature");
    });

    it("rejects malformed input without throwing", () => {
      for (const bad of ["", "no-dot", "a.b.c", "!!.??", `${"x".repeat(5000)}.y`]) {
        const result = verifySignedToken("invitation", bad, NOW);
        expect(result.ok).toBe(false);
      }
    });

    it("refuses to mint without a secret, rather than signing under an empty key", () => {
      vi.stubEnv("AUTH_SECRET", "");
      vi.stubEnv("NEXTAUTH_SECRET", "");
      expect(() => mintInvitationToken({ uid: UID, passwordHash: null }, NOW)).toThrow(
        SignedTokenSecretMissingError,
      );
      const result = verifyInvitationToken("anything.atall", NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("no-secret");
    });

    it("treats a whitespace-only secret as unset", () => {
      vi.stubEnv("AUTH_SECRET", "   ");
      vi.stubEnv("NEXTAUTH_SECRET", "");
      expect(() => mintSignedToken({ purpose: "invitation", uid: UID, ttlSeconds: 60 }, NOW)).toThrow(
        SignedTokenSecretMissingError,
      );
    });

    it("does not verify a token minted under a different secret", () => {
      const token = mintInvitationToken({ uid: UID, passwordHash: null }, NOW);
      vi.stubEnv("AUTH_SECRET", "a-completely-different-deployment-secret");
      const result = verifyInvitationToken(token, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("signature");
    });
  });

  describe("ttlLabel", () => {
    it("states a TTL the way the copy that quotes it does", () => {
      expect(ttlLabel(TOKEN_TTL_SECONDS.invitation)).toBe("7 days");
      expect(ttlLabel(TOKEN_TTL_SECONDS["email-verification"])).toBe("1 day");
      expect(ttlLabel(2 * 3600)).toBe("2 hours");
      expect(ttlLabel(30 * 60)).toBe("30 minutes");
      expect(ttlLabel(45)).toBe("45 seconds");
    });
  });
});
