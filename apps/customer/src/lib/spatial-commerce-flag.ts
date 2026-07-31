export interface SpatialCommerceRuntime {
  enabled: boolean;
  fixtureMode: boolean;
}

export const SPATIAL_COMMERCE_ROUTE = "/b2b/spatial-commerce";

export function getSpatialCommerceRuntime(env: Record<string, string | undefined> = process.env): SpatialCommerceRuntime {
  const enabled = env.SPATIAL_COMMERCE_3D_ENABLED === "true";
  const fixtureMode = enabled
    && env.NODE_ENV !== "production"
    && env.SPATIAL_COMMERCE_FIXTURES === "true";
  return { enabled, fixtureMode };
}

export function shouldBlockSpatialCommerceRequest(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
) {
  const isSpatialRoute = pathname === SPATIAL_COMMERCE_ROUTE || pathname === `${SPATIAL_COMMERCE_ROUTE}/`;
  return isSpatialRoute && !getSpatialCommerceRuntime(env).enabled;
}
