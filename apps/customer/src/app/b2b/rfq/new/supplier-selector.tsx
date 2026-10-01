"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, ShieldCheck, X } from "lucide-react";
import { Button, Eyebrow, Input, Surface } from "@avenick/ui";
import { useB2BT } from "@/components/b2b/use-b2b-t";

export type SupplierOption = {
  id: string;
  businessNameEn: string;
  businessNameAr: string | null;
  city: string;
  country: string;
  tier: string;
  verification: { type: string; reviewedAt: string } | null;
};

export function SupplierSelector({ selected, onChange, allowSingleSupplier }: {
  selected: SupplierOption[];
  onChange: (next: SupplierOption[]) => void;
  allowSingleSupplier: boolean;
}) {
  const t = useB2BT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setError(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      void fetch(`/api/b2b/suppliers?q=${encodeURIComponent(term)}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok || !body.success) throw new Error(body.error ?? "search failed");
          setResults((body.data?.suppliers ?? []) as SupplierOption[]);
        })
        .catch((reason) => { if (reason?.name !== "AbortError") setError(true); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const selectedIds = new Set(selected.map((supplier) => supplier.id));
  const available = results.filter((supplier) => !selectedIds.has(supplier.id));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("newRfq.suppliers.search")}
          aria-label={t("newRfq.suppliers.search")}
          className="ps-9"
        />
      </div>
      <p className="u-meta text-ink-3">
        {allowSingleSupplier ? t("newRfq.suppliers.singleDisclosure") : t("newRfq.suppliers.minimum")}
      </p>

      {selected.length > 0 && (
        <div className="space-y-2" aria-label={t("newRfq.suppliers.selected")}>
          {selected.map((supplier) => (
            <Surface key={supplier.id} rung={1} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="u-ui truncate font-medium text-ink-1">{supplier.businessNameEn}</p>
                <p className="u-meta flex flex-wrap items-center gap-1 text-ink-3">
                  <span>{supplier.city}, {supplier.country}</span>
                  {supplier.verification && <><span>·</span><span className="inline-flex items-center gap-1 text-success-ink"><ShieldCheck className="h-3 w-3" aria-hidden="true" />{t("newRfq.suppliers.verified")}</span></>}
                </p>
              </div>
              <Button type="button" variant="ghost" size="xs" aria-label={t("newRfq.suppliers.remove", { supplier: supplier.businessNameEn })} onClick={() => onChange(selected.filter((item) => item.id !== supplier.id))}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Surface>
          ))}
        </div>
      )}

      {loading && <p className="u-meta text-ink-3">{t("newRfq.suppliers.searching")}</p>}
      {error && <p className="u-meta text-danger-ink" role="alert">{t("newRfq.suppliers.searchFailed")}</p>}
      {!loading && query.trim().length >= 2 && available.length === 0 && !error && <p className="u-meta text-ink-3">{t("newRfq.suppliers.noResults")}</p>}
      {available.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label={t("newRfq.suppliers.results")}>
          {available.map((supplier) => (
            <li key={supplier.id}>
              <button type="button" onClick={() => onChange([...selected, supplier])} className="u-focus flex w-full items-center justify-between gap-3 rounded-nested px-3 py-2 text-start hover:bg-neutral-soft">
                <span className="min-w-0"><span className="u-ui block truncate font-medium text-ink-1">{supplier.businessNameEn}</span><span className="u-meta text-ink-3">{supplier.city}, {supplier.country}</span></span>
                <Plus className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length >= (allowSingleSupplier ? 1 : 2) && (
        <p className="u-meta inline-flex items-center gap-1 text-success-ink"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{t("newRfq.suppliers.ready", { count: selected.length })}</p>
      )}
    </div>
  );
}
