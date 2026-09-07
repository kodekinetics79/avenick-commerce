/**
 * Portal targets for browser journey evidence — single source of truth.
 *
 * Plain ESM (not TypeScript) on purpose: Playwright and Cypress compile TS, but
 * the Puppeteer suite runs on the bare `node --test` runner. Keeping this file
 * as .mjs lets all three frameworks import the same constants without adding a
 * transpiler to the Node path.
 *
 * A single env override retargets all three frameworks at once — local dev, a
 * Vercel preview, or the deployed runtime.
 *
 * Ports match the `dev`/`start` scripts in each app's package.json.
 */

const strip = (value) => value.replace(/\/$/, "");

export const TARGETS = {
  customer: strip(process.env.E2E_CUSTOMER_URL?.trim() || "http://localhost:13100"),
  seller: strip(process.env.E2E_SELLER_URL?.trim() || "http://localhost:13101"),
  admin: strip(process.env.E2E_ADMIN_URL?.trim() || "http://localhost:13102"),
};

/** Absolute URL for a path on a given portal. */
export function url(portal, path = "/") {
  return `${TARGETS[portal]}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * True when a portal target is a loopback address — a local `next dev` or
 * `next start`, including the CI job, which pins all three portals at
 * http://localhost:1310x.
 *
 * The certification specs use this to admit exactly one class of noise that a
 * loopback target produces and a deployed one cannot: the production CSP
 * carries `upgrade-insecure-requests`, so Chromium rewrites the storefront's
 * own http://localhost:PORT subresource fetches (Next's RSC route prefetches
 * above all) to https://localhost:PORT, where nothing is listening. Against an
 * https origin the rewrite is a no-op. Nowhere else is a failed request
 * forgiven.
 */
export function isLocalTarget(portal) {
  const { hostname } = new URL(TARGETS[portal]);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Strings that must never render on an unauthenticated surface.
 * Encodes defect D-01 from AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md:
 * working credential pairs are printed on all three portal login pages.
 */
export const FORBIDDEN_ON_PUBLIC_PAGES = [
  "Password123!",
  "admin@avenick.test",
  "seller@avenick.test",
  "buyer@avenick.test",
];

/** Public, unauthenticated customer routes — safe to visit with no session. */
export const PUBLIC_CUSTOMER_ROUTES = [
  "/",
  "/products",
  "/search",
  "/brands",
  "/deals",
  "/status",
  "/support",
  "/privacy",
  "/terms",
];

/**
 * The fixed list of public routes the console-hygiene certification walks on
 * each portal. Mirrors PUBLIC_PATHS in packages/auth/src/middleware.ts: the
 * storefront is public almost everywhere, while Seller Central and the Admin
 * Console expose only their sign-in surfaces without a session and redirect
 * everything else to /login.
 */
export const PUBLIC_PORTAL_ROUTES = {
  customer: [...PUBLIC_CUSTOMER_ROUTES, "/cart", "/wishlist", "/login", "/register"],
  seller: ["/login", "/register"],
  admin: ["/login"],
};
