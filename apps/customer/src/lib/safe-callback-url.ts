/**
 * Accept only a same-origin absolute path. Backslashes are rejected because
 * WHATWG URL parsing normalizes them as authority separators in special URLs.
 */
export function safeCallbackPath(value: string | null | undefined, fallback = "/account/orders"): string {
  if (!value || !/^\/(?![\\/])/.test(value) || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || !/^\/(?![\\/])/.test(decoded)) return fallback;
    const origin = "https://callback.invalid";
    const parsed = new URL(value, origin);
    return parsed.origin === origin && parsed.pathname.startsWith("/")
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
