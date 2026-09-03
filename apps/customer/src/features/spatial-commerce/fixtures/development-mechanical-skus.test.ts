import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevelopmentMechanicalFixture } from "./development-mechanical-skus";

describe("development mechanical fixture", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is visibly synthetic and contains no customer identity fields", () => {
    vi.stubEnv("NODE_ENV", "test");
    const fixture = getDevelopmentMechanicalFixture();
    const serialized = JSON.stringify(fixture);

    expect(fixture.fixtureOnly).toBe(true);
    expect(fixture.skus.every((item) => item.sku.startsWith("FIX-MECH-") && item.name.startsWith("Fixture"))).toBe(true);
    expect(serialized).not.toMatch(/customer|company|email|phone|address/i);
    expect(fixture.bindings).toEqual([
      { skuId: "fixture-sku-bearing-01", targetIds: ["mounting-plate"] },
      {
        skuId: "fixture-sku-fastener-02",
        targetIds: ["motor-housing", "drive-shaft", "output-coupling"],
      },
    ]);
  });

  it("cannot be obtained in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getDevelopmentMechanicalFixture()).toThrow(/unavailable in production/i);
  });
});
