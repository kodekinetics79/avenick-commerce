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
  // The CONFIGURED origin wins, and the incoming one is consulted only if there
  // is none. This used to read `backendUrl(path, incomingBaseUrl())`, and an
  // argument is evaluated before the function that would have ignored it: a
  // request arriving with a Host nobody listed threw here even when the origin
  // to call was configured and known. On Render that shows up as
  // "Unable to load catalog categories / Incoming application origin is not
  // trusted" for the platform's own internal probes, and it is waiting for the
  // first custom domain: add www.avenick.com, forget to add it to the trusted
  // list, and every server-side read on it fails silently — the category
  // navigation simply renders as nothing.
  //
  // The security property is unchanged: an untrusted incoming origin is still
  // never used as a base. It is now only REQUIRED when nothing else can answer.
  const configured = getBackendBaseUrl();
  const url = configured ? backendUrl(path, configured) : backendUrl(path, incomingBaseUrl());
  if (!URL.canParse(url)) {
    throw new Error("Unable to resolve the current application origin");
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
