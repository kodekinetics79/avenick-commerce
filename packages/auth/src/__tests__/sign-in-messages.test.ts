import { describe, it, expect } from "vitest";
import { messageForSignInError, messageForSignInErrorBilingual } from "../sign-in-messages";

describe("sign-in error messaging", () => {
  it("tells a throttled user they are throttled, not that their password is wrong", () => {
    // Telling a rate-limited user their credentials are invalid makes them
    // retry — spending more of an already exhausted budget — and can send them
    // to a password reset they never needed.
    const message = messageForSignInError("rate_limited");
    expect(message).toMatch(/too many/i);
    expect(message).not.toMatch(/invalid email or password/i);
  });

  it("falls back to the generic credential message for a real rejection", () => {
    expect(messageForSignInError("CredentialsSignin")).toMatch(/invalid email or password/i);
  });

  it("never reveals whether an account exists", () => {
    for (const code of ["CredentialsSignin", "AccessDenied", "Verification", "unknown_code"]) {
      const message = messageForSignInError(code);
      expect(message).not.toMatch(/no account|not found|does not exist|unknown user/i);
    }
  });

  it("returns nothing when there is no error", () => {
    expect(messageForSignInError(null)).toBe("");
    expect(messageForSignInError(undefined)).toBe("");
    expect(messageForSignInError("")).toBe("");
  });

  it("keeps the bilingual variant bilingual for both outcomes", () => {
    const throttled = messageForSignInErrorBilingual("rate_limited");
    const rejected = messageForSignInErrorBilingual("CredentialsSignin");
    // Arabic must be present, or the RTL storefront degrades to English-only.
    expect(throttled).toMatch(/[؀-ۿ]/);
    expect(rejected).toMatch(/[؀-ۿ]/);
    expect(throttled).not.toBe(rejected);
  });
});
