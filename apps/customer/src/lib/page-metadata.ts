import type { Metadata } from "next";
import { selfOrigin } from "@avenick/utils/portal-config";

/**
 * The storefront's canonical address for a page, as a metadata fragment.
 *
 * WHY THERE WAS NONE. Not one route declared `alternates`, so every page had a
 * null canonical, and the storefront reaches the same content by several URLs:
 * /categories/<slug> and /products?category=<slug>, /products with ?sort and
 * ?page, and share links carrying tracking parameters. A search engine left to
 * choose picks one of those and splits the page's standing across the rest.
 *
 * WHY IT TAKES A PATH AND DROPS THE QUERY. A canonical names the page, not the
 * visit. The path is kept because it IS the page; the query string is what
 * creates the duplicates, so no caller can pass one through by accident.
 *
 * WHY THE URL IS ABSOLUTE HERE AND NOT LEFT TO metadataBase. Next 14.2 resolves
 * a relative canonical against metadataBase and, when there is none, against
 * `http://localhost:<port>` (resolve-url.js, createLocalMetadataBase). The root
 * layout sets metadataBase only when selfOrigin() knows this deployment's
 * address, so a relative canonical on an unconfigured deployment would publish
 * localhost as the page's true address. selfOrigin() returns null rather than a
 * guess, and on null this returns nothing: no canonical is better than a wrong
 * one.
 *
 * Only `alternates` is returned, deliberately. A helper that also rebuilt
 * `openGraph` per page would replace the root's, and with it the image
 * opengraph-image.tsx attaches, so every adopting page would lose its share card.
 * The root layout leaves og:title and og:description for Next to fill from each
 * page's own title and description.
 */
export function canonicalFor(path: string): Pick<Metadata, "alternates"> {
  const origin = selfOrigin("customer");
  if (!origin) return {};
  const pathname = path.split(/[?#]/, 1)[0] || "/";
  return { alternates: { canonical: new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, origin).href } };
}

/**
 * For a page whose URL is made of the visitor's own words: search results.
 *
 * Any /search?q=<anything> answered an indexable 200 whose title and h1 repeat
 * the query, so the index could be filled with pages the storefront never chose
 * to publish. `follow` stays on because the results link to real product pages,
 * and those links are how a crawler should find them.
 *
 * This is a meta tag and not a robots.txt rule on purpose: a crawler that is
 * disallowed from a URL never fetches it, so it never reads the noindex, and a
 * disallowed URL that is linked from elsewhere can still be indexed by address.
 */
export const NOINDEX_FOLLOW: NonNullable<Metadata["robots"]> = { index: false, follow: true };
