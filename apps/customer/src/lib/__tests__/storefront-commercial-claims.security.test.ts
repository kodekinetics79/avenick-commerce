import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

describe("storefront commercial claims", () => {
  it("does not advertise unimplemented shipping, escrow, or fabricated marketplace scale", () => {
    const renderedClaims = JSON.stringify({ en, ar });

    expect(renderedClaims).not.toMatch(/free delivery|escrow|48,000|2,400|integrated 3pl/i);
    // These three strings each carry a disclosure, not a phrasing. Copy gets
    // rewritten; what must survive a rewrite is the substance — delivery terms
    // are not settled up front, and online payment is not actually available.
    // Assert the meaning so an editor can improve the sentence but cannot
    // quietly delete the limitation it discloses.
    expect(en.common.freeDelivery).toMatch(/confirmed/i);
    expect(en.common.freeDelivery).not.toMatch(/shown at checkout|calculated at checkout/i);
    expect(en.home.prop2Desc).toMatch(/bank transfer/i);
    expect(en.home.prop2Desc).toMatch(/online[\w\s]*methods? (remain |are )?unavailable/i);
    expect(en.home.prop3Desc).toMatch(/confirmed/i);
    // The Arabic tree carries the same two disclosures; a locale that quietly
    // drops one is how a promise reaches half the market unchallenged.
    expect(ar.home.prop2Desc).toMatch(/غير متاحة/);
    expect(ar.common.freeDelivery).toMatch(/تأكيد/);
  });
});
