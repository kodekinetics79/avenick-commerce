export const SPATIAL_ASSEMBLY_NODES = [
  { id: "mounting-plate" },
  { id: "motor-housing" },
  { id: "drive-shaft" },
  { id: "output-coupling" },
] as const;

export type SpatialAssemblyNodeId = (typeof SPATIAL_ASSEMBLY_NODES)[number]["id"];

export const PULSE_DURATION_MS = 650;

/** A smooth, bounded two-beat envelope used by the renderer and unit tests. */
export function spatialPulseEnvelope(elapsedMs: number, durationMs = PULSE_DURATION_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs >= durationMs) return 0;
  const progress = elapsedMs / durationMs;
  return Math.sin(progress * Math.PI) ** 2;
}
