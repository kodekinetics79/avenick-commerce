import { type NextRequest, NextResponse } from "next/server";
import { type Session } from "next-auth";
import type { UserRole } from "@avenick/database";
import { resolveRemotePortalSession, type PortalType } from "./remote-session";

// String literals, not `UserRole.X`. The enum OBJECT is a runtime import from
// @avenick/database, and this module is bundled into edge middleware, where
// pulling that barrel drags in the Prisma client and every request 500s. The
// type import above still checks each literal against the schema's role union,
// so a typo or a renamed role fails the build exactly as it did before.
const PORTAL_ROLE_MAP: Record<PortalType, UserRole[]> = {
  customer: ["CONSUMER", "COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"],
  seller: ["SELLER_OWNER", "SELLER_STAFF"],
  admin: ["ADMIN", "SUPER_ADMIN"],
};

// Paths that are publicly accessible (no auth required)
const PUBLIC_PATHS: Record<PortalType, string[]> = {
  customer: ["/", "/products", "/search", "/login", "/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/deals", "/brands", "/cart", "/wishlist", "/categories", "/returns", "/support", "/privacy", "/terms", "/cookies", "/status",
    // The information and policy surfaces. Every one of these must answer to a
    // visitor with no session: a shopper deciding whether to buy is exactly the
    // person who reads the returns policy, and a warranty page behind a login
    // wall is indistinguishable from not having one. They were 307ing to
    // /login the moment they were added, because any ROUTE absent from this
    // list is private by default — which is the right default, and the reason a
    // new public page has to be named here. (A path that names no route at all
    // is a different question, answered by `knownTopLevelSegments` below: it is
    // a 404, not a sign-in page.)
    "/about", "/contact", "/shipping", "/returns-policy", "/warranty",
    // The company-registration door. The page handles a visitor with no session
    // itself — it renders a sign-in prompt and the registration path — so
    // gating it here sent every prospective B2B buyer to a generic login with
    // no explanation, which is the one visitor this door exists to catch.
    "/b2b/register"],
  seller: ["/login", "/register"],
  admin: ["/login"],
};

/**
 * Public at EXACTLY this path — never its subtree.
 *
 * PUBLIC_PATHS is prefix-matched, which is right for `/products` and would be
 * a hole for `/b2b`: one entry there would unlock `/b2b/team`, `/b2b/billing`,
 * `/b2b/purchase-orders` and every other company surface at once.
 *
 * `/b2b` itself is the workspace, and it already handles a visitor it cannot
 * place: the dashboard fetch fails and the page redirects to `/b2b/register`,
 * the door built for a prospect. Gating it in the middleware replaced that with
 * a generic login — and `/b2b` is the header's own "For business" link, so the
 * one visitor the door exists to catch was the one being turned away. Same
 * reasoning as `/b2b/register` above; only the matching differs.
 */
const PUBLIC_EXACT_PATHS: Record<PortalType, string[]> = {
  customer: ["/b2b"],
  seller: [],
  admin: [],
};

// API paths that must stay public: catalog browsing and externally-signed
// webhooks (which authenticate via their own signature, not a session).
//
// `/api/brands` belongs here because `/brands` is a public page that renders
// from it. Without this entry an anonymous visitor loads a public route whose
// own data call is rejected with a 401, and the page fails.
const PUBLIC_API_PATHS: Record<PortalType, string[]> = {
  // "/api/signals" is the storefront's view beacon. It is public for the same
  // reason the catalogue is: it is emitted by anonymous browsing, which is the
  // majority of it, and an authenticated-only signal would measure logged-in
  // attention and call it "trending". It carries no personal data and cannot
  // read anything — the route only increments a per-product, per-day counter.
  // "/api/cart" is the basket's "complete your order" lookup. The cart is client
  // state, so most baskets belong to nobody the server can name; an
  // authenticated-only endpoint here would silently return 401 to every
  // anonymous shopper — the exact failure the view beacon shipped with.
  customer: ["/api/products", "/api/categories", "/api/brands", "/api/signals", "/api/cart", "/api/payments/webhook"],
  seller: [],
  admin: ["/api/integrations/inbound"],
};

/**
 * Extensions actually served as static files from /public.
 *
 * The previous check was `pathname.includes(".")`, which skipped middleware for
 * ANY path containing a dot anywhere — so `/api/orders/abc.def` bypassed
 * authentication entirely. Every route re-authenticates independently, which is
 * why that was not exploitable, but the middleware was not a dependable
 * boundary and the first route to trust it would have been open.
 */
const STATIC_ASSET_EXTENSION =
  /\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|css|js|mjs|map|txt|xml|json|webmanifest|woff2?|ttf|otf|eot|mp4|webm)$/i;

