"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

// Only sorts the catalog query can actually perform across the whole result
// set. Price sorting is deliberately absent: a product has no single price —
// ProductPrice holds a row per (type, currency, quantity tier) — so ordering
// requires deciding which tier represents a product and denormalising it onto
// Product for the database to sort on. Until that exists, offering the option
// produced a page sorted within itself that restarted on page 2.
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "name_asc", label: "Name A–Z" },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("sort", e.target.value);
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        aria-label="Sort products"
        defaultValue={current}
        onChange={handleChange}
        className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
