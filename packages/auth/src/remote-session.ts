import type { Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import { UserRole } from "@avenick/database";

export type PortalType = "customer" | "seller" | "admin";

const DEFAULT_BACKEND_ORIGINS: Record<PortalType, string> = {
  customer: "https://avenick-commerce.onrender.com",
  seller: "https://avenick-seller.onrender.com",
  admin: "https://avenick-admin.onrender.com",
};

const SESSION_COOKIE_NAMES: Record<PortalType, string> = {
  customer: "avenick.customer.session-token",
  seller: "avenick.seller.session-token",
  admin: "avenick.admin.session-token",
};

function hasPortalSessionCookie(portal: PortalType, cookieHeader: string) {
  const name = SESSION_COOKIE_NAMES[portal];
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=", 1)[0])
    .some((cookieName) => cookieName === name || cookieName.startsWith(`${name}.`));
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  if (
    typeof session["expires"] !== "string" ||
    !Number.isFinite(Date.parse(session["expires"])) ||
    Date.parse(session["expires"]) <= Date.now()
  ) return false;
  const user = session["user"];
  if (!user || typeof user !== "object") return false;
  const candidate = user as Record<string, unknown>;
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["email"] === "string" &&
    Object.values(UserRole).includes(candidate["role"] as UserRole)
  );
}

function backendOrigin(portal: PortalType) {
  const authOrigin = process.env.NEXTAUTH_URL?.trim();
  if (authOrigin) return authOrigin.replace(/\/$/, "");
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  return (configured || DEFAULT_BACKEND_ORIGINS[portal]).replace(/\/$/, "");
}

/**
 * Validate a portal JWT at the backend that issued it. This is used only when
 * a split Vercel/Render deployment cannot decode the cookie locally. The
 * request is sent exclusively to the deployment-owned backend origin and
 * fails closed on missing cookies, network errors, or malformed responses.
 */
export async function resolveRemotePortalSession(
  portal: PortalType,
  cookieHeader: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Session | null> {
  if (!cookieHeader || !hasPortalSessionCookie(portal, cookieHeader)) return null;

  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (secret) {
    try {
      const token = await getToken({
        req: { headers: { cookie: cookieHeader } },
        secret,
        cookieName: SESSION_COOKIE_NAMES[portal],
        secureCookie: false,
      });
      if (
        token &&
        typeof token.sub === "string" &&
        typeof token.email === "string" &&
        typeof token.exp === "number" &&
        token.exp * 1_000 > Date.now() &&
        Object.values(UserRole).includes(token["role"] as UserRole)
      ) {
        return {
          user: {
            id: token.sub,
            email: token.email,
            name: typeof token.name === "string" ? token.name : null,
            image: typeof token.picture === "string" ? token.picture : null,
            role: token["role"] as UserRole,
            language: typeof token["language"] === "string" ? token["language"] : "en",
          } as Session["user"],
          expires: new Date(token.exp * 1_000).toISOString(),
        };
      }
    } catch {
      // Continue to the deployment-owned verification endpoint.
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(`${backendOrigin(portal)}/api/auth/session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as unknown;
    return isSession(payload) ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
