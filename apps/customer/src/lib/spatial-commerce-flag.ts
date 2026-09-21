export interface SpatialCommerceRuntime {
  enabled: boolean;
  fixtureMode: boolean;
}

export const SPATIAL_COMMERCE_ROUTE = "/b2b/spatial-commerce";

/**
 * Synthetic spatial SKUs may be rendered only in an explicitly enabled local,
 * test, or Vercel preview environment. Vercel builds previews with
 * NODE_ENV=production, so NODE_ENV alone cannot distinguish a review deployment
 * from the live storefront. VERCEL_ENV=production always wins and fails closed.
 */
export function isSpatialFixtureEnvironment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return true;
  return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}

export function getSpatialCommerceRuntime(
  env: Record<string, string | undefined> = process.env,
): SpatialCommerceRuntime {
  const enabled = env.SPATIAL_COMMERCE_3D_ENABLED === "true";
  const fixtureMode =
    enabled && env.SPATIAL_COMMERCE_FIXTURES === "true" && isSpatialFixtureEnvironment(env);
  return { enabled, fixtureMode };
}

export function shouldBlockSpatialCommerceRequest(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
) {
  const isSpatialRoute =
    pathname === SPATIAL_COMMERCE_ROUTE || pathname === `${SPATIAL_COMMERCE_ROUTE}/`;
  return isSpatialRoute && !getSpatialCommerceRuntime(env).enabled;
}
