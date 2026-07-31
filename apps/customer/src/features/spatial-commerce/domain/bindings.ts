export type SpatialSkuId = string;
export type SpatialTargetId = string;

/** Plain identifiers keep domain bindings independent from any scene renderer. */
export interface SkuSpatialBinding {
  readonly skuId: SpatialSkuId;
  readonly targetIds: readonly SpatialTargetId[];
}

export type BindingCardinality = "one" | "many" | "missing";

export interface ResolvedSkuBinding {
  readonly skuId: SpatialSkuId;
  readonly cardinality: BindingCardinality;
  readonly targetIds: readonly SpatialTargetId[];
  readonly hasSpatialRepresentation: boolean;
}

export type SpatialBindingIndex = ReadonlyMap<SpatialSkuId, ResolvedSkuBinding>;

export function resolveSkuBinding(
  skuId: SpatialSkuId,
  bindings: readonly SkuSpatialBinding[],
): ResolvedSkuBinding {
  const targetIds = Array.from(
    new Set(
      bindings
        .filter((binding) => binding.skuId === skuId)
        .flatMap((binding) => binding.targetIds)
        .filter((targetId) => targetId.trim().length > 0),
    ),
  );

  const cardinality: BindingCardinality =
    targetIds.length === 0 ? "missing" : targetIds.length === 1 ? "one" : "many";

  return {
    skuId,
    cardinality,
    targetIds,
    hasSpatialRepresentation: cardinality !== "missing",
  };
}

export function createSpatialBindingIndex(
  skuIds: readonly SpatialSkuId[],
  bindings: readonly SkuSpatialBinding[],
): SpatialBindingIndex {
  return new Map(skuIds.map((skuId) => [skuId, resolveSkuBinding(skuId, bindings)]));
}
