import type {
  ResolvedSkuBinding,
  SpatialBindingIndex,
  SpatialSkuId,
  SpatialTargetId,
} from "../../domain/bindings";
import type { SpatialSelectionState } from "../../state/selection-reducer";
import type { SpatialSceneSnapshot } from "./scene.types";

export interface AdaptedSpatialSceneSelection {
  /** Singular primary focus used by the current lightweight renderer. */
  scene: SpatialSceneSnapshot;
  /** Preserves every resolved target for a future multi-highlight renderer. */
  binding: ResolvedSkuBinding | null;
}

export function adaptSelectionToSpatialScene(
  selection: SpatialSelectionState,
  bindings: SpatialBindingIndex,
  reducedMotion: boolean,
): AdaptedSpatialSceneSelection {
  const binding = selection.selectedSkuId ? bindings.get(selection.selectedSkuId) ?? null : null;
  const selectedNodeId = selection.selectedNodeId && binding?.targetIds.includes(selection.selectedNodeId)
    ? selection.selectedNodeId
    : binding?.targetIds[0] ?? null;
  return {
    scene: {
      selectedNodeId,
      pulseRevision: selection.pulseRevision,
      reducedMotion,
    },
    binding,
  };
}

/** Reverse lookup maps every target in a one-to-many binding back to its SKU. */
export function skuIdForSpatialTarget(
  targetId: SpatialTargetId,
  bindings: SpatialBindingIndex,
): SpatialSkuId | null {
  const matches = [...bindings]
    .filter(([, binding]) => binding.targetIds.includes(targetId))
    .map(([skuId]) => skuId);
  return matches.length === 1 ? matches[0]! : null;
}
