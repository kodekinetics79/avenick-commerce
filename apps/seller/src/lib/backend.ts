import { cookies, headers } from "next/headers";

type BackendJson<T> = { success?: boolean; data?: T; error?: string };

/**
 * Thrown when the seller API cannot be addressed at all. It carries a sentence
 * a seller can act on, because the pages that call this render it: `/quotes`
 * and `/quotes/submit` have no other content to fall back to.
 */
export class SellerBackendUnreachableError extends Error {
  constructor() {
    super("The quoting service could not be reached from this deployment. Please try again, or contact support if it persists.");
    this.name = "SellerBackendUnreachableError";
  }
}

/**
 * Absolute URL for a seller API path.
 *
 * This runs on the SERVER, where `fetch` has no notion of an origin: handing it
 * the bare path "/api/seller/rfqs" throws `Failed to parse URL`, which is a 500
 * with no message on whichever page called it. That is what used to happen to
 * `/quotes`, `/quotes/submit` and the submit-a-quote action in every deployment
 * with no backend variable set — local development and any Vercel project that
 * does not define one — so the entire quoting capability answered 500.
 *
 * The fail-closed intent of the previous version is kept: no host is ever
 * guessed. When nothing is configured this addresses the origin that served the
 * request now being handled — read from the request's own Host header, not from
 * a constant — which is the same process, so it cannot reach another
 * environment. If even that is absent there is nowhere safe to send a session
 * cookie, and the caller is told so rather than crashing.
 */
export interface SellerBackendOrigin {
  /** NEXT_PUBLIC_SELLER_BACKEND_URL or RENDER_EXTERNAL_URL, already trimmed. */
  configuredBase?: string | null;
  /** The Host header of the request being handled. */
  host?: string | null;
  /** x-forwarded-proto, if the edge set one. */
  forwardedProto?: string | null;
}

/**
 * The pure resolution step, separated from `headers()` so it can be unit-tested
 * without a request context. Always returns an absolute URL or throws.
 */
export function resolveSellerBackendUrl(path: string, origin: SellerBackendOrigin): string {
  const base = (origin.configuredBase ?? "").trim().replace(/\/$/, "");
  if (base) return new URL(path, `${base}/`).toString();

  const host = origin.host?.trim();
  if (!host) throw new SellerBackendUnreachableError();
  // Behind both supported edges (Vercel, Render) the protocol arrives in
  // x-forwarded-proto. Without it, only a loopback host may be assumed plain.
  const forwarded = origin.forwardedProto?.split(",")[0]?.trim();
  const protocol = forwarded || (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) ? "http" : "https");
  try {
    return new URL(path, `${protocol}://${host}`).toString();
  } catch {
    throw new SellerBackendUnreachableError();
  }
}

function backendUrl(path: string) {
  const requestHeaders = headers();
  return resolveSellerBackendUrl(path, {
    configuredBase:
      process.env.NEXT_PUBLIC_SELLER_BACKEND_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || "",
    host: requestHeaders.get("host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  });
}

export async function fetchSellerBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = cookies()
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const response = await fetch(backendUrl(path), {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });
  const json = (await response.json().catch(() => null)) as BackendJson<T> | null;
  if (!response.ok || json?.success === false) {
    throw new Error(json?.error ?? `Request failed with status ${response.status}`);
  }
  return (json?.data ?? json) as T;
}
