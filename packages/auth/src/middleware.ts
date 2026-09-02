import { type NextRequest, NextResponse } from "next/server";
import { type Session } from "next-auth";
import { UserRole } from "@avenick/database";
import { resolveRemotePortalSession, type PortalType } from "./remote-session";

const PORTAL_ROLE_MAP: Record<PortalType, UserRole[]> = {
  customer: [
    UserRole.CONSUMER,
    UserRole.COMPANY_ADMIN,
    UserRole.COMPANY_BUYER,
    UserRole.COMPANY_APPROVER,
  ],
  seller: [UserRole.SELLER_OWNER, UserRole.SELLER_STAFF],
  admin: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
};

// Paths that are publicly accessible (no auth required)
const PUBLIC_PATHS: Record<PortalType, string[]> = {
  customer: ["/", "/products", "/search", "/login", "/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/deals", "/brands", "/cart", "/wishlist", "/categories", "/returns", "/support", "/privacy", "/terms", "/cookies", "/status"],
  seller: ["/login", "/register"],
  admin: ["/login"],
};

// API paths that must stay public: catalog browsing and externally-signed
// webhooks (which authenticate via their own signature, not a session).
//
// `/api/brands` belongs here because `/brands` is a public page that renders
// from it. Without this entry an anonymous visitor loads a public route whose
// own data call is rejected with a 401, and the page fails.
const PUBLIC_API_PATHS: Record<PortalType, string[]> = {
  customer: ["/api/products", "/api/categories", "/api/brands", "/api/payments/webhook"],
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

function isPublicPath(pathname: string, portal: PortalType): boolean {
  return PUBLIC_PATHS[portal].some(
    (p) =>
      pathname === p ||
      pathname.startsWith(p + "/") ||
      (portal === "customer" && pathname.startsWith("/products/")),
  );
}

export function createMiddleware(portal: PortalType, authFn: () => Promise<Session | null>) {
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

    if (isPublicPath(pathname, portal) || isPublicApiPath(pathname, portal)) {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/");
    let session: Session | null = null;
    try {
      session = await authFn();
    } catch {
      // A split runtime may not possess the backend JWT signing secret.
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
