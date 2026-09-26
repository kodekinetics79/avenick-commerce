import { cookies, headers } from "next/headers";

type BackendJson<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export function getBackendBaseUrl() {
  const configured = (
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    ""
  );
  if (!configured) return "";
  return trustedConfiguredOrigin(configured);
}

/** An operator-configured customer origin is safer than a request Host header.
 * Vercel can serve more than one public alias, while NEXTAUTH_URL names only
 * the canonical one. Server API reads must not require every alias to become
 * an authorized cookie destination. Explicit backend configuration still wins.
 */
function configuredCustomerOrigin() {
  const configured = (
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL?.trim() ||
    process.env.CUSTOMER_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  );
  return configured ? trustedConfiguredOrigin(configured) : "";
}

function parseHttpOrigin(value: string, allowHostOnly = false) {
  const candidate = allowHostOnly && !value.includes("://") ? `https://${value}` : value;
  if (!URL.canParse(candidate)) return "";
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
  return parsed.origin;
}

function trustedConfiguredOrigin(value: string) {
  const origin = parseHttpOrigin(value.replace(/\/$/, ""));
  if (!origin) throw new Error("Configured backend origin is invalid");
  return origin;
}

function trustedPortalOrigins() {
  const origins = new Set<string>();
  for (const value of [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXTAUTH_URL,
    process.env.CUSTOMER_URL,
  ]) {
    if (!value?.trim()) continue;
    const origin = parseHttpOrigin(value.trim().replace(/\/$/, ""));
    if (origin) origins.add(origin);
  }
  for (const value of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (!value?.trim()) continue;
    const origin = parseHttpOrigin(value.trim(), true);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function requestBaseUrl(input: { host?: string | null; forwardedHost?: string | null; forwardedProto?: string | null }) {
  const host = input.forwardedHost?.split(",")[0]?.trim() || input.host?.trim();
  if (!host) return "";
  const proto = input.forwardedProto?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  const origin = parseHttpOrigin(`${proto}://${host}`);
  if (!origin) throw new Error("Incoming application origin is malformed");

  const isLocalDevelopment = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname);
  if (!isLocalDevelopment && !trustedPortalOrigins().has(origin)) {
    throw new Error("Incoming application origin is not trusted");
  }
  return origin;
}

function incomingBaseUrl() {
  const store = headers();
  return requestBaseUrl({
    host: store.get("host"),
    forwardedHost: store.get("x-forwarded-host"),
    forwardedProto: store.get("x-forwarded-proto"),
  });
}

export function backendUrl(path: string, requestOrigin = "") {
  const base = getBackendBaseUrl() || requestOrigin;
  if (!base) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, base).toString();
}

export function cookieHeaderFromStore(store: { getAll: () => Array<{ name: string; value: string }> }) {
  return store
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

export async function fetchBackendJson<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchBackendJsonWithCookies<T>(path, init, cookieHeaderFromStore(cookies()));
}

export async function fetchBackendJsonWithCookies<T>(
  path: string,
  init?: RequestInit,
  cookieHeader?: string,
): Promise<T> {
  // Explicit server/customer configuration wins. Unknown request aliases are
  // never trusted implicitly: without configuration the exact-host check below
  // still fails closed. Canonical routing also avoids WWW/apex alias crashes.
  const configured = getBackendBaseUrl() || configuredCustomerOrigin();
  const base = configured || incomingBaseUrl();
  const url = backendUrl(path, base);
  if (!URL.canParse(url)) {
    throw new Error("Unable to resolve the current application origin");
  }
  // Prevent a protocol-relative path from replacing the trusted destination
  // when forwarding session cookies. Callers supply paths, never new origins.
  if (new URL(url).origin !== new URL(base).origin) {
    throw new Error("Backend path must remain on the trusted application origin");
  }
  const res = await fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  const json = (await res.json().catch(() => null)) as BackendJson<T> | null;
  if (!res.ok) {
    throw new Error(json?.error ?? `Request failed with status ${res.status}`);
  }
  if (json && json.success === false) {
    throw new Error(json.error ?? "Request failed");
  }
  return (json?.data ?? (json as unknown as T)) as T;
}
