import { createMiddleware } from "@avenick/auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockSpatialCommerceRequest } from "@/lib/spatial-commerce-flag";

// No auth instance is passed: importing it here pulled the credentials provider,
// and therefore Prisma, into the edge bundle, where it threw during module
// initialisation and every request to the portal answered 500. createMiddleware
// resolves the session from the JWT cookie instead, which is what the instance
// did anyway under the jwt session strategy.
//
// spatial-commerce-flag reads process.env and nothing else, so the flag check
// stays edge-safe for the same reason.
const authenticatedMiddleware = createMiddleware("customer");

export default function middleware(request: NextRequest) {
  // A disabled feature is absent, not forbidden: 404 rather than 403, so the
  // route reveals nothing about what exists behind the flag.
  if (shouldBlockSpatialCommerceRequest(request.nextUrl.pathname)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return authenticatedMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
