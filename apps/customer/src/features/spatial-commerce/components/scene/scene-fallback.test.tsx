// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SceneDomFallback } from "./scene-fallback";
import type { SpatialSceneLabels } from "./scene.types";

const labels: SpatialSceneLabels = {
  regionLabel: "Assembly viewer",
  loading: "Loading",
  unavailable: "Viewer unavailable",
  error: "Viewer failed",
  retry: "Retry viewer",
  partsLabel: "Assembly parts",
  nodes: {
    "mounting-plate": "Mounting plate",
    "motor-housing": "Motor housing",
    "drive-shaft": "Drive shaft",
    "output-coupling": "Output coupling",
  },
};

afterEach(cleanup);

describe("SceneDomFallback", () => {
  it("offers explicit retry and preserves accessible part selection origin", () => {
    const retry = vi.fn();
    const select = vi.fn();
    render(<SceneDomFallback labels={labels} selectedNodeId="drive-shaft" onNodeSelect={select} onRetry={retry} reason="error" />);

    expect(screen.getByRole("alert").textContent).toContain("Viewer failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry viewer" }));
    fireEvent.click(screen.getByRole("button", { name: "Motor housing" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith("motor-housing", "accessible-control");
  });
});
