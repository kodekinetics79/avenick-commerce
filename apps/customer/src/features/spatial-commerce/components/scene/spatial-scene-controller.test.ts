import { describe, expect, it } from "vitest";
import type { ResolvedSkuBinding, SpatialBindingIndex } from "../../domain/bindings";
import { adaptSelectionToSpatialScene, skuIdForSpatialTarget } from "./spatial-scene-controller";

const multi: ResolvedSkuBinding = {
  skuId: "assembly-kit",
  cardinality: "many",
  targetIds: ["motor-housing", "drive-shaft", "output-coupling"],
  hasSpatialRepresentation: true,
};
const bindings: SpatialBindingIndex = new Map([[multi.skuId, multi]]);

describe("spatial scene controller adapter", () => {
  it("uses the first resolved target as focus without discarding the full binding", () => {
    const adapted = adaptSelectionToSpatialScene(
      { selectedSkuId: multi.skuId, selectedNodeId: "motor-housing", source: "sku-table", pulseRevision: 7 },
      bindings,
      true,
    );

    expect(adapted.scene).toEqual({
      selectedNodeId: "motor-housing",
      pulseRevision: 7,
      reducedMotion: true,
    });
    expect(adapted.binding?.targetIds).toEqual(multi.targetIds);
  });

  it("maps every target in a one-to-many binding back to its SKU", () => {
    expect(skuIdForSpatialTarget("motor-housing", bindings)).toBe(multi.skuId);
    expect(skuIdForSpatialTarget("output-coupling", bindings)).toBe(multi.skuId);
    expect(skuIdForSpatialTarget("unknown", bindings)).toBeNull();
  });

  it("fails closed when one target ambiguously maps to multiple SKUs", () => {
    const collision: SpatialBindingIndex = new Map([
      ...bindings,
      ["another-sku", { ...multi, skuId: "another-sku", targetIds: ["motor-housing"] }],
    ]);
    expect(skuIdForSpatialTarget("motor-housing", collision)).toBeNull();
  });

  it("returns an unselected scene when the domain selection has no binding", () => {
    expect(
      adaptSelectionToSpatialScene(
        { selectedSkuId: "missing", selectedNodeId: null, source: "programmatic", pulseRevision: 2 },
        bindings,
        false,
      ).scene.selectedNodeId,
    ).toBeNull();
  });
});
