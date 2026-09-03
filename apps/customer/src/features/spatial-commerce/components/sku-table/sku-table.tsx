"use client";

import * as React from "react";
import { cn } from "@avenick/utils";
import type { MechanicalSku } from "../../domain/contracts";
import type { ResolvedSkuBinding, SpatialBindingIndex } from "../../domain/bindings";
import type { SpatialSelectionSource } from "../../state/selection-reducer";

export interface SpatialSkuTableLabels {
  readonly caption: string;
  readonly sku: string;
  readonly item: string;
  readonly availability: string;
  readonly minimumOrderQuantity: string;
  readonly leadTime: string;
  readonly spatialStatus: string;
  readonly bound3d: string;
  readonly missing3d: string;
  readonly loading: string;
  readonly empty: string;
  readonly error: string;
  readonly days: (value: number) => string;
  readonly quantity: (value: number) => string;
  readonly price: (value: number, currency: MechanicalSku["currency"]) => string;
  readonly availabilityValue: (value: MechanicalSku["availability"]) => string;
}

export interface SpatialSkuTableProps {
  readonly items: readonly MechanicalSku[];
  readonly bindings: SpatialBindingIndex;
  readonly selectedSkuId: string | null;
  readonly onSelect: (skuId: string, source: SpatialSelectionSource) => void;
  readonly labels: SpatialSkuTableLabels;
  readonly loading?: boolean;
  readonly error?: string | Error | null;
  readonly className?: string;
}

function missingBinding(skuId: string): ResolvedSkuBinding {
  return {
    skuId,
    cardinality: "missing",
    targetIds: [],
    hasSpatialRepresentation: false,
  };
}

export function SpatialSkuTable({
  items,
  bindings,
  selectedSkuId,
  onSelect,
  labels,
  loading = false,
  error = null,
  className,
}: SpatialSkuTableProps) {
  const mobileListLabelId = React.useId();
  const hasError = Boolean(error);
  const select = (skuId: string) => onSelect(skuId, "sku-table");

  const stateMessage = loading
    ? { message: labels.loading, live: "polite" as const }
    : hasError
      ? { message: labels.error, live: "assertive" as const }
      : items.length === 0
        ? { message: labels.empty, live: "polite" as const }
        : null;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="xl:hidden">
        <p className="sr-only" id={mobileListLabelId}>{labels.caption}</p>
        {stateMessage ? (
          <StatusMessage {...stateMessage} />
        ) : (
          <ul aria-labelledby={mobileListLabelId} aria-busy={loading || undefined} className="divide-y divide-border">
            {items.map((item) => {
              const binding = bindings.get(item.id) ?? missingBinding(item.id);
              const selected = selectedSkuId === item.id;
              return (
                <li
                  key={item.id}
                  className={cn("p-3 transition-colors", selected && "bg-primary/10")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{labels.price(item.unitPrice, item.currency)}</p>
                    </div>
                    <SpatialStatus binding={binding} labels={labels} />
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <SkuFact label={labels.availability} value={labels.availabilityValue(item.availability)} />
                    <SkuFact label={labels.minimumOrderQuantity} value={labels.quantity(item.minimumOrderQuantity)} />
                    <SkuFact label={labels.leadTime} value={labels.days(item.leadTimeDays)} />
                  </dl>
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-spatial-surface="mobile"
                    data-spatial-sku-id={item.id}
                    data-binding-cardinality={binding.cardinality}
                    onClick={() => select(item.id)}
                    className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-background px-3 font-mono text-xs font-semibold text-foreground outline-none transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-sans font-medium text-muted-foreground">{labels.sku}</span>
                    <bdi dir="ltr" className="truncate">{item.sku}</bdi>
                    <span className="sr-only"> — {item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[520px] table-fixed border-collapse text-sm" aria-busy={loading || undefined}>
          <caption className="sr-only">{labels.caption}</caption>
          <thead className="sticky top-0 z-10 border-b border-border bg-secondary">
            <tr>
              <th scope="col" className="w-[18%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.sku}</th>
              <th scope="col" className="w-[25%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.item}</th>
              <th scope="col" className="w-[15%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.availability}</th>
              <th scope="col" className="w-[12%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.minimumOrderQuantity}</th>
              <th scope="col" className="w-[14%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.leadTime}</th>
              <th scope="col" className="w-[16%] px-2 py-2 text-start text-xs font-semibold text-foreground">{labels.spatialStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stateMessage ? (
              <StatusRow {...stateMessage} />
            ) : (
              items.map((item) => {
                const binding = bindings.get(item.id) ?? missingBinding(item.id);
                const selected = selectedSkuId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring",
                      selected && "bg-primary/10",
                    )}
                  >
                    <td className="truncate p-0 font-mono text-xs font-semibold">
                      <button
                        type="button"
                        aria-pressed={selected}
                        data-spatial-surface="desktop"
                        data-spatial-sku-id={item.id}
                        data-binding-cardinality={binding.cardinality}
                        onClick={() => select(item.id)}
                        className="min-h-11 w-full px-2 py-2 text-start outline-none hover:bg-secondary/50"
                      >
                        <bdi dir="ltr">{item.sku}</bdi>
                        <span className="sr-only"> — {item.name}</span>
                      </button>
                    </td>
                    <td className="min-w-0 px-2 py-2">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{labels.price(item.unitPrice, item.currency)}</p>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <p>{labels.availabilityValue(item.availability)}</p>
                    </td>
                    <td className="px-2 py-2 text-xs font-medium">{labels.quantity(item.minimumOrderQuantity)}</td>
                    <td className="px-2 py-2 text-xs font-medium">{labels.days(item.leadTimeDays)}</td>
                    <td className="px-2 py-2">
                      <SpatialStatus binding={binding} labels={labels} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusRow({ message, live }: { message: string; live: "polite" | "assertive" }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground" aria-live={live}>
        {message}
      </td>
    </tr>
  );
}

function StatusMessage({ message, live }: { message: string; live: "polite" | "assertive" }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground" aria-live={live}>{message}</p>;
}

function SkuFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function SpatialStatus({ binding, labels }: { binding: ResolvedSkuBinding; labels: SpatialSkuTableLabels }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold",
        binding.hasSpatialRepresentation
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-warning-soft text-warning-foreground",
      )}
    >
      {binding.hasSpatialRepresentation ? labels.bound3d : labels.missing3d}
    </span>
  );
}
