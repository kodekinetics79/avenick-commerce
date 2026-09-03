import { describe, expect, it } from "vitest";
import { INITIAL_SPATIAL_SELECTION, spatialSelectionReducer } from "./selection-reducer";

describe("spatialSelectionReducer", () => {
  it("tracks the originating interaction surface", () => {
    const state = spatialSelectionReducer(INITIAL_SPATIAL_SELECTION, {
      type: "select",
      skuId: "sku-1",
      nodeId: "motor-housing",
      source: "scene",
    });

    expect(state).toMatchObject({ selectedSkuId: "sku-1", selectedNodeId: "motor-housing", source: "scene" });
  });

  it("restarts a pulse when the same SKU is selected again", () => {
    const first = spatialSelectionReducer(INITIAL_SPATIAL_SELECTION, {
      type: "select",
      skuId: "sku-1",
      nodeId: "motor-housing",
      source: "sku-table",
    });
    const second = spatialSelectionReducer(first, {
      type: "select",
      skuId: "sku-1",
      nodeId: "motor-housing",
      source: "sku-table",
    });

    expect(second.selectedSkuId).toBe("sku-1");
    expect(second.pulseRevision).toBe(first.pulseRevision + 1);
  });

  it("clears selection without triggering a phantom pulse", () => {
    const selected = spatialSelectionReducer(INITIAL_SPATIAL_SELECTION, {
      type: "select",
      skuId: "sku-1",
      nodeId: "motor-housing",
      source: "programmatic",
    });
    const cleared = spatialSelectionReducer(selected, { type: "clear", source: "programmatic" });

    expect(cleared).toEqual({
      selectedSkuId: null,
      selectedNodeId: null,
      source: "programmatic",
      pulseRevision: selected.pulseRevision,
    });
  });
});
