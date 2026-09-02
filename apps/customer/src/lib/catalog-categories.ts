import { fetchBackendJson } from "@/lib/backend";

/**
 * Top-level catalog categories as the public catalog API exposes them
 * (GET /api/categories: active, with discoverable ACTIVE products, ordered by
 * sortOrder). This is the single source for every category strip, chip row and
 * "browse by category" grid on the customer portal — none of those surfaces
 * may type a category list into the page, because a typed list keeps
 * advertising categories the catalog no longer sells and never learns about
 * new ones.
 */
export interface PublicCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  iconName: string | null;
  children?: PublicCategory[];
}

/**
 * Server-only. Resolves to an empty list when the API is unreachable or
 * returns nothing, so callers render an honest empty state (usually: no strip)
 * instead of a fallback list that pretends to be the catalog.
 */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  try {
    const result = await fetchBackendJson<unknown>("/api/categories");
    if (!Array.isArray(result)) return [];
    return result.filter(
      (c): c is PublicCategory =>
        !!c && typeof c === "object" && typeof (c as PublicCategory).slug === "string" && typeof (c as PublicCategory).nameEn === "string",
    );
  } catch (error) {
    console.error("Unable to load catalog categories", error);
    return [];
  }
}

/** Display name for the visitor's locale; Arabic falls back to English when the Arabic name is blank. */
export function categoryLabel(category: Pick<PublicCategory, "nameEn" | "nameAr">, locale: string): string {
  return locale === "ar" && category.nameAr?.trim() ? category.nameAr : category.nameEn;
}
