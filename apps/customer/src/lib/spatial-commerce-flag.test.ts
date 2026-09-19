import { describe, expect, it } from "vitest";
import {
  getSpatialCommerceRuntime,
  isSpatialFixtureEnvironment,
  shouldBlockSpatialCommerceRequest,
} from "./spatial-commerce-flag";

describe("spatial commerce feature flag", () => {
  it("is disabled by default", () => {
    expect(getSpatialCommerceRuntime({})).toEqual({ enabled: false, fixtureMode: false });
  });

  it("permits fixtures in explicit local and test environments", () => {
    const flags = {
      SPATIAL_COMMERCE_3D_ENABLED: "true",
      SPATIAL_COMMERCE_FIXTURES: "true",
    };

    expect(getSpatialCommerceRuntime({ ...flags, NODE_ENV: "development" })).toEqual({
      enabled: true,
      fixtureMode: true,
    });
    expect(getSpatialCommerceRuntime({ ...flags, NODE_ENV: "test" })).toEqual({
      enabled: true,
      fixtureMode: true,
    });
  });

  it("permits an explicitly enabled Vercel preview even though its NODE_ENV is production", () => {
    expect(
      getSpatialCommerceRuntime({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        SPATIAL_COMMERCE_3D_ENABLED: "true",
        SPATIAL_COMMERCE_FIXTURES: "true",
      }),
    ).toEqual({ enabled: true, fixtureMode: true });
  });

  it("fails closed for Vercel production regardless of NODE_ENV", () => {
    expect(
      isSpatialFixtureEnvironment({
        NODE_ENV: "development",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
    expect(
      getSpatialCommerceRuntime({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        SPATIAL_COMMERCE_3D_ENABLED: "true",
        SPATIAL_COMMERCE_FIXTURES: "true",
      }),
    ).toEqual({ enabled: true, fixtureMode: false });
  });
});

describe("shouldBlockSpatialCommerceRequest", () => {
  it("blocks canonical and trailing-slash routes before auth when disabled", () => {
    expect(shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce", {})).toBe(true);
    expect(shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce/", {})).toBe(true);
  });

  it("does not intercept enabled or unrelated routes", () => {
    expect(
      shouldBlockSpatialCommerceRequest("/b2b/spatial-commerce", {
        SPATIAL_COMMERCE_3D_ENABLED: "true",
      }),
    ).toBe(false);
    expect(shouldBlockSpatialCommerceRequest("/b2b", {})).toBe(false);
  });
});
