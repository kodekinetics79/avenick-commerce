import { type NextRequest, NextResponse } from "next/server";
import { auth as defaultAuth } from "./config";
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
  customer: ["/", "/products", "/search", "/login", "/register", "/auth/forgot-password", "/auth/verify-email", "/deals", "/brands", "/cart", "/wishlist", "/categories", "/returns", "/support", "/privacy", "/terms", "/cookies"],
  seller: ["/login", "/onboarding"],
  admin: ["/login"],
};

function isPublicPath(pathname: string, portal: PortalType): boolean {
  return PUBLIC_PATHS[portal].some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith("/products/"),
  );
}

export function createMiddleware(portal: PortalType, authFn = defaultAuth) {
  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip Next.js internals and static files
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/auth") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    if (isPublicPath(pathname, portal)) {
      return NextResponse.next();
    }

    const session = await authFn();

    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = (session.user as { role: UserRole }).role;
    const allowedRoles = PORTAL_ROLE_MAP[portal];

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
    }

    return NextResponse.next();
  };
}
