"use client";

import * as React from "react";
import { Cuboid, Eye, EyeOff, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@avenick/utils";
import { createSpatialBindingIndex } from "../domain/bindings";
import type { MechanicalSku } from "../domain/contracts";
import type { SkuSpatialBinding } from "../domain/bindings";
import { INITIAL_SPATIAL_SELECTION, spatialSelectionReducer, type SpatialSelectionSource } from "../state/selection-reducer";
import { useReducedSpatialMotion } from "../state/use-spatial-motion";
import { SpatialSkuTable } from "./sku-table";
import { SpatialScene, skuIdForSpatialTarget, type SpatialSceneLabels } from "./scene";

export interface SpatialCommerceShellProps {
  items: readonly MechanicalSku[];
  bindings: readonly SkuSpatialBinding[];
  fixtureMode?: boolean;
}

function useDesktopViewport() {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function SpatialCommerceShell({ items, bindings, fixtureMode = false }: SpatialCommerceShellProps) {
  const t = useTranslations("spatialCommerce");
  const locale = useLocale();
  const [selection, dispatch] = React.useReducer(spatialSelectionReducer, INITIAL_SPATIAL_SELECTION);
  const [mobileViewerOpen, setMobileViewerOpen] = React.useState(false);
  const desktop = useDesktopViewport();
  const reducedMotion = useReducedSpatialMotion();
  const tableRegion = React.useRef<HTMLDivElement>(null);
  const displayItems = React.useMemo(() => locale.startsWith("ar")
    ? items.map((item) => ({
        ...item,
        name: item.nameAr ?? item.name,
        description: item.descriptionAr ?? item.description,
      }))
    : items, [items, locale]);
  const bindingIndex = React.useMemo(() => createSpatialBindingIndex(items.map((item) => item.id), bindings), [bindings, items]);
  const selectedItem = displayItems.find((item) => item.id === selection.selectedSkuId) ?? null;
  const selectedBinding = selection.selectedSkuId ? bindingIndex.get(selection.selectedSkuId) : undefined;
  const selectedNodeId = selection.selectedNodeId;
  const renderViewer = desktop || mobileViewerOpen;

  const selectSku = React.useCallback((skuId: string, source: SpatialSelectionSource) => {
    const nodeId = bindingIndex.get(skuId)?.targetIds[0] ?? null;
    dispatch({ type: "select", skuId, nodeId, source });
  }, [bindingIndex]);

  const selectNode = React.useCallback((nodeId: string) => {
    const skuId = skuIdForSpatialTarget(nodeId, bindingIndex);
    if (!skuId) return;
    dispatch({ type: "select", skuId, nodeId, source: "scene" });
    window.requestAnimationFrame(() => {
      const surface = desktop ? "desktop" : "mobile";
      const row = tableRegion.current?.querySelector<HTMLElement>(`[data-spatial-surface="${surface}"][data-spatial-sku-id="${CSS.escape(skuId)}"]`);
      row?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
      row?.focus({ preventScroll: true });
    });
  }, [bindingIndex, desktop, reducedMotion]);

  const sceneLabels: SpatialSceneLabels = {
    regionLabel: t("viewer.regionLabel"),
    loading: t("viewer.loading"),
    unavailable: t("viewer.unavailable"),
    error: t("viewer.error"),
    partsLabel: t("viewer.partsLabel"),
    nodes: {
      "mounting-plate": t("viewer.nodes.mountingPlate"),
      "motor-housing": t("viewer.nodes.motorHousing"),
      "drive-shaft": t("viewer.nodes.driveShaft"),
      "output-coupling": t("viewer.nodes.outputCoupling"),
    },
  };

  const tableLabels = {
    caption: t("table.caption"),
    sku: t("table.sku"),
    item: t("table.item"),
    availability: t("table.availability"),
    minimumOrderQuantity: t("table.moq"),
    leadTime: t("table.leadTime"),
    spatialStatus: t("table.spatialStatus"),
    bound3d: t("table.bound3d"),
    missing3d: t("table.missing3d"),
    loading: t("table.loading"),
    empty: t("table.empty"),
    error: t("table.error"),
    days: (value: number) => t("table.days", { value }),
    quantity: (value: number) => new Intl.NumberFormat(locale).format(value),
    price: (value: number, currency: MechanicalSku["currency"]) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(value),
    availabilityValue: (value: MechanicalSku["availability"]) => t(`availability.${value}`),
  } as const;

  const selectionAnnouncement = selectedItem
    ? selectedBinding?.hasSpatialRepresentation
      ? t("selection.mapped", { item: selectedItem.name })
      : t("selection.unmapped", { item: selectedItem.name })
    : t("selection.none");

  return (
    <div
      className="space-y-4"
      data-spatial-state={selectedItem ? "selected" : "idle"}
      data-selected-node={selectedNodeId ?? ""}
      data-pulse-revision={selection.pulseRevision}
    >
      {fixtureMode && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-soft p-4 text-sm text-foreground">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p><strong>{t("fixture.title")}</strong> {t("fixture.description")}</p>
        </div>
      )}

      <button
        type="button"
        aria-expanded={mobileViewerOpen}
        aria-controls="spatial-viewer-panel"
        onClick={() => setMobileViewerOpen((open) => !open)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
      >
        {mobileViewerOpen ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        {mobileViewerOpen ? t("hideViewer") : t("showViewer")}
      </button>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(32.5rem,2fr)] xl:items-start">
        <section
          id="spatial-viewer-panel"
          aria-labelledby="spatial-viewer-heading"
          className={cn("min-w-0 rounded-3xl border border-border bg-card p-3 shadow-xl", !renderViewer && "hidden", "xl:sticky xl:top-24")}
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-2 pt-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary rtl:normal-case rtl:tracking-normal">{t("viewer.eyebrow")}</p>
              <h2 id="spatial-viewer-heading" className="mt-1 font-semibold">{t("viewer.title")}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              <Cuboid aria-hidden="true" className="h-3.5 w-3.5" /> {t("viewer.mode")}
            </span>
          </div>
          {renderViewer && (
            <SpatialScene
              labels={sceneLabels}
              selectedNodeId={selectedNodeId}
              pulseRevision={selection.pulseRevision}
              reducedMotion={reducedMotion}
              onNodeSelect={selectNode}
            />
          )}
        </section>

        <section aria-labelledby="spatial-sku-heading" className="min-w-0 rounded-3xl border border-border bg-card p-3 shadow-lg sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary rtl:normal-case rtl:tracking-normal">{t("table.eyebrow")}</p>
              <h2 id="spatial-sku-heading" className="mt-1 font-semibold">{t("table.title")}</h2>
            </div>
            <span className="text-xs text-muted-foreground">{t("table.count", { count: items.length })}</span>
          </div>
          <div ref={tableRegion} className="max-h-[42rem] overflow-y-auto">
            <SpatialSkuTable
              items={displayItems}
              bindings={bindingIndex}
              selectedSkuId={selection.selectedSkuId}
              onSelect={selectSku}
              labels={tableLabels}
            />
          </div>
          <p role="status" aria-live="polite" className="mt-3 min-h-5 px-1 text-sm text-muted-foreground">
            {selectedItem && <><bdi dir="ltr">{selectedItem.sku}</bdi><span> — </span></>}
            {selectionAnnouncement}
            {selectedItem && <span className="sr-only"> {t("selection.sequence", { revision: selection.pulseRevision })}</span>}
          </p>
        </section>
      </div>
    </div>
  );
}
