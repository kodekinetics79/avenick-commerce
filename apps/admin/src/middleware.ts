import { createMiddleware } from "@avenick/auth/middleware";
import { auth } from "@/lib/auth-instance";

export default createMiddleware("admin", auth);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
