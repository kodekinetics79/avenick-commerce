export type StorefrontCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
};

export function homeCategoryLinks(categories: StorefrontCategory[], locale: "en" | "ar") {
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    label: locale === "ar" ? category.nameAr?.trim() || category.nameEn : category.nameEn,
    href: `/products?category=${encodeURIComponent(category.slug)}`,
  }));
}

/** Keep homepage collections distinct when the API does not expose sales ranking. */
export function partitionHomeProducts<T extends { id: string }>(products: T[], sectionSize = 5) {
  const catalog = products.slice(0, sectionSize);
  const catalogIds = new Set(catalog.map(({ id }) => id));
  const more = products.filter(({ id }) => !catalogIds.has(id)).slice(0, sectionSize);
  return { catalog, more };
}
