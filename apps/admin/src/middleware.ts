import { createMiddleware } from "@avenick/auth/middleware";

// No auth instance is passed: importing it here pulled the credentials
// provider, and therefore Prisma, into the edge bundle. createMiddleware
// resolves the session from the JWT cookie instead, which is what the instance
// did anyway under the jwt session strategy.
export default createMiddleware("admin");

export const config = {
  // Named explicitly because the trailing alternation excludes by EXTENSION and
  // Next serves the generated metadata routes at extensionless paths
  // (`/icon?<hash>`). Without this they match, hit the auth check and answer
  // 307 -> /login, so the tab silently keeps the browser default icon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
