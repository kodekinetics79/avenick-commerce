"use client";

import * as React from "react";
import { shouldReduceSpatialMotion } from "./motion-policy";

interface NavigatorConnection {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

export interface SpatialRuntimePolicy {
  /** Suppress pulse, idle rotation, and smooth scene-driven scrolling. */
  reducedMotion: boolean;
  /** False under Save-Data so callers can avoid requesting the WebGL chunk. */
  allowWebGLLoad: boolean;
}

const SAFE_INITIAL_POLICY: SpatialRuntimePolicy = { reducedMotion: true, allowWebGLLoad: false };

export function useSpatialRuntimePolicy(): SpatialRuntimePolicy {
  const [policy, setPolicy] = React.useState<SpatialRuntimePolicy>(SAFE_INITIAL_POLICY);

  React.useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
    const update = () => {
      const saveData = Boolean(connection?.saveData);
      setPolicy({
        reducedMotion: shouldReduceSpatialMotion({
          reducedMotion: motion.matches,
          coarsePointer: coarse.matches,
          saveData,
        }),
        allowWebGLLoad: !saveData,
      });
    };
    update();
    motion.addEventListener("change", update);
    coarse.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    return () => {
      motion.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return policy;
}

/** Backward-compatible motion-only selector for existing consumers. */
export function useReducedSpatialMotion(): boolean {
  return useSpatialRuntimePolicy().reducedMotion;
}
