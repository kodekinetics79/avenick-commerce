import { type NextRequest, NextResponse } from "next/server";
import { type Session } from "next-auth";
import { UserRole } from "@avenick/database";

type PortalType = "customer" | "seller" | "admin";

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
  customer: ["/", "/products", "/search", "/login", "/register", "/auth/forgot-password", "/auth/verify-email", "/deals", "/brands", "/cart", "/wishlist", "/categories", "/returns"],
  seller: ["/login", "/onboarding"],
  admin: ["/login"],
};

// API paths that must stay public: catalog browsing and externally-signed
// webhooks (which authenticate via their own signature, not a session).
const PUBLIC_API_PATHS: Record<PortalType, string[]> = {
  customer: ["/api/products", "/api/categories", "/api/payments/webhook"],
  seller: [],
  admin: [],
};

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
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    if (isPublicPath(pathname, portal) || isPublicApiPath(pathname, portal)) {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/");
    const session = await authFn();

    if (!session?.user) {
      // API clients get a JSON 401 instead of an HTML redirect.
      if (isApi) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 },
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
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
