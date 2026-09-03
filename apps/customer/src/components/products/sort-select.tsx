"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

// Only sorts the catalog query can actually perform across the whole result
// set. Price sorting is deliberately absent: a product has no single price —
// ProductPrice holds a row per (type, currency, quantity tier) — so ordering
// requires deciding which tier represents a product and denormalising it onto
// Product for the database to sort on. Until that exists, offering the option
// produced a page sorted within itself that restarted on page 2.
const SORT_OPTIONS = [
  { value: "newest", key: "sort.newest" },
  { value: "name_asc", key: "sort.nameAsc" },
] as const;

/**
 * The sort control.
 *
 * A NATIVE <select>, on purpose. On the phones that carry most of this
 * storefront's traffic the native picker is a full-height wheel the operating
 * system already knows how to drive; a Radix listbox here would be a heavier,
 * less familiar version of the same two choices. It is styled from tokens
 * instead of imitated.
 *
 * Two live defects fixed while here: it carried `bg-white`, which rendered a
 * white plate with white-ish ink in dark mode, and a `focus:ring-primary/40`
 * that was neither the system's two-stop ring nor keyboard-only. It now uses the
 * recessed input rung (law A: recessed = input) and .u-focus.
 */
export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("catalogue");
  const current = searchParams.get("sort") ?? "newest";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("sort", e.target.value);
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      <select
        aria-label={t("sortLabel")}
        defaultValue={current}
        onChange={handleChange}
        data-rung={1}
        className="u-focus u-ui h-control-sm rounded-nested border border-input bg-surface-1 pe-2 ps-2 text-ink-1 transition-colors duration-hover ease-standard hover:border-border-strong"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.key)}
          </option>
        ))}
      </select>
    </div>
  );
}
