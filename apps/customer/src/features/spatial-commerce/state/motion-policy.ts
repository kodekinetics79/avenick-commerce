export interface SpatialMotionSignals {
  reducedMotion: boolean;
  coarsePointer: boolean;
  saveData: boolean;
}

export function shouldReduceSpatialMotion(signals: SpatialMotionSignals): boolean {
  return signals.reducedMotion || signals.coarsePointer || signals.saveData;
}
