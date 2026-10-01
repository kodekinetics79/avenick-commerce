import { cookies } from "next/headers";
import { selfOrigin } from "@avenick/utils/portal-config";

type BackendJson<T> = { success?: boolean; data?: T; error?: string };

/**
 * Thrown when the seller API cannot be addressed at all. It carries a sentence
 * a seller can act on, because the pages that call this render it: `/quotes`
 * and `/quotes/submit` have no other content to fall back to.
 */
export class SellerBackendUnreachableError extends Error {
  constructor() {
    super(
      "The quoting service could not be reached from this deployment. Please try again, or contact support if it persists.",
    );
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
 * with no backend variable set, so the entire quoting capability answered 500.
 *
 * The fallback is the canonical deployment-owned seller origin. A request Host
 * header is deliberately never used to choose where authenticated cookies are
 * forwarded: an edge or proxy misconfiguration must not turn an attacker-
 * supplied Host into a credential-bearing server-side request.
 */
export interface SellerBackendOrigin {
  /** Deployment-owned backend or seller self-origin, already trimmed. */
  configuredBase?: string | null;
}

/**
 * The pure resolution step, separated from `headers()` so it can be unit-tested
 * without a request context. Always returns an absolute URL or throws.
 */
export function resolveSellerBackendUrl(path: string, origin: SellerBackendOrigin): string {
  const base = (origin.configuredBase ?? "").trim().replace(/\/$/, "");
  if (base) return new URL(path, `${base}/`).toString();
  throw new SellerBackendUnreachableError();
}

function backendUrl(path: string) {
  return resolveSellerBackendUrl(path, {
    configuredBase:
      process.env.NEXT_PUBLIC_SELLER_BACKEND_URL?.trim() || selfOrigin("seller") || "",
  });
}

export async function fetchSellerBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = (await cookies())
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
