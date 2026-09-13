import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

/**
 * The storefront's commercial claims, held by meaning rather than by phrasing.
 *
 * This file used to assert on home.prop2Desc and home.prop3Desc — honest
 * disclosures that no page rendered. The panel the home page actually showed
 * carried the opposite claims (a payment-method menu, "priced before you
 * commit", "complete buyer protection"), and this test stayed green the whole
 * time, because it was guarding keys instead of what a buyer reads. Those dead
 * keys are gone. The home panel's live rows are held, key by key and with a
 * check that the page renders them, by app/__tests__/home-assurances.security.test.ts.
 *
 * What stays here is what no single page owns: the site-wide copy every visitor
 * and every search result sees.
 */
describe("storefront commercial claims", () => {
  it("does not advertise unimplemented shipping, escrow, or fabricated marketplace scale", () => {
    const renderedClaims = JSON.stringify({ en, ar });

    expect(renderedClaims).not.toMatch(/free delivery|escrow|48,000|2,400|integrated 3pl/i);
    // The utility strip on every page carries a disclosure, not a phrasing:
    // delivery terms are not settled up front. An editor may improve the
    // sentence but may not delete the limitation it discloses.
    expect(en.common.freeDelivery).toMatch(/confirmed/i);
    expect(en.common.freeDelivery).not.toMatch(/shown at checkout|calculated at checkout/i);
    expect(ar.common.freeDelivery).toMatch(/تأكيد/);
  });

  it("does not describe a consumer shop in the copy that frames the whole site", () => {
    // The footer tagline, the meta description (search results, share cards and
    // the manifest all read it) said "B2C-ready", "consumer buying" and "order
    // directly" over a catalogue in which no product is sellable to a consumer.
    // A quote-only marketplace can say it is B2B; it cannot say it is a shop.
    const framing = [en.common.metaDescription, en.footer.tagline].join(" • ");
    expect(framing).not.toMatch(/B2C|consumer|order directly|buy with confidence/i);
    const framingAr = [ar.common.metaDescription, ar.footer.tagline].join(" • ");
    expect(framingAr).not.toMatch(/للأفراد|المستهلك/);
  });
});
