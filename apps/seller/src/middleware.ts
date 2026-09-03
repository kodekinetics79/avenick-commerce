import { createMiddleware } from "@avenick/auth/middleware";

// No auth instance is passed: importing it here pulled the credentials
// provider, and therefore Prisma, into the edge bundle. createMiddleware
// resolves the session from the JWT cookie instead, which is what the instance
// did anyway under the jwt session strategy.
export default createMiddleware("seller");

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
