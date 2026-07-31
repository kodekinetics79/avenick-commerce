import { describe, expect, it } from "vitest";
import { getSpatialCommerceRuntime, shouldBlockSpatialCommerceRequest } from "./spatial-commerce-flag";

describe("spatial commerce feature flag", () => {
  it("is disabled by default", () => {
    expect(getSpatialCommerceRuntime({})).toEqual({ enabled: false, fixtureMode: false });
  });

  it("permits explicit fixture data only outside production", () => {
    expect(getSpatialCommerceRuntime({ NODE_ENV: "development", SPATIAL_COMMERCE_3D_ENABLED: "true", SPATIAL_COMMERCE_FIXTURES: "true" })).toEqual({ enabled: true, fixtureMode: true });
    expect(getSpatialCommerceRuntime({ NODE_ENV: "production", SPATIAL_COMMERCE_3D_ENABLED: "true", SPATIAL_COMMERCE_FIXTURES: "true" })).toEqual({ enabled: true, fixtureMode: false });
  });
});

describe("shouldBlockSpatialCommerceRequest", () => {
  it("blocks canonical and trailing-slash routes before auth when disabled", () => {
    expect(shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce", {})).toBe(true);
    expect(shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce/", {})).toBe(true);
  });

  it("does not intercept enabled or unrelated routes", () => {
    expect(shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce", { SPATIAL_COMMERCE_3D_ENABLED: "true" })).toBe(false);
    expect(shouldBlockSpatialCommerceRequest("/b2b", {})).toBe(false);
  });
});
