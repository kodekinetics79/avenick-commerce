import { describe, expect, it } from "vitest";
import { browseAllHref } from "./catalog-navigation";

describe("browse-all link from an empty category", () => {
  it("points at the unfiltered catalog", () => {
    expect(browseAllHref({})).toBe("/products");
  });

  it("preserves governed storefront context", () => {
    expect(browseAllHref({ b2b: "true", currency: "SAR" })).toBe("/products?b2b=true&currency=SAR");
  });

  it("ignores a non-'true' b2b flag rather than forwarding it", () => {
    expect(browseAllHref({ b2b: "false", currency: "AED" })).toBe("/products?currency=AED");
  });

  it("drops the category, since this link is the deliberate escape from it", () => {
    // The category must never be silently reapplied here — the visitor is
    // choosing to leave an empty category, not to stay filtered inside it.
    expect(browseAllHref({ b2b: "true" } as Record<string, string>)).toBe("/products?b2b=true");
  });
});
