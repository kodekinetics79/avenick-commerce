/**
 * Same-origin return-path validation for post-login redirects.
 *
 * The login flow reads a `callbackUrl` from the query string and navigates to
 * it after a successful sign-in. Handing that value straight to
 * `window.location.assign()` is an open redirect: an attacker sends a victim to
 * `/login?callbackUrl=https://evil.example`, the victim authenticates for real,
 * and the browser then lands them on the attacker's page carrying the trust of
 * a completed login.
 *
 * Only site-relative paths are accepted. Anything else falls back.
 */

/** Internal base used purely to resolve relative paths for validation. */
const VALIDATION_BASE = "http://return-path.invalid";

/** Paths we refuse to return to, because doing so loops the visitor. */
const LOOPING_PREFIXES = ["/login", "/api/auth"];

export const DEFAULT_RETURN_PATH = "/";

/**
 * Resolve a caller-supplied return path to a safe, same-origin path.
 *
 * @param candidate Raw value from the query string, or anywhere untrusted.
 * @param fallback  Returned whenever the candidate is missing or unsafe.
 * @returns A path beginning with `/`, never an absolute URL.
 */
export function safeReturnTo(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  if (!candidate) return fallback;

  // Browsers strip leading/trailing whitespace and embedded control characters
  // (newlines, tabs) before resolving a URL. Strip them here too, or
  // "\n//evil.example" slips past a naive prefix check and then navigates
  // off-origin once the browser has cleaned it up.
  const cleaned = candidate.replace(/[\u0000-\u001F\u007F\s]/g, "");
  if (!cleaned) return fallback;

  // Must be site-relative. This alone rejects "https://evil.example" and
  // "javascript:alert(1)", since neither begins with a slash.
  if (!cleaned.startsWith("/")) return fallback;

  // "//evil.example" is protocol-relative and resolves off-origin. Backslash
  // variants are normalised to forward slashes by browsers for http(s) URLs,
  // so "/\evil.example" is the same attack wearing a hat.
  if (cleaned.startsWith("//") || cleaned.startsWith("/\\")) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(cleaned, VALIDATION_BASE);
  } catch {
    return fallback;
  }

  // Belt and braces: if any normalisation above was incomplete, the resolved
  // origin will have moved away from the validation base.
  if (parsed.origin !== VALIDATION_BASE) return fallback;

  if (LOOPING_PREFIXES.some((p) => parsed.pathname === p || parsed.pathname.startsWith(`${p}/`))) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
