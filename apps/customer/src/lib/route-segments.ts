/**
 * Every first path segment this storefront can answer.
 *
 * WHY THIS LIST EXISTS. The portal middleware is private by default: a path it
 * cannot find on PUBLIC_PATHS is sent to sign in. That is the right default for
 * a path that names a real page, and the wrong answer for one that names
 * nothing. A mistyped link, a dead URL in an old email or a crawler probing
 * `/wp-admin` all answered `307 -> /login?callbackUrl=…`, so a visitor who had
 * never held an account was greeted with "Welcome back", and no visitor or
 * crawler ever saw the 404 page. A search engine read every dead link on the
 * web as a redirect to the sign-in form.
 *
 * The middleware cannot ask Next whether a route exists — it runs before
 * routing, at the edge, with no view of the file system — so the app tells it,
 * here. A path whose first segment is not on this list is rewritten to a path
 * nothing can be routed to, and Next renders app/not-found.tsx with a real 404.
 *
 * WHY IT FAILS CLOSED. The unknown branch rewrites to the 404; it never lets the
 * request through. A new directory somebody forgets to add here therefore 404s
 * for everyone the first time it is opened in development — loud, and in front
 * of the person who created it — instead of skipping the auth gate. Passing an
 * unknown path through untouched would also have produced a 404 today, and it
 * would have turned a forgotten entry into a private page served without a
 * session. `app/route-classification.security.test.ts` reads the app directory
 * and fails the build when this list and the file system disagree.
 *
 * Being on this list makes nothing public. Whether a known segment needs a
 * session is still decided by PUBLIC_PATHS in packages/auth/src/middleware.ts,
 * exactly as before.
 *
 * Plain data with no imports: this module is bundled into edge middleware.
 */
export const KNOWN_TOP_LEVEL_SEGMENTS: readonly string[] = [
  // Route directories under src/app.
  "about",
  "account",
  "api",
  "auth",
  "b2b",
  "brands",
  "cart",
  "categories",
  "checkout",
  "contact",
  "cookies",
  "deals",
  "login",
  "orders",
  "privacy",
  "products",
  "register",
  "returns",
  "returns-policy",
  "search",
  "shipping",
  "status",
  "support",
  "terms",
  "warranty",
  "wishlist",
  // Metadata routes, named by the path Next serves them at rather than by their
  // file name. The customer matcher and the static-asset rule already keep all
  // of these away from the auth check; they are listed so that neither of those
  // becoming narrower can turn the favicon or the sitemap into a 404.
  "apple-icon",
  "icon",
  "manifest.webmanifest",
  "opengraph-image",
  "robots.txt",
  "sitemap.xml",
];
