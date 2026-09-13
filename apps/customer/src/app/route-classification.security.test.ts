import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createMiddleware } from "@avenick/auth/middleware";
import { KNOWN_TOP_LEVEL_SEGMENTS } from "@/lib/route-segments";

const appRoot = dirname(fileURLToPath(import.meta.url));

/**
 * The metadata file conventions, by the first path segment Next serves each at.
 * `icon.tsx` is served at `/icon`, `robots.ts` at `/robots.txt`.
 */
const METADATA_ROUTES: Record<string, string> = {
  icon: "icon",
  "apple-icon": "apple-icon",
  "opengraph-image": "opengraph-image",
  "twitter-image": "twitter-image",
  manifest: "manifest.webmanifest",
  robots: "robots.txt",
  sitemap: "sitemap.xml",
};

/**
 * Every first path segment the file system can route, read from src/app.
 *
 * A `(group)` folder adds no segment, so its CHILDREN are top-level routes and
 * it is walked into — skipping it would be a hole, because a page moved into a
 * group would silently 404. `_private` folders and `@slot` folders are never
 * routes. A dynamic top-level segment (`[slug]`) is refused outright rather than
 * skipped: it would make every first segment routable, which a list cannot
 * express, and the middleware would 404 real pages.
 */
function routedTopLevelSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith("@")) return [];
      if (/^\([^.)][^)]*\)$/.test(entry.name)) return routedTopLevelSegments(join(dir, entry.name));
      if (entry.name.startsWith("[")) {
        throw new Error(
          `src/app/${entry.name} is a dynamic top-level segment. The middleware's known-segment list cannot ` +
            `express it; revisit KNOWN_TOP_LEVEL_SEGMENTS before adding one.`,
        );
      }
      return [entry.name];
    }
    const convention = entry.name.match(/^([a-z-]+)\.(?:tsx?|jsx?)$/)?.[1];
    const served = convention ? METADATA_ROUTES[convention] : undefined;
    return served ? [served] : [];
  });
}

/**
 * The 404 branch in the middleware is only as good as the list it is given.
 *
 * Unknown customer URLs used to answer `307 -> /login`, so no visitor or crawler
 * ever saw the 404 page. The middleware now rewrites any path whose first
 * segment is not on KNOWN_TOP_LEVEL_SEGMENTS to the 404. That branch fails
 * closed, so a forgotten entry breaks a page rather than opening one — and this
 * test is what makes the forgotten entry a failing build instead of a broken
 * page in production. It also fails on a stale entry, because a listed segment
 * with no route behind it is a path the middleware sends to sign in for nothing.
 */
describe("route classification", () => {
  it("lists exactly the first segments src/app can route", () => {
    const onDisk = [...new Set(routedTopLevelSegments(appRoot))].sort();
    expect([...KNOWN_TOP_LEVEL_SEGMENTS].sort()).toEqual(onDisk);
  });

  const middleware = createMiddleware("customer", undefined, { knownTopLevelSegments: KNOWN_TOP_LEVEL_SEGMENTS });
  const visit = (path: string) => middleware(new NextRequest(`https://storefront.test${path}`));

  it.each(["/this-page-does-not-exist", "/definitely-not-a-route", "/admin", "/dashboard", "/.env"])(
    "answers anonymous %s with the 404, not the sign-in page",
    async (path) => {
      const res = await visit(path);
      expect(res.headers.get("location"), `${path} was redirected`).toBeNull();
      expect(new URL(res.headers.get("x-middleware-rewrite") ?? "http://x/").pathname).toBe("/_unrouted");
    },
  );

  /**
   * Every private surface of the storefront, one path per top-level segment
   * that holds one. Being a known segment must not have made any of them public.
   */
  it.each([
    "/account",
    "/account/orders",
    "/orders",
    "/orders/some-order",
    "/checkout",
    "/b2b/team",
    "/b2b/purchase-orders/new",
    "/b2b/spatial-commerce",
    "/auth/accept-invite",
  ])("still sends anonymous %s to sign in", async (path) => {
    const res = await visit(path);
    expect(res.status, path).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it.each(["/", "/products", "/categories/some-slug", "/about", "/b2b", "/b2b/register", "/b2b/join", "/robots.txt", "/sitemap.xml"])(
    "leaves %s to the page",
    async (path) => {
      const res = await visit(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("x-middleware-rewrite"), `${path} was rewritten to the 404`).toBeNull();
    },
  );

  /**
   * public/ is the other thing Next serves at a top-level path, and it is not in
   * src/app, so the list above cannot see it: /hero/workshop-1600.jpg has the
   * first segment "hero", which names no route. Those files are served because
   * the middleware's static-asset rule skips them by extension before the
   * unrouted branch runs. A file added with an extension that rule does not know
   * would be rewritten to the 404, so every file there is checked here.
   */
  it("serves every file in public/ rather than rewriting it to the 404", async () => {
    const publicRoot = join(appRoot, "..", "..", "public");
    const files = readdirSync(publicRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `/${relative(publicRoot, join(entry.parentPath, entry.name)).split(sep).join("/")}`);
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      const res = await visit(path);
      expect(res.headers.get("x-middleware-rewrite"), `${path} was rewritten to the 404`).toBeNull();
      expect(res.headers.get("location"), `${path} was redirected`).toBeNull();
    }
  });
});
