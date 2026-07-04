type BackendJson<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

export function backendUrl(path: string) {
  const base = getBackendBaseUrl();
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
  return fetchBackendJsonWithCookies<T>(path, init);
}

export async function fetchBackendJsonWithCookies<T>(
  path: string,
  init?: RequestInit,
  cookieHeader?: string,
): Promise<T> {
  const res = await fetch(backendUrl(path), {
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
