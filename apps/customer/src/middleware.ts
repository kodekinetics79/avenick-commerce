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
  // The trailing alternation excludes files by EXTENSION, which is why the
  // generated metadata routes have to be named explicitly: Next serves
  // icon.tsx, apple-icon.tsx and opengraph-image.tsx at extensionless paths
  // (`/icon?<hash>`), so they matched, hit the auth check and answered
  // `307 -> /login?callbackUrl=%2Ficon`. A favicon that redirects to a sign-in
  // page fails silently in the one place nobody looks — the browser just draws
  // the default document icon, exactly as it did when there was no icon at all.
  //
  // `sitemap.xml` and `robots.txt` are covered by the extension rule already;
  // these three are not, and neither would `manifest.webmanifest` be if it were
  // not for its own extension.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
