import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every public catalogue read passes the same per-IP throttle.
 *
 * `/api/products` carried the reasoning and the rule: the route is public,
 * unauthenticated, and answers from the connection pool that checkout
 * transactions hold advisory locks on, so it is the cheapest external way to
 * load the database. The routes added afterwards inherited the exposure and not
 * the rule — four of the nine public reads were unthrottled, and the most
 * expensive one of all was among them: `/recommendations` runs THREE services
 * per call and needs nothing but a product slug.
 *
 * This test is structural because the gap was structural. Nobody removed a
 * throttle; new doors were simply added to a room that had one.
 */
const API_ROOT = fileURLToPath(new URL(".", import.meta.url));

/** The public surface, as the middleware's PUBLIC_API_PATHS.customer defines it. */
const PUBLIC_PREFIXES = ["products", "categories", "brands", "signals", "cart"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

const publicReads = routeFiles(API_ROOT)
  .filter((file) => {
    const rel = file.slice(API_ROOT.length);
    if (!PUBLIC_PREFIXES.some((prefix) => rel.startsWith(prefix + "/"))) return false;
    // A webhook authenticates by signature, not by session or IP.
    return !rel.includes("webhook");
  })
  .map((file) => [file.slice(API_ROOT.length), file] as const);

describe("public catalogue reads are throttled", () => {
  it("finds the public routes", () => {
    expect(publicReads.length).toBeGreaterThanOrEqual(7);
  });

  it.each(publicReads)("%s is rate limited", (_name, file) => {
    const source = readFileSync(file, "utf8");
    expect(
      /catalogThrottle|checkRateLimit/.test(source),
      "this route is publicly reachable with no throttle — it answers from the pool checkout depends on",
    ).toBe(true);
  });

  it("shares one bucket, because the pool does not care which route spent it", () => {
    const helper = readFileSync(join(API_ROOT, "..", "..", "lib", "catalog-throttle.ts"), "utf8");
    expect(helper).toContain("RATE_LIMITS.catalogRead");
    expect(helper).toContain("clientIpFrom");
  });
});
