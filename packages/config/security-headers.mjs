/**
 * Shared HTTP security headers for the three Avenick portals.
 *
 * Applied from each app's next.config.mjs `headers()` so all portals carry the
 * same baseline. Per-portal differences (extra image or API origins) are passed
 * in rather than forked, so a policy change lands everywhere at once.
 *
 * ## Known limitation — `'unsafe-inline'` in script-src
 *
 * Next.js 14 App Router injects inline bootstrap and streaming-payload scripts.
 * Removing `'unsafe-inline'` requires a per-request nonce threaded through
 * middleware, which changes every response to dynamic and would disable the
 * static optimisation these storefront routes rely on. The directive is kept
 * deliberately and is the main residual CSP risk. The directives that block
 * clickjacking, base-tag injection, plugin content and off-origin form posts
 * are all strict.
 */

/** Origins every portal must reach for images, beyond self/data/blob. */
const BASE_IMG_SRC = ["https://*.avenick.com", "https://placehold.co"];

/**
 * Build the header list for a portal.
 *
 * @param {object}   [options]
 * @param {string[]} [options.imgSrc]     Extra image origins for this portal.
 * @param {string[]} [options.connectSrc] Extra XHR/fetch origins (e.g. a split backend).
 * @param {boolean}  [options.isDev]      Relax only what local development requires.
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders({ imgSrc = [], connectSrc = [], isDev = false } = {}) {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (isDev) {
    // React Refresh and the dev overlay evaluate generated code.
    scriptSrc.push("'unsafe-eval'");
  }

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Tailwind and styled-jsx emit inline style attributes.
    //
    // fonts.googleapis.com serves the @font-face STYLESHEET; fonts.gstatic.com
    // serves the font FILES it points at. Two hosts, two directives, and both
    // are needed — allowing only the first fetches the rules and then blocks
    // every file they reference, which is the most confusing half-fix here
    // because the stylesheet loads and not one glyph changes.
    //
    // Without these, this policy silently blocked every typeface the design
    // system declares (Inter, IBM Plex Sans Arabic, IBM Plex Mono, Source Serif
    // 4, Noto Kufi and Noto Naskh) across ALL THREE portals, and the product
    // rendered in system fallbacks for as long as the header has existed. It is
    // invisible in a screenshot — a fallback face is still a face — and shows
    // up only as one CSP violation in a console nobody has open.
    //
    // Scoped to stylesheets and font files. These hosts are deliberately absent
    // from script-src and connect-src, so the policy widens exactly as far as
    // typography needs and no further. Self-hosting the faces would remove the
    // exception entirely and is the better end state.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${[...BASE_IMG_SRC, ...imgSrc].join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${["'self'", ...(isDev ? ["ws:", "http://localhost:*"] : []), ...connectSrc].join(" ")}`,
    // No plugin content, no embedding, no nested browsing contexts.
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    // Blocks <base href> injection redirecting every relative URL off-origin.
    "base-uri 'self'",
    // Complements the same-origin returnTo validation: even a hijacked form
    // cannot POST credentials to another origin.
    "form-action 'self'",
    "manifest-src 'self'",
  ];

  if (!isDev) {
    csp.push("upgrade-insecure-requests");
  }

  const headers = [
    { key: "Content-Security-Policy", value: csp.join("; ") },
    // Retained alongside frame-ancestors for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "camera=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "payment=()",
        "usb=()",
      ].join(", "),
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (!isDev) {
    // Two years, subdomains included. Both portals are HTTPS-only in every
    // deployed environment; sending this locally would poison plain-HTTP dev.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

/**
 * Ready-made `headers()` entry applying the policy to every route.
 *
 * @param {Parameters<typeof securityHeaders>[0]} [options]
 */
export function securityHeadersRoute(options) {
  return { source: "/:path*", headers: securityHeaders(options) };
}
