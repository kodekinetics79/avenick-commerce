import { cache } from "react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { selfOrigin } from "@avenick/utils/portal-config";
import { categoryTrail } from "@/lib/category-tree";
import { readPublicCategoryTree } from "@/lib/public-category-tree";
import { JsonLd } from "./json-ld";
import { breadcrumbList } from "./structured-data";

/**
 * The public category tree, read once per request however many server
 * components ask.
 *
 * The category route already reads the tree in generateMetadata and again in
 * the page. The breadcrumb markup needs it a third time, and React's request
 * cache is what keeps that third read from being a third query:
 * generateMetadata and this component share the cached call.
 */
export const readCategoryTreeOnce = cache(readPublicCategoryTree);

/**
 * BreadcrumbList markup for /categories/<slug>, carrying the trail the page's
 * visible breadcrumb draws: "All products", then every ancestor, then the
 * category itself, each named in the visitor's locale as the page names them.
 *
 * Renders nothing when the slug is not in the public tree (the page is a 404)
 * or when the deployment does not know its own address, because every item must
 * be an absolute URL.
 */
export async function CategoryBreadcrumbJsonLd({ slug }: { slug: string }) {
  const origin = selfOrigin("customer");
  if (!origin) return null;
  const trail = categoryTrail(await readCategoryTreeOnce(), slug);
  if (trail.length === 0) return null;

  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const t = await getTranslations("catalogue");
  return (
    <JsonLd
      data={breadcrumbList(origin, [
        { name: t("filters.allProducts"), path: "/products" },
        ...trail.map((node) => ({
          name: locale === "ar" ? node.nameAr?.trim() || node.nameEn : node.nameEn,
          path: `/categories/${encodeURIComponent(node.slug)}`,
        })),
      ])}
    />
  );
}
