/**
 * The schema.org payloads the storefront publishes, as pure functions of facts
 * it already holds. json-ld.tsx explains what is deliberately never published
 * (no Product, Offer, rating or review markup).
 *
 * Every URL is absolute and built from the deployment's own origin. The callers
 * pass selfOrigin() and publish nothing when it is null, the same rule the
 * canonical and the sitemap follow.
 */

/**
 * The site's name and its publisher.
 *
 * No SearchAction. It fed the sitelinks search box, which Google retired in
 * late 2024, so the markup would describe a feature no engine still renders.
 */
export function siteIdentity(origin: string, name: string, logoPath: string): Array<Record<string, unknown>> {
  const url = new URL("/", origin).href;
  return [
    { "@type": "WebSite", name, url },
    { "@type": "Organization", name, url, logo: new URL(logoPath, origin).href },
  ];
}

export interface Crumb {
  name: string;
  path: string;
}

/** The trail a page's visible breadcrumb draws, root first, in the same order and words. */
export function breadcrumbList(origin: string, crumbs: Crumb[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: new URL(crumb.path, origin).href,
    })),
  };
}
