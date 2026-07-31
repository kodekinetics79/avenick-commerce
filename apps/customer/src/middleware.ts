import { createMiddleware } from "@avenick/auth/middleware";
import { auth } from "@/lib/auth-instance";
import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockSpatialCommerceRequest } from "@/lib/spatial-commerce-flag";

const authenticatedMiddleware = createMiddleware("customer", auth);

export default function middleware(request: NextRequest) {
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
