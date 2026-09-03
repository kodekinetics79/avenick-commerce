"use client";

import * as React from "react";

/**
 * EnvironmentFlags — reads the client's data preference once and stamps it on
 * <html>, because law 7 names Save-Data and NO shipping browser exposes it as a
 * CSS media query. `prefers-reduced-data` exists in the spec and is not Baseline;
 * this is the half that actually reaches users on a metered Gulf mobile plan.
 *
 * Everything downstream is CSS: `[data-save-data]` halves --motion-scale, stops
 * the field drift, drops the grain layer and hides the hero's decorative planes.
 * <LightGrid> also checks the attribute and never attaches its listener.
 *
 * Mount once per root layout, beside <AmbientField>. It renders nothing, it
 * never re-runs, and if it never runs at all the product is simply the full
 * experience — which is the correct failure direction for a progressive hint.
 */
export function EnvironmentFlags() {
  React.useEffect(() => {
    if (typeof navigator === "undefined") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) {
      document.documentElement.setAttribute("data-save-data", "");
    }
  }, []);

  return null;
}
