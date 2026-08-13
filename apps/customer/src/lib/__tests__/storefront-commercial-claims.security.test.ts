import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

describe("storefront commercial claims", () => {
  it("does not advertise unimplemented shipping, escrow, or fabricated marketplace scale", () => {
    const renderedClaims = JSON.stringify({ en, ar });

    expect(renderedClaims).not.toMatch(/free delivery|escrow|48,000|2,400|integrated 3pl/i);
    expect(en.common.freeDelivery).toContain("confirmed");
    expect(en.home.prop2Desc).toContain("online methods remain unavailable");
    expect(en.home.prop3Desc).toContain("confirmed");
  });
});
