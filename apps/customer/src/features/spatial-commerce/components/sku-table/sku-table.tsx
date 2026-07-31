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
  const errorMessage = error instanceof Error ? error.message : error;
  const select = (skuId: string) => onSelect(skuId, "sku-table");

  const stateMessage = loading
    ? { message: labels.loading, live: "polite" as const }
    : errorMessage
      ? { message: `${labels.error}: ${errorMessage}`, live: "assertive" as const }
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
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-spatial-surface="mobile"
                    data-spatial-sku-id={item.id}
                    data-binding-cardinality={binding.cardinality}
                    onClick={() => select(item.id)}
                    className={cn(
                      "w-full cursor-pointer p-3 text-start outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected && "bg-primary/10",
                    )}
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-muted-foreground"><bdi dir="ltr">{item.sku}</bdi></p>
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
              <th scope="col" className="w-[19%] px-3 py-2 text-start text-xs font-semibold text-muted-foreground">{labels.sku}</th>
              <th scope="col" className="w-[31%] px-3 py-2 text-start text-xs font-semibold text-muted-foreground">{labels.item}</th>
              <th scope="col" className="w-[29%] px-3 py-2 text-start text-xs font-semibold text-muted-foreground">{labels.availability}</th>
              <th scope="col" className="w-[21%] px-3 py-2 text-start text-xs font-semibold text-muted-foreground">{labels.spatialStatus}</th>
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
                        className="min-h-11 w-full px-3 py-2 text-start outline-none hover:bg-secondary/50"
                      >
                        <bdi dir="ltr">{item.sku}</bdi>
                        <span className="sr-only"> — {item.name}</span>
                      </button>
                    </td>
                    <td className="min-w-0 px-3 py-2">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{labels.price(item.unitPrice, item.currency)}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <p>{labels.availabilityValue(item.availability)}</p>
                      <p className="truncate text-muted-foreground">
                        {labels.minimumOrderQuantity}: {labels.quantity(item.minimumOrderQuantity)} · {labels.leadTime}: {labels.days(item.leadTimeDays)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
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
      <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground" aria-live={live}>
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
          ? "bg-success/15 text-success"
          : "bg-warning-soft text-warning-foreground",
      )}
    >
      {binding.hasSpatialRepresentation ? labels.bound3d : labels.missing3d}
    </span>
  );
}
