"use client";

import * as React from "react";
import { shouldReduceSpatialMotion } from "./motion-policy";

interface NavigatorConnection {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

export function useReducedSpatialMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
    const update = () => setReduced(shouldReduceSpatialMotion({
      reducedMotion: motion.matches,
      coarsePointer: coarse.matches,
      saveData: Boolean(connection?.saveData),
    }));
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

  return reduced;
}
