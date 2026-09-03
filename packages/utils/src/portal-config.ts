/**
 * Env-driven resolver for every value that names another deployment or an
 * address the platform speaks from: portal origins, the transactional sender,
 * public contact addresses, the brand name.
 *
 * This is the ONLY place those environment variables are read. Everything
 * else imports from here so that a missing value produces one consistent
 * outcome — `null` — and the caller either hides the control or refuses the
 * operation. Nothing in this module invents a host, an address or a name:
 * a made-up value would render as fact, and a silent wrong answer is the one
 * failure nobody can detect from the outside.
 *
 * NEXT_PUBLIC_ variables are inlined at BUILD time, and only when referenced
 * literally as `process.env.NEXT_PUBLIC_X`. Every read below is spelled out for
 * that reason — indexing `process.env` dynamically would leave the browser
 * bundle with `undefined` and hide every cross-portal link in production.
 *
 * Safe to import from server and client components alike: no Node-only
 * imports, and the server-only variables (`NEXTAUTH_URL`, `RENDER_EXTERNAL_URL`,
 * `VERCEL_PROJECT_PRODUCTION_URL`, `RESEND_FROM_EMAIL`) are simply absent in a
 * browser bundle, where the functions that read them are not meant to be used.
 */

export type Portal = "customer" | "seller" | "admin";

/**
 * The documented dev ports (.env.example). This is the one permitted place for
 * a localhost literal; it is never consulted when NODE_ENV is "production".
 */
const DEV_PORTAL_ORIGIN: Record<Portal, string> = {
  customer: "http://localhost:13100",
  seller: "http://localhost:13101",
  admin: "http://localhost:13102",
};

/** The brand name itself is the one permitted literal. */
const DEFAULT_PLATFORM_NAME = "Avenick";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ─── Warn-once ────────────────────────────────────────────────────────────────

/**
 * A misconfigured variable is reported once per process, on the server only.
 * This package has no observability dependency, so console.warn is the
 * channel; the message names the variable and the reason but never echoes the
 * value — a value rejected for carrying credentials must not land in a log.
 */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (typeof window !== "undefined") return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[portal-config] ${message}`);
}

// ─── Origins ──────────────────────────────────────────────────────────────────

/**
 * Normalise a configured value to an origin. Accepts "https://host" and
 * "https://host/" (a port is fine); rejects a path, query, fragment,
 * credentials, a non-http scheme, or a value with no scheme at all. A rejected
 * value is treated as unset — never partially trusted — because the output is
 * pasted in front of arbitrary paths and into emails.
 */
function parseOrigin(name: string, raw: string | undefined): string | null {
  return readOrigin(name, raw) ?? null;
}

/**
 * Tri-state read: `undefined` when the variable is unset, `null` when it is
 * set but malformed, the origin otherwise. The distinction matters for the dev
 * fallback: an unset variable may fall back to localhost, a malformed one must
 * not — the fallback would mask the misconfiguration until production, where
 * there is no fallback to hide behind.
 */
function readOrigin(name: string, raw: string | undefined): string | null | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    warnOnce(name, `${name} is not an absolute URL (expected https://host); ignoring it`);
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    warnOnce(name, `${name} must use http or https; ignoring it`);
    return null;
  }
  if (parsed.username || parsed.password) {
    warnOnce(name, `${name} carries credentials; ignoring it`);
    return null;
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    warnOnce(name, `${name} must be a bare origin with no path, query or fragment; ignoring it`);
    return null;
  }
  return parsed.origin;
}

/**
 * The explicitly configured origin only — no dev fallback. `undefined` means
 * unset, `null` means set but rejected (see readOrigin).
 */
function configuredPortalOrigin(portal: Portal): string | null | undefined {
  switch (portal) {
    case "customer":
      return readOrigin("NEXT_PUBLIC_CUSTOMER_PORTAL_URL", process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL);
    case "seller":
      return readOrigin("NEXT_PUBLIC_SELLER_PORTAL_URL", process.env.NEXT_PUBLIC_SELLER_PORTAL_URL);
    case "admin":
      return readOrigin("NEXT_PUBLIC_ADMIN_PORTAL_URL", process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL);
    default:
      return undefined;
  }
}

function devFallbackOrigin(portal: Portal): string | null {
  if (isProduction()) return null;
  return DEV_PORTAL_ORIGIN[portal] ?? null;
}

/**
 * Public origin of a portal (no trailing slash), or null when it is not
 * configured in production. Callers hide the link/control on null.
 */
