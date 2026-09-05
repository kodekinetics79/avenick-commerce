"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEFAULT_SORT, SORT_CHOICES, type CatalogSort } from "./catalog-filters";

/**
 * The sort control.
 *
 * A NATIVE <select>, on purpose. On the phones that carry most of this
 * storefront's traffic the native picker is a full-height wheel the operating
 * system already knows how to drive; a Radix listbox here would be a heavier,
 * less familiar version of the same few choices. It is styled from tokens
 * instead of imitated.
 *
 * THE OPTIONS ARE WRITTEN OUT rather than mapped over a table of key strings,
 * and that is a fix, not a style change. The previous version held
 * `{ key: "sort.newest" }` in an array and called `t(o.key)`, which had two
 * consequences: `catalogue.sort` is the string "Sort" in the message tree, so
 * `catalogue.sort.newest` resolved to nothing and every option in this dropdown
 * rendered a MISSING_MESSAGE fallback; and because the key never appeared as a
 * literal, the message-key regression test — which scans for `t("…")` — could
 * not see it and reported the page as fully translated. Literal keys are what
 * put this control back under that guard.
 *
 * Sorts that the DATABASE cannot perform across the whole result set are not
 * offered. See SORT_CHOICES for why price is not among them.
 */
export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("catalogue");
  const raw = searchParams.get("sort") ?? DEFAULT_SORT;
  const current: CatalogSort = (SORT_CHOICES as readonly string[]).includes(raw)
    ? (raw as CatalogSort)
    : DEFAULT_SORT;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("sort", e.target.value);
    // A new ordering is a new sequence; page 7 of the old one is not a position
    // in it.
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      <select
        aria-label={t("sortLabel")}
        value={current}
        onChange={handleChange}
        data-rung={1}
        className="u-focus u-ui h-control-sm rounded-nested border border-input bg-surface-1 pe-2 ps-2 text-ink-1 transition-colors duration-hover ease-standard hover:border-border-strong"
      >
        <option value="newest">{t("sortOptions.newest")}</option>
        <option value="name_asc">{t("sortOptions.nameAsc")}</option>
        <option value="rating">{t("sortOptions.rating")}</option>
        <option value="moq_asc">{t("sortOptions.moqAsc")}</option>
      </select>
    </div>
  );
}