function isStaticAsset(pathname: string): boolean {
  // An API route is never a static asset, whatever it is named. `/api/x.json`
  // must still authenticate.
  if (pathname.startsWith("/api/")) return false;
  // The extension must terminate the path, not merely appear within it.
  return STATIC_ASSET_EXTENSION.test(pathname);
}

function isPublicApiPath(pathname: string, portal: PortalType): boolean {
  return PUBLIC_API_PATHS[portal].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Where a request for a path that names no route is sent.
 *
 * A folder whose name starts with an underscore is a private folder in the App
 * Router and is excluded from routing, so no file anybody adds can ever be
 * served at this path. Rewriting to it is therefore a rewrite to "nothing", and
 * Next answers that the way it answers any unmatched URL: app/not-found.tsx,
 * with a 404 status, and the address bar still showing what the visitor typed.
 */
const UNROUTED_PATH = "/_unrouted";

export interface MiddlewareOptions {
  /**
   * Every first path segment the app can route. When given, a path whose first
   * segment is not listed is answered with the app's 404 page instead of being
   * sent to sign in. See apps/customer/src/lib/route-segments.ts for why the
   * list lives in the app and why the branch fails closed.
   *
   * Omitted by the seller and admin portals, whose behaviour is unchanged: an
   * operator console has no anonymous audience for a 404 page to serve, and
   * every path on it still goes to sign in.
   */
  knownTopLevelSegments?: readonly string[];
}

function namesNoRoute(pathname: string, knownTopLevelSegments: readonly string[]): boolean {
  if (pathname === "/") return false;
  const firstSegment = pathname.split("/")[1] ?? "";
  return !knownTopLevelSegments.includes(firstSegment);
}

function isPublicPath(pathname: string, portal: PortalType): boolean {
  if (PUBLIC_EXACT_PATHS[portal].includes(pathname)) return true;
  return PUBLIC_PATHS[portal].some(
    (p) =>
      pathname === p ||
      pathname.startsWith(p + "/") ||
      (portal === "customer" && pathname.startsWith("/products/")),
  );
}

/**
 * Build a portal's middleware.
 *
 * `authFn` is optional and the apps deliberately do not pass one. Supplying the
 * NextAuth instance here is what put the Prisma client into the edge bundle:
 * the instance carries the credentials provider, whose authorize() reaches the
 * database, and importing it from middleware.ts dragged that whole graph into a
 * runtime that cannot execute it — the module threw on evaluation and every
 * request to every portal answered 500.
 *
 * Nothing is lost by omitting it. The session strategy is JWT, so `auth()` in
 * middleware only ever decoded the session cookie; resolveRemotePortalSession
 * decodes the same cookie, with the same secret, under the same cookie name,
 * using next-auth/jwt directly — which is edge-safe. The parameter is kept so a
 * split deployment that genuinely needs a different resolver can still pass one.
 */
export function createMiddleware(
  portal: PortalType,
  authFn?: () => Promise<Session | null>,
  options: MiddlewareOptions = {},
) {
  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip Next.js internals, static files, auth endpoints, and health probes
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/auth") ||
      pathname === "/api/health" ||
      pathname === "/api/ready" ||
      pathname === "/api/status" ||
      isStaticAsset(pathname)
    ) {
      return NextResponse.next();
    }

    // Before the public check and before any session is read: a path that names
    // no route is a 404 for a visitor, a signed-in buyer and a crawler alike, so
    // who is asking does not change the answer. This branch only ever withholds
    // a page — it rewrites to the 404 and never lets a request through — so it
    // cannot open anything the checks below would have closed.
    if (options.knownTopLevelSegments && namesNoRoute(pathname, options.knownTopLevelSegments)) {
      return NextResponse.rewrite(new URL(UNROUTED_PATH, request.url));
    }

    if (isPublicPath(pathname, portal) || isPublicApiPath(pathname, portal)) {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/");
    let session: Session | null = null;
    if (authFn) {
      try {
        session = await authFn();
      } catch {
        // A split runtime may not possess the backend JWT signing secret.
      }
    }
    session ??= await resolveRemotePortalSession(portal, request.headers.get("cookie"));

    if (!session?.user) {
      // API clients get a JSON 401 instead of an HTML redirect.
      if (isApi) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 },
        );
      }
      const loginUrl = new URL("/login", request.url);
      // Carry the query string too. A bare pathname drops the filters, variant
      // selection and RFQ context the visitor had, so they return to a
      // different page than the one they were sent away from.
      loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = (session.user as { role: UserRole }).role;
    const allowedRoles = PORTAL_ROLE_MAP[portal];

    if (!allowedRoles.includes(userRole)) {
      if (isApi) {
        return NextResponse.json(
          { success: false, error: "Insufficient permissions" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
    }

    return NextResponse.next();
  };
}
