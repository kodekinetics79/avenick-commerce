import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@avenick/auth/safe-redirect";
import { identityCopy, loginSubtitle } from "@/app/auth/identity-copy";

/**
 * Tapping "Request availability" on a product card sends an anonymous visitor
 * to /login?callbackUrl=/b2b/rfq/new?supplier=…&product=…, and the page told
 * them "Welcome back — Sign in to see your orders, returns and support tickets."
 * Nothing on the screen mentioned the request they had just asked to make.
 *
 * The subtitle is now chosen from the validated destination. These hold the
 * order of precedence and that the choice reads the SAFE value, never the raw
 * query string.
 */
describe("the sign-in subtitle follows the validated destination", () => {
  const en = identityCopy("en").login;
  const ar = identityCopy("ar").login;
  const pick = (raw: string | null, justRegistered = false) =>
    loginSubtitle(en, { justRegistered, returnTo: safeReturnTo(raw, "") });

  it("names the quote request when the visitor is headed to one", () => {
    expect(pick("/b2b/rfq/new?supplier=s1&product=p1")).toBe(en.subtitleQuote);
    expect(pick("/b2b/rfq/new")).toBe(en.subtitleQuote);
    expect(en.subtitleQuote).toMatch(/quote request/i);
    expect(ar.subtitleQuote).toMatch(/[؀-ۿ]/);
  });

  it("keeps the generic line for every other destination", () => {
    expect(pick(null)).toBe(en.subtitle);
    expect(pick("/checkout")).toBe(en.subtitle);
    expect(pick("/b2b/rfq")).toBe(en.subtitle);
    expect(pick("/b2b/rfq/new-thing")).toBe(en.subtitle);
  });

  it("reads the validated value, so an off-site callback never selects the quote line", () => {
    expect(pick("https://evil.example/b2b/rfq/new")).toBe(en.subtitle);
    expect(pick("//evil.example/b2b/rfq/new")).toBe(en.subtitle);
  });

  it("lets 'registration received' win, because it changes which password to use", () => {
    expect(pick("/b2b/rfq/new?product=p1", true)).toBe(en.subtitleRegistered);
  });
});
