import type { MetadataRoute } from "next";
import { selfOrigin } from "@avenick/utils/portal-config";

/**
 * /robots.txt. It answered 404 with the full storefront 404 document, so no
 * crawler was told where the sitemap is or which parts of the site hold nothing
 * to index.
 *
 * DISALLOWED: surfaces that are private, per-visitor, or both — the account,
 * orders, checkout, the cart and wishlist (kept in the visitor's browser),
 * sign-in and registration, the auth flows, the company workspace and the API.
 * `/b2b/` carries its trailing slash and `/b2b/register` is allowed explicitly:
 * the longest matching rule wins, so the company-registration door stays
 * crawlable while every workspace page beneath `/b2b/` does not.
 *
 * ALLOWED BENEATH /api/: the three catalogue reads a public page makes FROM THE
 * BROWSER. The product page is a client component, so its name, photographs,
 * specification and supplier arrive from /api/products/<slug> after the HTML
 * does, and the discovery panels read /api/categories and /api/brands the same
 * way. A crawler renders a page with its fetches subject to this file, so a bare
 * `Disallow: /api/` rendered every product page the sitemap lists as an empty
 * shell. `/api/products` outranks `/api/` by length, which is the whole
 * mechanism. These are exactly the catalogue reads the middleware already
 * serves to anonymous visitors; everything else under /api/ — orders, the view
 * beacon, the cart lookup — stays disallowed, so a crawler's render cannot count
 * as a product view either.
 *
 * NOT DISALLOWED, deliberately:
 *  · /search — its results carry a noindex meta tag, and a crawler that is
 *    disallowed from a URL never fetches it and so never reads the noindex.
 *  · /returns — robots rules are PREFIX matches, so "/returns" would also
 *    block /returns-policy, a public policy page. The route handles a visitor
 *    with no session itself.
 * robots.regression.test.ts holds both, and checks that no rule here hides a
 * URL the sitemap publishes.
 *
 * The sitemap line is written only when this deployment knows its own address:
 * the protocol requires an absolute URL, and selfOrigin() returns null rather
 * than a guess. Rendered per request so a runtime-only NEXTAUTH_URL still counts.
 */
export const dynamic = "force-dynamic";

/** The public catalogue reads a storefront page makes from the browser. See above. */
const BROWSER_CATALOGUE_READS = ["/api/products", "/api/categories", "/api/brands"];

export default function robots(): MetadataRoute.Robots {
  const origin = selfOrigin("customer");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/b2b/register", ...BROWSER_CATALOGUE_READS],
      disallow: ["/account", "/orders", "/checkout", "/cart", "/wishlist", "/login", "/register", "/auth/", "/b2b/", "/api/"],
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
