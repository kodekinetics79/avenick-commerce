import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import {
  appliedCatalogFilters,
  catalogHref,
  formatRatingFloor,
  type AppliedFilter,
  type CatalogFilters,
  type CatalogSearchParams,
} from "./catalog-filters";

/**
 * WHAT IS CURRENTLY APPLIED, said out loud, with each filter's own undo.
 *
 * A filter panel that only shows what is AVAILABLE, never what is IN FORCE,
 * makes a buyer scroll a list hunting for the one row that happens to be
 * highlighted — and makes a legitimately narrow result look like a broken
 * catalogue. Each chip removes exactly its own filter and nothing else, so
 * undoing one choice never costs the others.
 *
 * It renders in two places on purpose: at the top of the filter panel, and again
 * beside the empty state, where "no products match these filters" is only
 * actionable if the filters are named and removable right there.
 *
 * Server Component. Links, not buttons: every one of these is a navigation to a
 * different URL, and the URL is the whole state of this page.
 */
export interface AppliedFilterChipsProps {
  searchParams: CatalogSearchParams;
  filters: CatalogFilters;
  /**
   * Display names for the two slug-backed filters, when the caller has them.
   * The panel does (it has just listed the categories and brands); the empty
   * state does not, and falls back to the slug — which is in the URL the buyer
   * is looking at, so it is recognisable rather than opaque.
   */
  names?: { category?: string; brand?: string };
  className?: string;
}

export async function AppliedFilterChips({ searchParams, filters, names, className }: AppliedFilterChipsProps) {
  const applied = appliedCatalogFilters(filters);
  if (applied.length === 0) return null;
  const t = await getTranslations("catalogue");

  // Literal keys, one per case. A lookup table of key strings would render the
  // same words and would be invisible to the message-key regression test, which
  // is exactly how this page's sort dropdown ended up shipping MISSING_MESSAGE.
  const label = (chip: AppliedFilter): string => {
    switch (chip.id) {
      case "category":
        return t("filters.chipCategory", { value: names?.category ?? String(chip.value) });
      case "brand":
        return t("filters.chipBrand", { value: names?.brand ?? String(chip.value) });
      case "inStock":
        return t("filters.inStockOnly");
      case "minRating":
        return t("filters.chipRating", { rating: formatRatingFloor(Number(chip.value)) });
      case "moqMax":
        return t("filters.moqUpTo", { count: Number(chip.value) });
      case "moqMin":
        return t("filters.moqAtLeast", { count: Number(chip.value) });
    }
  };

  return (
    <ul className={className ?? "flex flex-wrap gap-1.5"}>
      {applied.map((chip) => {
        const text = label(chip);
        return (
          <li key={chip.id}>
            <Link
              href={catalogHref(searchParams, chip.clear)}
              aria-label={t("filters.remove", { label: text })}
              className="u-focus u-state-wash u-meta flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 py-1 pe-1.5 ps-2.5 font-medium text-ink-1"
            >
              <span className="max-w-[12rem] truncate">{text}</span>
              <X className="h-3 w-3 shrink-0 text-ink-3" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
