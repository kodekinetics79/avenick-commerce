import { cookies } from "next/headers";

type BackendJson<T> = { success?: boolean; data?: T; error?: string };

function backendUrl(path: string) {
  const base = (
    process.env.NEXT_PUBLIC_ADMIN_BACKEND_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? "https://avenick-admin.onrender.com" : "") ||
    ""
  ).replace(/\/$/, "");
  return base ? new URL(path, `${base}/`).toString() : path;
}

export async function fetchAdminBackend<T>(path: string, init?: RequestInit): Promise<T> {
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
