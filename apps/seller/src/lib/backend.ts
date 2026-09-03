import { cookies } from "next/headers";

type BackendJson<T> = { success?: boolean; data?: T; error?: string };

function backendUrl(path: string) {
  // Fail closed. This previously defaulted to a hardcoded production host
  // whenever NODE_ENV was production and no backend URL was configured, so a
  // preview, CI run or misconfigured deploy silently drove the LIVE service.
  // With no configuration we now stay same-origin and let the caller's own
  // /api rewrite resolve it, which is wrong loudly rather than wrong quietly.
  const base = (
    process.env.NEXT_PUBLIC_SELLER_BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  return base ? new URL(path, `${base}/`).toString() : path;
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
