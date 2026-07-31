import type { SpatialSkuId } from "../domain/bindings";

export type SpatialSelectionSource = "sku-table" | "scene" | "programmatic";

export interface SpatialSelectionState {
  readonly selectedSkuId: SpatialSkuId | null;
  readonly selectedNodeId: string | null;
  readonly source: SpatialSelectionSource | null;
  /** Increments on every selection so an already-selected object can pulse again. */
  readonly pulseRevision: number;
}

export type SpatialSelectionAction =
  | {
      readonly type: "select";
      readonly skuId: SpatialSkuId;
      readonly nodeId: string | null;
      readonly source: SpatialSelectionSource;
    }
  | {
      readonly type: "clear";
      readonly source: SpatialSelectionSource;
    };

export const INITIAL_SPATIAL_SELECTION: SpatialSelectionState = {
  selectedSkuId: null,
  selectedNodeId: null,
  source: null,
  pulseRevision: 0,
};

export function spatialSelectionReducer(
  state: SpatialSelectionState,
  action: SpatialSelectionAction,
): SpatialSelectionState {
  if (action.type === "clear") {
    return {
      selectedSkuId: null,
      selectedNodeId: null,
      source: action.source,
      pulseRevision: state.pulseRevision,
    };
  }

  return {
    selectedSkuId: action.skuId,
    selectedNodeId: action.nodeId,
    source: action.source,
    pulseRevision: state.pulseRevision + 1,
  };
}
