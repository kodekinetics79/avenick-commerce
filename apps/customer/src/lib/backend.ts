import { cookies, headers } from "next/headers";

type BackendJson<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

export function requestBaseUrl(input: { host?: string | null; forwardedHost?: string | null; forwardedProto?: string | null }) {
  const host = input.forwardedHost?.split(",")[0]?.trim() || input.host?.trim();
  if (!host) return "";
  const proto = input.forwardedProto?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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
  const url = backendUrl(path, incomingBaseUrl());
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
