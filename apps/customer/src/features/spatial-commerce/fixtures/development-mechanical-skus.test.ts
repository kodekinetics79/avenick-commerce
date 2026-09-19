import { describe, expect, it } from "vitest";
import { getDevelopmentMechanicalFixture } from "./development-mechanical-skus";

describe("development mechanical fixture", () => {
  it("is visibly synthetic and contains no customer identity fields", () => {
    const fixture = getDevelopmentMechanicalFixture({ NODE_ENV: "test" });
    const serialized = JSON.stringify(fixture);

    expect(fixture.fixtureOnly).toBe(true);
    expect(
      fixture.skus.every(
        (item) => item.sku.startsWith("FIX-MECH-") && item.name.startsWith("Fixture"),
      ),
    ).toBe(true);
    expect(serialized).not.toMatch(/customer|company|email|phone|address/i);
    expect(fixture.bindings).toEqual([
      { skuId: "fixture-sku-bearing-01", targetIds: ["mounting-plate"] },
      {
        skuId: "fixture-sku-fastener-02",
        targetIds: ["motor-housing", "drive-shaft", "output-coupling"],
      },
    ]);
  });

  it("is available to an explicitly enabled Vercel preview build", () => {
    expect(() =>
      getDevelopmentMechanicalFixture({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      }),
    ).not.toThrow();
  });

  it("cannot be obtained in Vercel production", () => {
    expect(() =>
      getDevelopmentMechanicalFixture({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/unavailable outside local, test, and preview environments/i);
  });
});
