import type { MetadataRoute } from "next";
import type { CategoryNode } from "@/lib/category-tree";

/**
 * What the storefront's sitemap publishes, as a function of its inputs.
 *
 * It lives apart from app/sitemap.ts so it can be tested without a database, and
 * because a metadata route module is compiled into a route handler and is not the
 * place to export helpers from.
 *
 * WHAT IS ON IT. The pages an anonymous visitor can open and a buyer would want
 * to land on from a search result, and nothing else:
 *
 *  · the fixed public pages below;
 *  · every category in the PUBLIC tree — readPublicCategoryTree, the same read
 *    the header menu and /categories/<slug> use, so a category with nothing
 *    discoverable beneath it is absent here exactly as it is absent from the menu;
 *  · every product the public catalogue lists — publicProductWhere, the predicate
 *    the storefront's own rails are built from: ACTIVE, publicly discoverable,
 *    not deleted, and behind a seller that is ACTIVE and not deleted.
 *
 * WHAT IS NOT. Search results (noindex), the cart, the wishlist, sign-in,
 * account and company pages, and /products with any query string — a canonical
 * is a path, and the sitemap lists canonicals.
 *
 * WHY EACH SOURCE FAILS ON ITS OWN. A sitemap that 500s tells a crawler the site
 * is broken; one that lists the fixed pages tells it the truth that could be
 * read. So an unreachable database yields the static routes, and a failure in
 * one catalogue read does not take the other with it.
 */
export const SITEMAP_STATIC_PATHS = [
  "/",
  "/products",
  "/brands",
  "/deals",
  "/b2b/register",
  "/support",
  "/about",
  "/contact",
  "/shipping",
  "/returns-policy",
  "/warranty",
  "/terms",
  "/privacy",
  "/cookies",
] as const;

export interface SitemapSources {
  categories: () => Promise<CategoryNode[]>;
  products: () => Promise<Array<{ slug: string; updatedAt: Date }>>;
  onError?: (source: "categories" | "products", error: unknown) => void;
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

async function settle<T>(source: "categories" | "products", read: () => Promise<T[]>, onError: SitemapSources["onError"]): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    onError?.(source, error);
    return [];
  }
}

/**
 * The sitemap for a deployment at `origin`.
 *
 * A sitemap entry must be an absolute URL, and selfOrigin() returns null rather
 * than a guess when this deployment's address is not configured. With no origin
 * there is nothing true to list, so the sitemap is empty.
 */
export async function buildSitemap(origin: string | null, sources: SitemapSources): Promise<MetadataRoute.Sitemap> {
  if (!origin) return [];
  const at = (path: string) => new URL(path, origin).href;

  const [categories, products] = await Promise.all([
    settle("categories", async () => flatten(await sources.categories()), sources.onError),
    settle("products", sources.products, sources.onError),
  ]);

  return [
    ...SITEMAP_STATIC_PATHS.map((path) => ({ url: at(path) })),
    ...categories.map((category) => ({ url: at(`/categories/${encodeURIComponent(category.slug)}`) })),
    ...products.map((product) => ({
      url: at(`/products/${encodeURIComponent(product.slug)}`),
      lastModified: product.updatedAt,
    })),
  ];
}