export function portalOrigin(portal: Portal): string | null {
  const configured = configuredPortalOrigin(portal);
  // A rejected value is a misconfiguration, not an absence: surface it as
  // null (the link disappears, the warning is logged) instead of quietly
  // pointing a developer at localhost.
  if (configured === null) return null;
  return configured ?? devFallbackOrigin(portal);
}

/** Origin + path, or null when the origin is unknown. */
export function portalUrl(portal: Portal, path?: string): string | null {
  const origin = portalOrigin(portal);
  if (!origin) return null;
  if (!path) return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Vercel exposes the production hostname without a scheme; a deployment that
 * set it with one is tolerated rather than rejected.
 */
function vercelProductionOrigin(): string | null {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!host) return null;
  return parseOrigin("VERCEL_PROJECT_PRODUCTION_URL", host.includes("://") ? host : `https://${host}`);
}

/**
 * The running app's own public origin, for server code that must address
 * itself (password-reset links, invitation links). Server only.
 *
 * Precedence: the portal's own NEXT_PUBLIC_*_PORTAL_URL, then the hosting
 * platform's knowledge of the deployment, then the dev fallback. Null in
 * production when none is set — the caller must refuse (log at error, 500)
 * rather than guess a host to put in an email.
 */
export function selfOrigin(portal: Portal): string | null {
  const configured = configuredPortalOrigin(portal);
  if (configured === null) return null;
  return (
    configured ??
    parseOrigin("NEXTAUTH_URL", process.env.NEXTAUTH_URL) ??
    parseOrigin("RENDER_EXTERNAL_URL", process.env.RENDER_EXTERNAL_URL) ??
    vercelProductionOrigin() ??
    devFallbackOrigin(portal)
  );
}

// ─── Addresses ────────────────────────────────────────────────────────────────

/**
 * One address, `local@host`, host with at least one dot. Deliberately narrow:
 * this is a configuration check, not RFC 5322 — it exists to stop a comment,
 * a list of addresses or a bare hostname from being handed to the mail
 * provider or printed on a legal page.
 */
const BARE_ADDRESS = /^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"().]+$/;

/**
 * `Display Name <local@host>` — a non-empty name (quotes allowed), then one
 * angle-address. The name may not span lines: a CR/LF in a From value is the
 * shape of a header injection, and a sender that cannot be written on one
 * line is not a sender at all.
 */
const NAMED_ADDRESS = /^([^<>\r\n]*[^<>\s])[ \t]*<([^<>\s]+)>$/;

function bareAddress(name: string, raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!BARE_ADDRESS.test(value)) {
    warnOnce(name, `${name} is not a bare email address (local@host); ignoring it`);
    return null;
  }
  return value;
}

/**
 * The transactional sender, exactly as it should be passed to the provider:
 * "Name <local@host>" or "local@host". Null when unset or malformed — there is
 * no default sender, and an email that cannot say who it is from must not be
 * sent.
 */
export function emailSender(): string | null {
  const value = process.env.RESEND_FROM_EMAIL?.trim();
  if (!value) return null;
  if (BARE_ADDRESS.test(value)) return value;
  const named = NAMED_ADDRESS.exec(value);
  if (named && BARE_ADDRESS.test(named[2])) return value;
  warnOnce(
    "RESEND_FROM_EMAIL",
    'RESEND_FROM_EMAIL must be "Name <local@host>" or "local@host"; no email will be sent until it is',
  );
  return null;
}

/**
 * Public contact addresses. Legal and privacy fall back to support so a single
 * configured mailbox covers every footer and policy page; a malformed value is
 * treated as unset. All three are null when nothing is configured — the UI
 * then omits the contact line rather than printing an address nobody reads.
 */
export function platformContacts(): { support: string | null; legal: string | null; privacy: string | null } {
  const support = bareAddress("NEXT_PUBLIC_SUPPORT_EMAIL", process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  const legal = bareAddress("NEXT_PUBLIC_LEGAL_EMAIL", process.env.NEXT_PUBLIC_LEGAL_EMAIL) ?? support;
  const privacy = bareAddress("NEXT_PUBLIC_PRIVACY_EMAIL", process.env.NEXT_PUBLIC_PRIVACY_EMAIL) ?? support;
  return { support, legal, privacy };
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/** Brand name for titles, subjects and copy. The only value here with a default. */
export function platformName(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || DEFAULT_PLATFORM_NAME;
}
