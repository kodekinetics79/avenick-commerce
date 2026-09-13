import type { MetadataRoute } from "next";
import { db, publicProductWhere } from "@avenick/database";
import { selfOrigin } from "@avenick/utils/portal-config";
import { buildSitemap } from "@/components/seo/sitemap-entries";
import { readPublicCategoryTree } from "@/lib/public-category-tree";

/**
 * /sitemap.xml. It answered 404 — no file in the app produced one — so a
 * crawler could only find the catalogue by following links, and the 119
 * categories and 383 discoverable products in production had no list to be
 * read from. components/seo/sitemap-entries.ts decides what is on it and why.
 *
 * Rendered per request: the catalogue changes when a seller publishes, not when
 * the app is built, and build machines have no database.
 */
export const dynamic = "force-dynamic";

/** The sitemap protocol's per-file ceiling. The catalogue is far below it. */
const SITEMAP_URL_LIMIT = 50_000;

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(selfOrigin("customer"), {
    categories: readPublicCategoryTree,
    products: () =>
      db.product.findMany({
        where: publicProductWhere(undefined),
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: SITEMAP_URL_LIMIT,
      }),
    onError: (source, error) => console.error(`Unable to read ${source} for the sitemap; listing what could be read`, error),
  });
}
