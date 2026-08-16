import { describe, expect, it } from "vitest";
import { emptyCategoryRecoveryHref } from "./catalog-navigation";

describe("empty category recovery", () => {
  it("returns a stale public category link to the populated catalog", () => {
    expect(emptyCategoryRecoveryHref({})).toBe("/products");
  });

  it("preserves governed storefront context", () => {
    expect(emptyCategoryRecoveryHref({ b2b: "true", currency: "SAR" })).toBe("/products?b2b=true&currency=SAR");
  });
});
